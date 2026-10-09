-- Inova Auto — regras de negócio transacionais

-- ---------------------------------------------------------------------------
-- Reserva comercial (sem pagamento). Confirmada no servidor de forma transacional.
-- ---------------------------------------------------------------------------
create or replace function app.reserve_vehicle(
  p_vehicle_id uuid, p_lead_id uuid, p_expires_at timestamptz, p_note text
) returns uuid
language plpgsql security definer set search_path = app, auth, pg_temp as $$
declare
  v_vehicle app.vehicles%rowtype;
  v_id uuid;
begin
  if not app.has_role('admin', 'stock_manager', 'sales') then
    raise exception 'Sem permissão para reservar viaturas.' using errcode = 'insufficient_privilege';
  end if;
  if p_expires_at <= now() then
    raise exception 'A reserva tem de terminar no futuro.' using errcode = 'check_violation';
  end if;
  if p_lead_id is not null and not app.can_access_lead(p_lead_id) then
    raise exception 'Sem acesso a este contacto.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_vehicle from app.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'Viatura não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_vehicle.status <> 'available' then
    raise exception 'Só é possível reservar viaturas disponíveis (estado atual: %).', v_vehicle.status
      using errcode = 'check_violation';
  end if;

  insert into app.vehicle_reservations (vehicle_id, lead_id, expires_at, note, created_by)
  values (p_vehicle_id, p_lead_id, p_expires_at, p_note, auth.uid())
  returning id into v_id;

  update app.vehicles set status = 'reserved', updated_by = auth.uid() where id = p_vehicle_id;
  perform app.write_audit('reserve', 'vehicles', p_vehicle_id::text,
    jsonb_build_object('reservation_id', v_id, 'expires_at', p_expires_at, 'lead_id', p_lead_id));
  return v_id;
end $$;

create or replace function app.close_reservation(p_reservation_id uuid, p_outcome text, p_reason text)
returns void
language plpgsql security definer set search_path = app, auth, pg_temp as $$
declare
  v_res app.vehicle_reservations%rowtype;
  -- Só service_role e authenticated têm EXECUTE; sem utilizador = rotina de sistema.
  v_system boolean := auth.uid() is null;
begin
  if p_outcome not in ('cancelled', 'expired', 'converted') then
    raise exception 'Resultado inválido.' using errcode = 'check_violation';
  end if;
  if not v_system and not app.has_role('admin', 'stock_manager', 'sales') then
    raise exception 'Sem permissão.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_res from app.vehicle_reservations where id = p_reservation_id for update;
  if not found or v_res.status <> 'active' then
    raise exception 'Reserva não encontrada ou já terminada.' using errcode = 'no_data_found';
  end if;
  perform 1 from app.vehicles where id = v_res.vehicle_id for update;

  update app.vehicle_reservations
     set status = p_outcome, closed_by = auth.uid(), closed_reason = p_reason, closed_at = now()
   where id = p_reservation_id;

  if p_outcome = 'converted' then
    update app.vehicles set status = 'sold', updated_by = auth.uid() where id = v_res.vehicle_id;
  else
    -- Reabre o stock só se a viatura continuar reservada
    update app.vehicles set status = 'available', updated_by = auth.uid()
     where id = v_res.vehicle_id and status = 'reserved';
  end if;
  perform app.write_audit('reservation_' || p_outcome, 'vehicles', v_res.vehicle_id::text,
    jsonb_build_object('reservation_id', p_reservation_id, 'reason', p_reason));
end $$;

-- Expira reservas vencidas (executado pelo processamento agendado)
create or replace function app.expire_reservations() returns integer
language plpgsql security definer set search_path = app, auth, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in select id from app.vehicle_reservations where status = 'active' and expires_at <= now() for update skip locked loop
    perform app.close_reservation(r.id, 'expired', 'Prazo da reserva terminou');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Mudanças manuais de estado mantêm as reservas coerentes
create or replace function app.vehicle_status_sync_reservations() returns trigger
language plpgsql security definer set search_path = app, auth, pg_temp as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'sold' then
      update app.vehicle_reservations set status = 'converted', closed_at = now(), closed_by = auth.uid(),
             closed_reason = coalesce(closed_reason, 'Viatura vendida')
       where vehicle_id = new.id and status = 'active';
    elsif new.status in ('available', 'archived', 'draft') then
      update app.vehicle_reservations set status = 'cancelled', closed_at = now(), closed_by = auth.uid(),
             closed_reason = coalesce(closed_reason, 'Estado da viatura alterado para ' || new.status)
       where vehicle_id = new.id and status = 'active';
    end if;
  end if;
  return null;
end $$;
create trigger vehicles_sync_reservations after update of status on app.vehicles
  for each row execute function app.vehicle_status_sync_reservations();

-- ---------------------------------------------------------------------------
-- Distribuição automática de contactos (round-robin entre vendedores disponíveis)
--
-- Algoritmo (documentado em docs/ADMIN.md):
--  1. Candidatos: perfis ativos com receives_leads = true e papel sales ou admin.
--  2. Exclui quem tem ausência registada para a data de hoje (Europe/Lisbon).
--  3. Escolhe quem recebeu um contacto há mais tempo (last_assigned_at mais antigo; nunca = primeiro).
--     Empate desfeito pelo id para ser determinístico.
--  4. Sem candidatos → o contacto fica na fila central (assigned_to null, estado "new").
-- ---------------------------------------------------------------------------
create or replace function app.auto_assign_lead(p_lead_id uuid) returns uuid
language plpgsql security definer set search_path = app, auth, pg_temp as $$
declare
  v_today date := (now() at time zone 'Europe/Lisbon')::date;
  v_enabled boolean;
  v_pick uuid;
begin
  if auth.uid() is not null and not app.has_role('admin') then
    raise exception 'Sem permissão.' using errcode = 'insufficient_privilege';
  end if;
  select coalesce((value ->> 'auto_assign')::boolean, true) into v_enabled
    from app.site_settings where key = 'crm';
  if v_enabled is false then
    return null;
  end if;

  select p.id into v_pick
    from app.profiles p
   where p.is_active and p.receives_leads and p.role in ('sales', 'admin')
     and not exists (select 1 from app.staff_absences a
                      where a.profile_id = p.id and v_today between a.starts_on and a.ends_on)
   order by p.last_assigned_at nulls first, p.id
   limit 1
   for update skip locked;

  if v_pick is null then
    return null;
  end if;

  update app.leads set assigned_to = v_pick, status = case when status = 'new' then 'assigned' else status end
   where id = p_lead_id and assigned_to is null;
  if found then
    update app.profiles set last_assigned_at = now() where id = v_pick;
    insert into app.lead_activities (lead_id, actor_id, kind, body, meta)
    values (p_lead_id, null, 'assignment', 'Atribuído automaticamente', jsonb_build_object('assigned_to', v_pick, 'auto', true));
    return v_pick;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Limitação de pedidos (antiabuso) partilhada entre instâncias serverless
-- ---------------------------------------------------------------------------
create or replace function app.hit_rate_limit(p_bucket text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql security definer set search_path = app, pg_temp as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into app.rate_limits (bucket, window_start, hits) values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = app.rate_limits.hits + 1
  returning hits into v_hits;
  -- limpeza oportunista
  if random() < 0.01 then
    delete from app.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------------
-- Outbox: reclamar trabalho com bloqueio, sem duplicar entre processos concorrentes
-- ---------------------------------------------------------------------------
create or replace function app.claim_outbox(p_limit integer) returns setof app.notification_outbox
language sql security definer set search_path = app, pg_temp as $$
  update app.notification_outbox o
     set status = 'processing', locked_at = now(), attempts = o.attempts + 1
   where o.id in (
     select id from app.notification_outbox
      where (status in ('pending', 'failed') and next_attempt_at <= now())
         or (status = 'processing' and locked_at < now() - interval '10 minutes')
      order by next_attempt_at
      limit p_limit
      for update skip locked)
  returning o.*;
$$;

revoke execute on function app.reserve_vehicle(uuid, uuid, timestamptz, text) from public;
revoke execute on function app.close_reservation(uuid, text, text) from public;
revoke execute on function app.expire_reservations() from public;
revoke execute on function app.auto_assign_lead(uuid) from public;
revoke execute on function app.hit_rate_limit(text, integer, integer) from public;
revoke execute on function app.claim_outbox(integer) from public;
revoke execute on function app.vehicle_status_sync_reservations() from public;

grant execute on function app.reserve_vehicle(uuid, uuid, timestamptz, text) to authenticated, service_role;
grant execute on function app.close_reservation(uuid, text, text) to authenticated, service_role;
grant execute on function app.expire_reservations() to service_role;
grant execute on function app.auto_assign_lead(uuid) to service_role, authenticated;
grant execute on function app.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function app.claim_outbox(integer) to service_role;
