-- Inova Auto — permissões e políticas RLS
--
-- Modelo de acesso (ver docs/SECURITY.md):
--  * anon          → visitantes. Só leem viaturas publicadas (colunas públicas), media dessas
--                    viaturas, instalações ativas, conteúdo publicado e configurações públicas.
--                    Não escrevem diretamente: formulários públicos passam pelo servidor,
--                    que valida, limita pedidos e grava por rotina de confiança.
--  * authenticated → colaboradores. O acesso depende do perfil em app.profiles
--                    (admin / stock_manager / sales). Perfis desativados não veem nada.
--  * O servidor nunca entrega ao navegador credenciais com privilégios.

-- Ativar RLS em TODAS as tabelas do esquema app.
-- O dono das tabelas (postgres) só é usado em migrações e em funções security definer
-- revistas. As rotinas de sistema da aplicação (outbox, webhooks, formulários públicos já
-- validados) usam o papel service_role, que na Supabase tem BYPASSRLS.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t.tablename);
  end loop;
end $$;

grant usage on schema app to service_role;
grant all on all tables in schema app to service_role;
grant all on all sequences in schema app to service_role;
grant execute on all functions in schema app to service_role;
alter default privileges in schema app grant all on tables to service_role;
alter default privileges in schema app grant all on sequences to service_role;
alter default privileges in schema app revoke execute on functions from public;

-- Revogar tudo e conceder apenas o necessário
revoke all on all tables in schema app from anon, authenticated;
revoke all on all sequences in schema app from anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on all functions in schema app to service_role;

grant execute on function app.current_staff_role(), app.is_staff(), app.has_role(text[]),
  app.can_see_unassigned(), app.is_production() to anon, authenticated;
grant execute on function app.next_vehicle_reference() to authenticated;
grant usage on sequence app.vehicle_reference_seq to authenticated;

-- ---------------------------------------------------------------------------
-- Viaturas — leitura pública limitada a colunas públicas e estados publicados
-- ---------------------------------------------------------------------------
grant select (
  id, reference, slug, status, is_demo, branch_id, make, model, version_name, price_cents, vat_regime,
  first_registration_year, first_registration_month, mileage_km, fuel, transmission, body_type,
  power_hp, engine_cc, doors, seats, drivetrain, color, origin,
  ev_range_km, ev_range_standard, ev_battery_kwh, ev_charging, ev_battery_soh_percent, ev_data_source, ev_data_date,
  history_facts, description, warranty_text, video_url, is_featured, published_at, sold_at, updated_at
) on app.vehicles to anon;

create policy vehicles_public_read on app.vehicles for select to anon
  using (status in ('available', 'reserved', 'sold') and published_at is not null
         and (not is_demo or not app.is_production()));

grant select, insert, update, delete on app.vehicles to authenticated;
create policy vehicles_staff_read on app.vehicles for select to authenticated
  using (app.is_staff());
create policy vehicles_stock_insert on app.vehicles for insert to authenticated
  with check (app.has_role('admin', 'stock_manager'));
create policy vehicles_stock_update on app.vehicles for update to authenticated
  using (app.has_role('admin', 'stock_manager'))
  with check (app.has_role('admin', 'stock_manager'));
create policy vehicles_admin_delete on app.vehicles for delete to authenticated
  using (app.has_role('admin'));

grant select on app.vehicle_slug_redirects to anon, authenticated;
create policy slug_redirects_read on app.vehicle_slug_redirects for select to anon, authenticated using (true);

-- Dados privados: nunca para anon; só admin e gestor de stock
grant select, insert, update, delete on app.vehicle_private_details to authenticated;
create policy vehicle_private_stock on app.vehicle_private_details for all to authenticated
  using (app.has_role('admin', 'stock_manager'))
  with check (app.has_role('admin', 'stock_manager'));

grant select on app.vehicle_media to anon;
create policy vehicle_media_public_read on app.vehicle_media for select to anon
  using (exists (select 1 from app.vehicles v where v.id = vehicle_id
                 and v.status in ('available', 'reserved', 'sold') and v.published_at is not null
                 and (not v.is_demo or not app.is_production())));
grant select, insert, update, delete on app.vehicle_media to authenticated;
create policy vehicle_media_staff_read on app.vehicle_media for select to authenticated using (app.is_staff());
create policy vehicle_media_stock_write on app.vehicle_media for all to authenticated
  using (app.has_role('admin', 'stock_manager'))
  with check (app.has_role('admin', 'stock_manager'));

grant select on app.features, app.vehicle_features to anon;
create policy features_public_read on app.features for select to anon using (true);
create policy vehicle_features_public_read on app.vehicle_features for select to anon
  using (exists (select 1 from app.vehicles v where v.id = vehicle_id
                 and v.status in ('available', 'reserved', 'sold') and v.published_at is not null));
grant select, insert, update, delete on app.features, app.vehicle_features to authenticated;
create policy features_staff_read on app.features for select to authenticated using (app.is_staff());
create policy features_stock_write on app.features for all to authenticated
  using (app.has_role('admin', 'stock_manager')) with check (app.has_role('admin', 'stock_manager'));
create policy vehicle_features_staff_read on app.vehicle_features for select to authenticated using (app.is_staff());
create policy vehicle_features_stock_write on app.vehicle_features for all to authenticated
  using (app.has_role('admin', 'stock_manager')) with check (app.has_role('admin', 'stock_manager'));

grant select on app.vehicle_price_history, app.vehicle_status_history to authenticated;
-- Reduções de preço mostradas no site resultam do histórico real (sem autor da alteração)
grant select (vehicle_id, old_price_cents, new_price_cents, changed_at) on app.vehicle_price_history to anon;
create policy price_history_public on app.vehicle_price_history for select to anon
  using (exists (select 1 from app.vehicles v where v.id = vehicle_id
                 and v.status in ('available', 'reserved', 'sold') and v.published_at is not null));
create policy price_history_staff on app.vehicle_price_history for select to authenticated using (app.is_staff());
create policy status_history_staff on app.vehicle_status_history for select to authenticated using (app.is_staff());

grant select, insert, update on app.vehicle_reservations to authenticated;
create policy reservations_staff_read on app.vehicle_reservations for select to authenticated using (app.is_staff());
create policy reservations_write on app.vehicle_reservations for insert to authenticated
  with check (app.has_role('admin', 'stock_manager', 'sales'));
create policy reservations_update on app.vehicle_reservations for update to authenticated
  using (app.has_role('admin', 'stock_manager', 'sales')) with check (app.has_role('admin', 'stock_manager', 'sales'));

-- ---------------------------------------------------------------------------
-- Instalações, perfis e ausências
-- ---------------------------------------------------------------------------
grant select (id, name, slug, address_line, postal_code, city, latitude, longitude, phone_e164, email,
              opening_hours, maps_url, is_active, is_demo) on app.branches to anon;
create policy branches_public_read on app.branches for select to anon
  using (is_active and (not is_demo or not app.is_production()));
grant select, insert, update, delete on app.branches to authenticated;
create policy branches_staff_read on app.branches for select to authenticated using (app.is_staff());
create policy branches_admin_write on app.branches for all to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

grant select on app.branch_closures to anon;
create policy closures_public_read on app.branch_closures for select to anon using (true);
grant select, insert, update, delete on app.branch_closures to authenticated;
create policy closures_staff_read on app.branch_closures for select to authenticated using (app.is_staff());
create policy closures_admin_write on app.branch_closures for all to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

grant select, insert, update on app.profiles to authenticated;
-- Cada colaborador vê o próprio perfil (mesmo sem MFA, para concluir o login); colegas ativos são visíveis a staff.
create policy profiles_self_read on app.profiles for select to authenticated using (id = auth.uid());
create policy profiles_staff_read on app.profiles for select to authenticated using (app.is_staff());
create policy profiles_admin_insert on app.profiles for insert to authenticated with check (app.has_role('admin'));
create policy profiles_admin_update on app.profiles for update to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

grant select, insert, update, delete on app.staff_absences to authenticated;
create policy absences_staff_read on app.staff_absences for select to authenticated using (app.is_staff());
create policy absences_write on app.staff_absences for all to authenticated
  using (app.has_role('admin') or profile_id = auth.uid())
  with check (app.has_role('admin') or (profile_id = auth.uid() and app.is_staff()));

-- ---------------------------------------------------------------------------
-- CRM — visitantes não leem nada. Gestor de stock não vê contactos por defeito.
-- Vendedor vê os seus contactos e, quando autorizado, a fila sem responsável.
-- ---------------------------------------------------------------------------
create or replace function app.can_access_lead(p_lead_id uuid) returns boolean
language sql stable security definer set search_path = app, auth, pg_temp as $$
  select case
    when app.has_role('admin') then true
    when app.has_role('sales') then exists (
      select 1 from app.leads l where l.id = p_lead_id
        and (l.assigned_to = auth.uid() or (l.assigned_to is null and app.can_see_unassigned())))
    else false
  end;
$$;
grant execute on function app.can_access_lead(uuid) to authenticated;

grant select, insert, update on app.leads to authenticated;
create policy leads_admin_all on app.leads for select to authenticated using (app.has_role('admin'));
create policy leads_sales_read on app.leads for select to authenticated
  using (app.has_role('sales') and (assigned_to = auth.uid() or (assigned_to is null and app.can_see_unassigned())));
create policy leads_staff_insert on app.leads for insert to authenticated
  with check (app.has_role('admin', 'sales'));
create policy leads_admin_update on app.leads for update to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));
-- Vendedor atualiza os seus contactos ou assume um da fila (atribuindo-o a si próprio)
create policy leads_sales_update on app.leads for update to authenticated
  using (app.has_role('sales') and (assigned_to = auth.uid() or (assigned_to is null and app.can_see_unassigned())))
  with check (app.has_role('sales') and assigned_to = auth.uid());

grant select, insert on app.lead_activities to authenticated;
create policy lead_activities_read on app.lead_activities for select to authenticated using (app.can_access_lead(lead_id));
create policy lead_activities_insert on app.lead_activities for insert to authenticated
  with check (app.can_access_lead(lead_id) and actor_id = auth.uid());

grant select, insert on app.contact_permissions to authenticated;
create policy contact_permissions_read on app.contact_permissions for select to authenticated
  using (app.has_role('admin') or (lead_id is not null and app.can_access_lead(lead_id)));
create policy contact_permissions_insert on app.contact_permissions for insert to authenticated
  with check (app.has_role('admin', 'sales') and recorded_by = auth.uid());

grant select, insert, update on app.appointments to authenticated;
create policy appointments_read on app.appointments for select to authenticated using (app.can_access_lead(lead_id));
create policy appointments_insert on app.appointments for insert to authenticated
  with check (app.can_access_lead(lead_id));
create policy appointments_update on app.appointments for update to authenticated
  using (app.can_access_lead(lead_id)) with check (app.can_access_lead(lead_id));

grant select on app.trade_in_requests, app.trade_in_media to authenticated;
create policy trade_in_read on app.trade_in_requests for select to authenticated using (app.can_access_lead(lead_id));
create policy trade_in_media_read on app.trade_in_media for select to authenticated
  using (exists (select 1 from app.trade_in_requests t where t.id = trade_in_id and app.can_access_lead(t.lead_id)));

grant select, update on app.conversations to authenticated;
create policy conversations_read on app.conversations for select to authenticated
  using (app.has_role('admin') or (app.has_role('sales') and (assigned_to = auth.uid() or (assigned_to is null and app.can_see_unassigned()))));
create policy conversations_update on app.conversations for update to authenticated
  using (app.has_role('admin') or (app.has_role('sales') and (assigned_to = auth.uid() or (assigned_to is null and app.can_see_unassigned()))))
  with check (app.has_role('admin') or (app.has_role('sales') and assigned_to = auth.uid()));

grant select on app.messages to authenticated;
create policy messages_read on app.messages for select to authenticated
  using (exists (select 1 from app.conversations c where c.id = conversation_id
    and (app.has_role('admin') or (app.has_role('sales') and (c.assigned_to = auth.uid() or (c.assigned_to is null and app.can_see_unassigned()))))));

-- Pesquisas guardadas e operações internas: só administradores leem
grant select on app.saved_searches, app.notification_outbox, app.integration_events, app.import_jobs to authenticated;
create policy saved_searches_admin on app.saved_searches for select to authenticated using (app.has_role('admin'));
create policy outbox_admin on app.notification_outbox for select to authenticated using (app.has_role('admin'));
create policy integration_events_admin on app.integration_events for select to authenticated using (app.has_role('admin'));
create policy import_jobs_read on app.import_jobs for select to authenticated using (app.has_role('admin', 'stock_manager'));

-- ---------------------------------------------------------------------------
-- Conteúdo
-- ---------------------------------------------------------------------------
grant select (id, slug, kind, title, summary, body, status, published_at, updated_at) on app.site_pages to anon;
create policy site_pages_public on app.site_pages for select to anon using (status = 'published');
grant select, insert, update, delete on app.site_pages to authenticated;
create policy site_pages_staff_read on app.site_pages for select to authenticated using (app.is_staff());
create policy site_pages_write on app.site_pages for all to authenticated
  using (app.has_role('admin', 'stock_manager')) with check (app.has_role('admin', 'stock_manager'));

grant select (id, scope, question, answer, position, is_published) on app.faqs to anon;
create policy faqs_public on app.faqs for select to anon using (is_published);
grant select, insert, update, delete on app.faqs to authenticated;
create policy faqs_staff_read on app.faqs for select to authenticated using (app.is_staff());
create policy faqs_write on app.faqs for all to authenticated
  using (app.has_role('admin', 'stock_manager')) with check (app.has_role('admin', 'stock_manager'));

grant select (key, value, is_public) on app.site_settings to anon;
create policy site_settings_public on app.site_settings for select to anon using (is_public);
grant select, insert, update on app.site_settings to authenticated;
create policy site_settings_staff_read on app.site_settings for select to authenticated using (app.is_staff());
create policy site_settings_admin_write on app.site_settings for all to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

grant select on app.audit_logs to authenticated;
create policy audit_admin_read on app.audit_logs for select to authenticated using (app.has_role('admin'));
-- Sem políticas de insert/update/delete: audit_logs só é escrito por triggers/funções security definer.

-- app.instance e rate_limits: sem acesso para anon/authenticated.
grant select on app.instance to authenticated;
create policy instance_admin_read on app.instance for select to authenticated using (app.has_role('admin'));
