-- Inova Auto — Supabase Storage
-- vehicle-media : fotografias públicas das viaturas (leitura pública, escrita só pelo servidor)
-- private-media : fotografias de retomas e documentos (privado; acesso por URL temporária gerada
--                 no servidor depois de verificar permissões)
-- Os uploads passam sempre pelo servidor, que valida o tipo real (bytes mágicos), limita o tamanho,
-- remove metadados EXIF e normaliza para WebP/JPEG. Nenhum papel de cliente pode escrever.
--
-- Este ficheiro só tem efeito num projeto Supabase (esquema storage). Localmente é ignorado.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('vehicle-media', 'vehicle-media', true, 8388608, array['image/webp', 'image/jpeg', 'image/avif'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('private-media', 'private-media', false, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    -- Não são criadas políticas para anon/authenticated em storage.objects: só o servidor
    -- (service_role) escreve e lê ficheiros privados. O bucket público só serve leitura.
  end if;
end $$;
