-- Inova Auto — esquema principal
-- Todas as tabelas da aplicação ficam no esquema "app", que NÃO é exposto pela Data API
-- (PostgREST) da Supabase. Mesmo assim, RLS está ativo em todas as tabelas como defesa em
-- profundidade e é testado em tests/db.
--
-- Convenções:
--  * UUID como chave primária (gen_random_uuid()).
--  * Valores monetários em cêntimos (bigint). NULL = desconhecido; nunca 0 por omissão.
--  * Datas/horas em timestamptz (UTC). Apresentação em Europe/Lisbon na aplicação.
--  * created_at / updated_at e "version" para controlo de concorrência otimista.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Instância / ambiente (impede dados de demonstração em produção)
-- ---------------------------------------------------------------------------
create table app.instance (
  singleton boolean primary key default true check (singleton),
  environment text not null default 'development'
    check (environment in ('development', 'staging', 'production')),
  updated_at timestamptz not null default now()
);
insert into app.instance (singleton) values (true) on conflict do nothing;

create or replace function app.is_production() returns boolean
language sql stable security definer set search_path = app, pg_temp as $$
  select coalesce((select environment = 'production' from app.instance limit 1), false);
$$;

create or replace function app.guard_demo_data() returns trigger
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if new.is_demo and app.is_production() then
    raise exception 'Dados de demonstração não são permitidos em produção (%).', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and to_jsonb(new) ? 'version' then
    if new.version is distinct from old.version then
      -- A aplicação não deve alterar a versão diretamente; a versão é sempre incrementada aqui.
      new.version := old.version;
    end if;
    new.version := old.version + 1;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Instalações (stands) e colaboradores
-- ---------------------------------------------------------------------------
create table app.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  address_line text,
  postal_code text check (postal_code is null or postal_code ~ '^\d{4}-\d{3}$'),
  city text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9]\d{6,14}$'),
  email text,
  -- {"mon":[["09:30","13:00"],["14:30","19:00"]], ...}; dias sem entrada = fechado
  opening_hours jsonb not null default '{}'::jsonb,
  maps_url text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table app.branch_closures (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references app.branches(id) on delete cascade,
  closed_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (branch_id, closed_on)
);

-- auth.users é gerido pela Supabase Auth. Não existe inscrição pública de colaboradores:
-- um perfil só existe se for criado por um administrador ou pelo script de arranque.
create table app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'stock_manager', 'sales')),
  is_active boolean not null default true,
  -- distribuição automática de contactos
  receives_leads boolean not null default true,
  last_assigned_at timestamptz,
  can_see_unassigned boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table app.staff_absences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references app.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  note text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- ---------------------------------------------------------------------------
-- Funções de identidade usadas pelas políticas RLS
-- ---------------------------------------------------------------------------
-- Devolve o perfil do utilizador autenticado, só se estiver ativo. Perfis "admin" só contam
-- quando a sessão tem MFA (aal2), como exigido para perfis privilegiados.
create or replace function app.current_staff_role() returns text
language sql stable security definer set search_path = app, auth, pg_temp as $$
  select p.role
  from app.profiles p
  where p.id = auth.uid()
    and p.is_active
    and (
      p.role <> 'admin'
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    )
  limit 1;
$$;

create or replace function app.is_staff() returns boolean
language sql stable as $$ select app.current_staff_role() is not null $$;

create or replace function app.has_role(variadic roles text[]) returns boolean
language sql stable as $$ select coalesce(app.current_staff_role() = any(roles), false) $$;

create or replace function app.can_see_unassigned() returns boolean
language sql stable security definer set search_path = app, auth, pg_temp as $$
  select coalesce((select can_see_unassigned from app.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Viaturas
-- ---------------------------------------------------------------------------
create sequence app.vehicle_reference_seq start 1;

create or replace function app.next_vehicle_reference() returns text
language sql volatile security definer set search_path = app, pg_temp as $$
  select 'IA-' || lpad(nextval('app.vehicle_reference_seq')::text, 4, '0');
$$;

create table app.vehicles (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default app.next_vehicle_reference(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'draft'
    check (status in ('draft', 'available', 'reserved', 'sold', 'archived')),
  is_demo boolean not null default false,
  branch_id uuid references app.branches(id),

  make text not null,
  model text not null,
  version_name text,
  price_cents bigint check (price_cents is null or price_cents > 0),
  -- Tratamento de IVA tem de ser aprovado; "unknown" bloqueia a publicação.
  vat_regime text not null default 'unknown'
    check (vat_regime in ('unknown', 'vat_included_deductible', 'margin_scheme')),
  first_registration_year smallint check (first_registration_year between 1950 and 2100),
  first_registration_month smallint check (first_registration_month between 1 and 12),
  mileage_km integer check (mileage_km is null or mileage_km >= 0),
  fuel text check (fuel in ('gasoline', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'lpg', 'other')),
  transmission text check (transmission in ('manual', 'automatic')),
  body_type text check (body_type in ('city', 'hatchback', 'sedan', 'wagon', 'suv', 'mpv', 'coupe', 'convertible', 'pickup', 'van', 'other')),
  power_hp smallint check (power_hp is null or power_hp > 0),
  engine_cc integer check (engine_cc is null or engine_cc > 0),
  doors smallint check (doors is null or doors between 1 and 7),
  seats smallint check (seats is null or seats between 1 and 9),
  drivetrain text check (drivetrain in ('fwd', 'rwd', 'awd')),
  color text,
  origin text check (origin in ('national', 'imported')),

  -- Elétricos: só publicados com fonte e data
  ev_range_km integer check (ev_range_km is null or ev_range_km > 0),
  ev_range_standard text,
  ev_battery_kwh numeric(5,1) check (ev_battery_kwh is null or ev_battery_kwh > 0),
  ev_charging text,
  ev_battery_soh_percent numeric(4,1) check (ev_battery_soh_percent > 0 and ev_battery_soh_percent <= 100),
  ev_data_source text,
  ev_data_date date,

  -- Histórico confirmado: [{"key":"owners","value":"2","source":"DUA","verified_on":"2026-10-01"}]
  history_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(history_facts) = 'array'),

  description text,
  warranty_text text,
  video_url text check (video_url is null or video_url ~ '^https://'),
  is_featured boolean not null default false,

  published_at timestamptz,
  sold_at timestamptz,
  archived_at timestamptz,

  created_by uuid references app.profiles(id),
  updated_by uuid references app.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,

  check ((ev_range_km is null) or (ev_range_standard is not null and ev_data_source is not null and ev_data_date is not null)),
  check ((ev_battery_soh_percent is null) or (ev_data_source is not null and ev_data_date is not null))
);

-- Regras de publicação aplicadas na própria base de dados
create or replace function app.vehicle_publish_rules() returns trigger
language plpgsql as $$
begin
  if new.status in ('available', 'reserved') then
    if new.price_cents is null then
      raise exception 'Uma viatura disponível precisa de preço.' using errcode = 'check_violation';
    end if;
    if new.vat_regime = 'unknown' then
      raise exception 'Indica o tratamento de IVA antes de publicar.' using errcode = 'check_violation';
    end if;
    if new.first_registration_year is null or new.mileage_km is null or new.fuel is null or new.transmission is null then
      raise exception 'Ano, quilometragem, combustível e caixa são obrigatórios para publicar.' using errcode = 'check_violation';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  if new.status = 'sold' and new.sold_at is null then
    new.sold_at := now();
  end if;
  if new.status <> 'sold' then
    new.sold_at := null;
  end if;
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;
  if new.status = 'sold' or new.status = 'archived' or new.status = 'draft' then
    new.is_featured := false;
  end if;
  return new;
end $$;

create trigger vehicles_publish_rules before insert or update on app.vehicles
  for each row execute function app.vehicle_publish_rules();
create trigger vehicles_touch before update on app.vehicles
  for each row execute function app.touch_updated_at();
create trigger vehicles_demo_guard before insert or update on app.vehicles
  for each row execute function app.guard_demo_data();

create index vehicles_status_idx on app.vehicles (status, published_at desc, id);
create index vehicles_price_idx on app.vehicles (price_cents, id) where status in ('available', 'reserved');
create index vehicles_year_idx on app.vehicles (first_registration_year desc, id) where status in ('available', 'reserved');
create index vehicles_km_idx on app.vehicles (mileage_km, id) where status in ('available', 'reserved');
create index vehicles_make_model_idx on app.vehicles (lower(make), lower(model));

create table app.vehicle_slug_redirects (
  old_slug text primary key,
  vehicle_id uuid not null references app.vehicles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function app.vehicle_slug_history() returns trigger
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if new.slug is distinct from old.slug then
    insert into app.vehicle_slug_redirects (old_slug, vehicle_id) values (old.slug, old.id)
      on conflict (old_slug) do update set vehicle_id = excluded.vehicle_id;
    delete from app.vehicle_slug_redirects where old_slug = new.slug;
  end if;
  return new;
end $$;
create trigger vehicles_slug_history after update of slug on app.vehicles
  for each row execute function app.vehicle_slug_history();

create table app.vehicle_private_details (
  vehicle_id uuid primary key references app.vehicles(id) on delete cascade,
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  plate text,
  purchase_cost_cents bigint check (purchase_cost_cents is null or purchase_cost_cents >= 0),
  internal_notes text,
  documents jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create trigger vehicle_private_touch before update on app.vehicle_private_details
  for each row execute function app.touch_updated_at();

create table app.vehicle_media (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references app.vehicles(id) on delete cascade,
  kind text not null default 'image' check (kind in ('image', 'video')),
  storage_path text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  alt_text text,
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index vehicle_media_vehicle_idx on app.vehicle_media (vehicle_id, position);
create unique index vehicle_media_one_cover on app.vehicle_media (vehicle_id) where is_cover;

create table app.features (
  id uuid primary key default gen_random_uuid(),
  feature_group text not null check (feature_group in ('comfort', 'safety', 'multimedia', 'exterior', 'interior', 'other')),
  name text not null,
  unique (feature_group, name)
);

create table app.vehicle_features (
  vehicle_id uuid not null references app.vehicles(id) on delete cascade,
  feature_id uuid not null references app.features(id) on delete cascade,
  primary key (vehicle_id, feature_id)
);

create table app.vehicle_price_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references app.vehicles(id) on delete cascade,
  old_price_cents bigint,
  new_price_cents bigint,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index vehicle_price_history_vehicle_idx on app.vehicle_price_history (vehicle_id, changed_at desc);

create table app.vehicle_status_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references app.vehicles(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index vehicle_status_history_vehicle_idx on app.vehicle_status_history (vehicle_id, changed_at desc);

create or replace function app.vehicle_history() returns trigger
language plpgsql security definer set search_path = app, auth, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into app.vehicle_status_history (vehicle_id, old_status, new_status, changed_by)
      values (new.id, null, new.status, auth.uid());
    if new.price_cents is not null then
      insert into app.vehicle_price_history (vehicle_id, old_price_cents, new_price_cents, changed_by)
        values (new.id, null, new.price_cents, auth.uid());
    end if;
  else
    if new.status is distinct from old.status then
      insert into app.vehicle_status_history (vehicle_id, old_status, new_status, changed_by)
        values (new.id, old.status, new.status, auth.uid());
    end if;
    if new.price_cents is distinct from old.price_cents then
      insert into app.vehicle_price_history (vehicle_id, old_price_cents, new_price_cents, changed_by)
        values (new.id, old.price_cents, new.price_cents, auth.uid());
    end if;
  end if;
  return null;
end $$;
create trigger vehicles_history after insert or update on app.vehicles
  for each row execute function app.vehicle_history();

-- ---------------------------------------------------------------------------
-- Contactos (CRM)
-- ---------------------------------------------------------------------------
create table app.leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('info', 'visit', 'trade_in', 'financing', 'whatsapp', 'phone', 'walk_in', 'other')),
  source text not null check (source in ('website', 'whatsapp', 'phone', 'walk_in', 'email', 'other')),
  vehicle_id uuid references app.vehicles(id) on delete set null,
  vehicle_reference text, -- referência no momento do pedido (mantém-se se a viatura for apagada)
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9]\d{6,14}$'),
  preferred_channel text check (preferred_channel in ('phone', 'email', 'whatsapp')),
  message text check (message is null or char_length(message) <= 4000),
  status text not null default 'new'
    check (status in ('new', 'assigned', 'contacted', 'visit_scheduled', 'proposal_sent', 'won', 'lost', 'archived')),
  assigned_to uuid references app.profiles(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  lost_reason text,
  first_response_at timestamptz,
  idempotency_key text unique,
  page_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check (email is not null or phone_e164 is not null),
  check (status <> 'lost' or lost_reason is not null)
);
create index leads_status_idx on app.leads (status, created_at desc);
create index leads_assigned_idx on app.leads (assigned_to, status, created_at desc);
create index leads_vehicle_idx on app.leads (vehicle_id);
create index leads_phone_idx on app.leads (phone_e164);
create index leads_email_idx on app.leads (lower(email));
create trigger leads_touch before update on app.leads
  for each row execute function app.touch_updated_at();
create trigger leads_demo_guard before insert or update on app.leads
  for each row execute function app.guard_demo_data();

create table app.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references app.leads(id) on delete cascade,
  actor_id uuid references app.profiles(id) on delete set null,
  kind text not null check (kind in ('created', 'note', 'status_change', 'assignment', 'call', 'email', 'whatsapp', 'proposal', 'appointment', 'system')),
  body text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on app.lead_activities (lead_id, created_at desc);

create table app.contact_permissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references app.leads(id) on delete cascade,
  contact_value text not null, -- email ou telefone E.164
  channel text not null check (channel in ('email', 'phone', 'whatsapp', 'sms')),
  purpose text not null check (purpose in ('request_response', 'whatsapp_contact', 'marketing', 'search_alerts')),
  status text not null check (status in ('granted', 'withdrawn')),
  text_version text not null,
  source text not null, -- ex.: 'website:/viaturas/x', 'whatsapp:STOP', 'admin'
  recorded_by uuid references app.profiles(id),
  created_at timestamptz not null default now()
);
create index contact_permissions_contact_idx on app.contact_permissions (contact_value, channel, purpose, created_at desc);

-- ---------------------------------------------------------------------------
-- Reservas comerciais (sem pagamento) e marcações
-- ---------------------------------------------------------------------------
create table app.vehicle_reservations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references app.vehicles(id) on delete cascade,
  lead_id uuid references app.leads(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'converted')),
  expires_at timestamptz not null,
  note text,
  created_by uuid references app.profiles(id),
  closed_by uuid references app.profiles(id),
  closed_reason text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
-- Nunca duas reservas ativas para a mesma viatura
create unique index vehicle_reservations_one_active on app.vehicle_reservations (vehicle_id) where status = 'active';

create table app.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references app.leads(id) on delete cascade,
  vehicle_id uuid references app.vehicles(id) on delete set null,
  branch_id uuid references app.branches(id),
  kind text not null check (kind in ('visit', 'test_drive')),
  requested_date date not null,
  requested_period text not null check (requested_period in ('morning', 'afternoon')),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  confirmed_start timestamptz,
  confirmed_end timestamptz,
  staff_id uuid references app.profiles(id),
  confirmed_by uuid references app.profiles(id),
  cancel_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check (status <> 'confirmed' or (confirmed_start is not null and confirmed_end is not null and confirmed_end > confirmed_start)),
  -- Uma viatura não pode ter duas marcações confirmadas sobrepostas (ex.: dois test drives)
  constraint appointments_vehicle_no_overlap exclude using gist (
    vehicle_id with =, tstzrange(confirmed_start, confirmed_end, '[)') with &&
  ) where (status = 'confirmed' and vehicle_id is not null),
  -- Um vendedor não pode ter duas marcações confirmadas sobrepostas
  constraint appointments_staff_no_overlap exclude using gist (
    staff_id with =, tstzrange(confirmed_start, confirmed_end, '[)') with &&
  ) where (status = 'confirmed' and staff_id is not null)
);
create index appointments_status_idx on app.appointments (status, requested_date);
create trigger appointments_touch before update on app.appointments
  for each row execute function app.touch_updated_at();
create trigger appointments_demo_guard before insert or update on app.appointments
  for each row execute function app.guard_demo_data();

-- ---------------------------------------------------------------------------
-- Retomas
-- ---------------------------------------------------------------------------
create table app.trade_in_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references app.leads(id) on delete cascade,
  make text not null,
  model text not null,
  year smallint check (year between 1950 and 2100),
  mileage_km integer check (mileage_km is null or mileage_km >= 0),
  fuel text check (fuel in ('gasoline', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'lpg', 'other')),
  condition_text text check (condition_text is null or char_length(condition_text) <= 2000),
  plate text, -- só quando necessário e justificado; não recolhido no formulário público inicial
  created_at timestamptz not null default now()
);

create table app.trade_in_media (
  id uuid primary key default gen_random_uuid(),
  trade_in_id uuid not null references app.trade_in_requests(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- WhatsApp: conversas e mensagens
-- ---------------------------------------------------------------------------
create table app.conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  contact_wa_id text not null,
  contact_phone_e164 text,
  contact_name text,
  lead_id uuid references app.leads(id) on delete set null,
  assigned_to uuid references app.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (channel, contact_wa_id)
);
create trigger conversations_touch before update on app.conversations
  for each row execute function app.touch_updated_at();

create table app.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  provider_message_id text unique,
  message_type text not null default 'text',
  body text,
  template_name text,
  template_language text,
  status text not null default 'pending'
    check (status in ('received', 'pending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'uncertain')),
  status_at timestamptz,
  error_code text,
  error_message text,
  sent_by uuid references app.profiles(id),
  idempotency_key text unique,
  provider_timestamp timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on app.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Pesquisas guardadas (alertas por email)
-- ---------------------------------------------------------------------------
create table app.saved_searches (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  criteria jsonb not null,
  criteria_hash text not null,
  channel text not null default 'email' check (channel in ('email')),
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled')),
  verify_token_hash text not null unique,
  unsubscribe_token_hash text not null unique,
  verified_at timestamptz,
  cancelled_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, criteria_hash)
);

-- ---------------------------------------------------------------------------
-- Notificações (outbox), eventos de integração e importações
-- ---------------------------------------------------------------------------
create table app.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null, -- ex.: lead_received_customer, lead_received_staff, appointment_update, search_alert, whatsapp_reply
  channel text not null check (channel in ('email', 'whatsapp')),
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'dead', 'skipped')),
  attempts integer not null default 0,
  max_attempts integer not null default 6,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_outbox_due_idx on app.notification_outbox (status, next_attempt_at) where status in ('pending', 'failed', 'processing');

create table app.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_key)
);
create index integration_events_pending_idx on app.integration_events (status, received_at) where status in ('received', 'failed');

create table app.import_jobs (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  mode text not null check (mode in ('partial_update', 'full_snapshot')),
  status text not null default 'previewed' check (status in ('previewed', 'committed', 'failed', 'discarded')),
  created_by uuid references app.profiles(id),
  rows_total integer not null default 0,
  rows_created integer not null default 0,
  rows_updated integer not null default 0,
  rows_rejected integer not null default 0,
  report jsonb not null default '[]'::jsonb,
  file_sha256 text not null,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Conteúdo e configuração
-- ---------------------------------------------------------------------------
create table app.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
  kind text not null check (kind in ('page', 'guide', 'legal')),
  title text not null,
  summary text,
  body text not null default '', -- Markdown restrito; sanitizado na apresentação
  status text not null default 'draft' check (status in ('draft', 'needs_validation', 'published')),
  published_at timestamptz,
  updated_by uuid references app.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create trigger site_pages_touch before update on app.site_pages
  for each row execute function app.touch_updated_at();

create table app.faqs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'general' check (scope in ('general', 'vehicle', 'financing', 'trade_in')),
  question text not null,
  answer text not null,
  position integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.site_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references app.profiles(id),
  updated_at timestamptz not null default now()
);

create table app.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------------------
-- Auditoria (apenas inserção por rotinas de confiança)
-- ---------------------------------------------------------------------------
create table app.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on app.audit_logs (entity, entity_id, created_at desc);
create index audit_logs_created_idx on app.audit_logs (created_at desc);

create or replace function app.write_audit(p_action text, p_entity text, p_entity_id text, p_data jsonb)
returns void language sql security definer set search_path = app, auth, pg_temp as $$
  insert into app.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb));
$$;

-- Auditoria automática de alterações em tabelas sensíveis.
-- Campos privados (VIN, matrícula, custos) nunca são copiados para o registo.
create or replace function app.audit_row_change() returns trigger
language plpgsql security definer set search_path = app, auth, pg_temp as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_changes jsonb := '{}'::jsonb;
  k text;
  v_redacted text[] := array['vin', 'plate', 'purchase_cost_cents', 'internal_notes', 'documents',
                              'email', 'phone_e164', 'message', 'name', 'body', 'contact_value'];
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'version') and (v_new -> k) is distinct from (v_old -> k) then
        if k = any(v_redacted) then
          v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('changed', true));
        else
          v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
        end if;
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := jsonb_build_object('created', true);
  else
    v_changes := jsonb_build_object('deleted', true);
  end if;
  insert into app.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'vehicle_id', v_old ->> 'vehicle_id', v_new ->> 'key', v_old ->> 'key'),
          v_changes);
  return null;
end $$;

create trigger audit_vehicles after insert or update or delete on app.vehicles
  for each row execute function app.audit_row_change();
create trigger audit_vehicle_private after insert or update or delete on app.vehicle_private_details
  for each row execute function app.audit_row_change();
create trigger audit_leads after insert or update or delete on app.leads
  for each row execute function app.audit_row_change();
create trigger audit_profiles after insert or update or delete on app.profiles
  for each row execute function app.audit_row_change();
create trigger audit_appointments after insert or update or delete on app.appointments
  for each row execute function app.audit_row_change();
create trigger audit_reservations after insert or update or delete on app.vehicle_reservations
  for each row execute function app.audit_row_change();
create trigger audit_site_settings after insert or update or delete on app.site_settings
  for each row execute function app.audit_row_change();
create trigger audit_site_pages after insert or update or delete on app.site_pages
  for each row execute function app.audit_row_change();
create trigger audit_import_jobs after insert or update on app.import_jobs
  for each row execute function app.audit_row_change();
