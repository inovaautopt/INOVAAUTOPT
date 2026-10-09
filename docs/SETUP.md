# Instalação local

## Requisitos

- Node.js 22.x (ver `.nvmrc`) e npm 10
- PostgreSQL 15 ou 16 local (para desenvolvimento e testes). Não é preciso Docker nem a CLI da Supabase:
  `db/local-supabase-shim.sql` reproduz o mínimo da plataforma (papéis `anon`/`authenticated`/
  `service_role`, `auth.uid()`, `auth.jwt()`).
- Chromium para os testes de navegação: `npx playwright install chromium`.

## Passos

```bash
npm ci                              # instala exatamente o que está no package-lock.json
cp .env.example .env.local
# editar .env.local: DATABASE_URL local e DEV_AUTH_SECRET (32+ caracteres aleatórios)
npm run db:local -- --seed-demo     # cria a base inova_dev com dados de DEMONSTRAÇÃO
npm run dev
```

- Site: http://localhost:3000 — faixa amarela «Ambiente de testes».
- Painel: http://localhost:3000/admin — em modo `AUTH_PROVIDER=dev` entra-se só com o email de um
  perfil existente: `admin@demo.local`, `vendedor@demo.local`, `stock@demo.local`. Este modo é
  **recusado** pela configuração quando `APP_ENV=production`.
- Emails: `EMAIL_PROVIDER=log` escreve na consola. WhatsApp: `WHATSAPP_PROVIDER=mock`.
- Fotografias: guardadas em `.data/storage/` (servidas por `/media/...` só com `STORAGE_DRIVER=local`).

## Testes

```bash
npm run lint
npm run typecheck
npm test                    # unitários + integração (cria a base inova_test do zero)
npm run build && npm start  # noutro terminal
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

Se a tua instalação de Postgres usar outras credenciais, define `TEST_DATABASE_URL` e `DATABASE_URL`.

## Estrutura

```
supabase/migrations/   SQL versionado: esquema, RLS, funções de negócio, storage, conteúdo base
db/                    shim local, dados de demonstração, configuração inicial de produção
src/app/(site)/        páginas públicas (Server Components)
src/app/admin/         painel (autenticação, MFA, gestão)
src/app/api/           API pública, webhooks, cron e envio WhatsApp privado
src/lib/               domínio, validação (Zod), formatação, pesquisa, conteúdos
src/server/            só servidor: autenticação, outbox, email, WhatsApp, storage, importação
src/components/        interface (site, viatura, formulários, consentimento, painel)
tests/unit, tests/db   Vitest;  e2e/  Playwright
docs/                  documentação
```
