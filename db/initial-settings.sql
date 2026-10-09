-- Configuração inicial da Inova Auto (dados públicos já usados no Instagram @inovaautopt).
-- Aplicar UMA vez no projeto Supabase de produção (SQL Editor) depois das migrações.
-- Tudo isto pode depois ser alterado no painel em Configuração.
update app.site_settings
   set value = value || jsonb_build_object(
     'tradeName', 'Inova Auto',
     'phoneE164', '+351929218224',
     'whatsappE164', '+351929218224',
     'instagramUrl', 'https://www.instagram.com/inovaautopt/'
   )
 where key = 'company';

-- Serviços confirmados nas publicações: possibilidade de crédito (no site apenas como pedido
-- de contacto, sem mensalidades nem taxas). Retomas e restantes serviços ficam desligados até
-- confirmação do proprietário.
update app.site_settings set value = value || '{"financing": true}'::jsonb where key = 'services';
