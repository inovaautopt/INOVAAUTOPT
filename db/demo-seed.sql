-- DADOS DE DEMONSTRAÇÃO — APENAS DESENVOLVIMENTO E STAGING.
-- Todos os registos têm is_demo = true. A base de dados recusa-os quando app.instance está em
-- 'production' (trigger guard_demo_data) e o site nunca os mostra em produção.
-- Marcas e modelos reais são usados apenas como exemplo de catálogo; preços, quilómetros e
-- descrições são fictícios.

insert into app.branches (id, name, slug, address_line, postal_code, city, latitude, longitude, phone_e164, email, opening_hours, is_demo)
values ('00000000-0000-4000-8000-0000000000b1', 'Stand de demonstração', 'demonstracao', 'Rua de Demonstração, 1', '1000-001', 'Lisboa',
        38.7223, -9.1393, '+351210000000', 'demo@example.com',
        '{"mon":[["09:30","13:00"],["14:30","19:00"]],"tue":[["09:30","13:00"],["14:30","19:00"]],"wed":[["09:30","13:00"],["14:30","19:00"]],"thu":[["09:30","13:00"],["14:30","19:00"]],"fri":[["09:30","13:00"],["14:30","19:00"]],"sat":[["10:00","13:00"]]}',
        true)
on conflict (id) do nothing;

insert into app.vehicles (id, reference, slug, status, is_demo, branch_id, make, model, version_name, price_cents, vat_regime,
  first_registration_year, first_registration_month, mileage_km, fuel, transmission, body_type, power_hp, engine_cc, doors, seats,
  drivetrain, color, origin, description, is_featured,
  ev_range_km, ev_range_standard, ev_battery_kwh, ev_charging, ev_battery_soh_percent, ev_data_source, ev_data_date, history_facts)
values
  ('00000000-0000-4000-8000-0000000000d1', 'DEMO-01', 'demo-peugeot-3008-demo-01', 'available', true, '00000000-0000-4000-8000-0000000000b1',
   'Peugeot', '3008', '1.5 BlueHDi Allure EAT8', 2349000, 'margin_scheme', 2021, 3, 68400, 'diesel', 'automatic', 'suv', 130, 1499, 5, 5,
   'fwd', 'Cinzento', 'national', 'Viatura de demonstração para testar o catálogo. Os dados não são reais.', true,
   null, null, null, null, null, null, null,
   '[{"key":"owners","value":"1","source":"Documento único (demonstração)","verified_on":"2026-10-01"}]'),
  ('00000000-0000-4000-8000-0000000000d2', 'DEMO-02', 'demo-renault-clio-demo-02', 'available', true, '00000000-0000-4000-8000-0000000000b1',
   'Renault', 'Clio', '1.0 TCe Intens', 1299000, 'margin_scheme', 2020, 9, 54200, 'gasoline', 'manual', 'hatchback', 100, 999, 5, 5,
   'fwd', 'Branco', 'national', 'Viatura de demonstração.', false,
   null, null, null, null, null, null, null, '[]'),
  ('00000000-0000-4000-8000-0000000000d3', 'DEMO-03', 'demo-tesla-model-3-demo-03', 'available', true, '00000000-0000-4000-8000-0000000000b1',
   'Tesla', 'Model 3', 'Long Range AWD', 3190000, 'vat_included_deductible', 2022, 6, 41000, 'electric', 'automatic', 'sedan', 498, null, 4, 5,
   'awd', 'Azul', 'imported', 'Viatura de demonstração com dados de bateria fictícios.', true,
   602, 'WLTP', 75.0, 'AC 11 kW, DC até 250 kW', 92, 'Relatório de diagnóstico (demonstração)', '2026-09-20', '[]'),
  ('00000000-0000-4000-8000-0000000000d4', 'DEMO-04', 'demo-bmw-serie-1-demo-04', 'reserved', true, '00000000-0000-4000-8000-0000000000b1',
   'BMW', 'Série 1', '116d Advantage', 1899000, 'margin_scheme', 2019, 11, 97500, 'diesel', 'manual', 'hatchback', 116, 1496, 5, 5,
   'rwd', 'Preto', 'imported', 'Viatura de demonstração reservada.', false,
   null, null, null, null, null, null, null, '[]'),
  ('00000000-0000-4000-8000-0000000000d5', 'DEMO-05', 'demo-toyota-c-hr-demo-05', 'available', true, '00000000-0000-4000-8000-0000000000b1',
   'Toyota', 'C-HR', '1.8 Hybrid Comfort', 2190000, 'margin_scheme', 2020, 4, 72800, 'hybrid', 'automatic', 'suv', 122, 1798, 5, 5,
   'fwd', 'Vermelho', 'national', 'Viatura de demonstração híbrida.', false,
   null, null, null, null, null, null, null, '[]'),
  ('00000000-0000-4000-8000-0000000000d6', 'DEMO-06', 'demo-volkswagen-golf-demo-06', 'sold', true, '00000000-0000-4000-8000-0000000000b1',
   'Volkswagen', 'Golf', '2.0 TDI Life', 2290000, 'margin_scheme', 2021, 1, 81000, 'diesel', 'manual', 'hatchback', 115, 1968, 5, 5,
   'fwd', 'Cinzento', 'national', 'Viatura de demonstração já vendida.', false,
   null, null, null, null, null, null, null, '[]')
on conflict (id) do nothing;

-- Redução de preço real no histórico (para testar a etiqueta "Preço reduzido")
update app.vehicles set price_cents = 2299000 where id = '00000000-0000-4000-8000-0000000000d1' and price_cents = 2349000;

insert into app.vehicle_features (vehicle_id, feature_id)
select '00000000-0000-4000-8000-0000000000d1', id from app.features where name in ('Ar condicionado automático', 'Apple CarPlay', 'Android Auto', 'Câmara de marcha-atrás', 'Cruise control adaptativo', 'Faróis LED', 'Navegação GPS')
on conflict do nothing;
insert into app.vehicle_features (vehicle_id, feature_id)
select '00000000-0000-4000-8000-0000000000d3', id from app.features where name in ('Teto panorâmico', 'Câmara 360°', 'Bancos aquecidos', 'Navegação GPS', 'Carregador sem fios', 'Assistente de manutenção de faixa')
on conflict do nothing;
insert into app.vehicle_features (vehicle_id, feature_id)
select '00000000-0000-4000-8000-0000000000d2', id from app.features where name in ('Ar condicionado', 'Bluetooth', 'Sensores de estacionamento traseiros')
on conflict do nothing;

update app.site_settings set value = value || '{"trade_in":true,"financing":true}'::jsonb where key = 'services';
update app.site_settings set value = value || '{"phoneE164":"+351210000000","whatsappE164":"+351910000000","email":"demo@example.com"}'::jsonb
 where key = 'company' and value ->> 'phoneE164' is null;

insert into app.faqs (scope, question, answer, position, is_published) values
  ('vehicle', 'Posso ver a viatura antes de decidir?', 'Sim. Marca uma visita ou test drive nesta página; confirmamos o horário contigo. (Texto de demonstração.)', 1, true),
  ('trade_in', 'Como é feita a avaliação?', 'Analisamos a informação que envias e confirmamos o valor depois de ver a viatura. (Texto de demonstração.)', 1, true)
on conflict do nothing;
