# Cópias de segurança e recuperação

> As cópias da base de dados da Supabase **não incluem** os ficheiros guardados no Storage.
> Base e ficheiros são copiados separadamente. Ter um plano pago não é, por si só, ter backup:
> é preciso confirmar a retenção e testar o restauro.

## Base de dados
- Plano Pro da Supabase: cópia diária com retenção de 7 dias (confirmar na página do projeto →
  *Database → Backups*). O plano gratuito não inclui cópias.
- Cópia própria fora da Supabase (semanal, recomendada):
  ```bash
  pg_dump "<DATABASE_URL de ligação direta, porta 5432>" --schema=app --format=custom -f inova-$(date +%F).dump
  ```
  Guardar num armazenamento da empresa (ex.: Google Drive/OneDrive da empresa), cifrado.

## Ficheiros (Storage)
- Copiar os buckets `vehicle-media` e `private-media` (ex.: `rclone` com o endpoint S3 da Supabase,
  credenciais S3 criadas em *Storage → Settings*) para armazenamento da empresa, semanalmente.

## Restauro de teste (trimestral, em staging)
1. Criar/limpar o projeto de staging e aplicar as migrações.
2. `pg_restore --data-only --schema=app -d "<staging>" inova-AAAA-MM-DD.dump`
3. Copiar os ficheiros para os buckets de staging.
4. Abrir o site de staging e confirmar viaturas, fotografias e contactos. Registar data e resultado.

## Objetivos (a definir com o proprietário)
| Objetivo | Proposta inicial |
| --- | --- |
| Perda máxima de dados (RPO) | 24 h (cópia diária) |
| Tempo de reposição (RTO) | 4 h em horário de expediente |

## Procedimentos
- **Site em baixo**: verificar `/api/health`; estado da Vercel e da Supabase; se o problema veio de
  um deployment, *Instant Rollback* na Vercel (não reverte a base de dados — as migrações são
  aditivas e compatíveis com a versão anterior).
- **Perda de dados**: restaurar a cópia mais recente (*Database → Backups* ou `pg_restore`) para um
  projeto novo, validar e só depois apontar a aplicação.
- **Credenciais comprometidas**: ver *Rotação de segredos* em [SECURITY.md](SECURITY.md).
