# Inova Auto — site e painel do stand

Site público do stand Inova Auto (catálogo de viaturas, ficha, favoritos, comparador, pedidos de
contacto, visitas e retomas) e painel de gestão (stock, fotografias, CRM, visitas, reservas,
WhatsApp, importação CSV, conteúdo, utilizadores e auditoria).

Interface e documentação em português de Portugal. Moeda EUR, quilómetros, fuso Europe/Lisbon.

## Tecnologia

| Camada | Escolha |
| --- | --- |
| Aplicação | Next.js 16.3 (App Router, TypeScript 5.9, React 19.2), Tailwind CSS 4 |
| Dados | Supabase: PostgreSQL 15+/16+, Auth (MFA), Storage — região UE |
| Alojamento | Vercel (região cdg1, Paris) |
| Email | Resend (atrás de interface própria) |
| WhatsApp | WhatsApp Business Platform — Cloud API oficial (atrás de interface própria) + Click to Chat |
| Validação | Zod 4 (partilhada cliente/servidor) |
| Testes | Vitest 5 (unitários + integração com Postgres real), Playwright (navegação) |

Node.js suportado: **22.x** (`.nvmrc`). Instalação sempre com `npm ci` (lockfile versionado).

## Começar (desenvolvimento local)

```bash
npm ci
cp .env.example .env.local        # preencher DEV_AUTH_SECRET (32+ caracteres)
npm run db:local -- --seed-demo   # Postgres local: migrações + dados de DEMONSTRAÇÃO
npm run dev                       # http://localhost:3000  ·  painel: /admin
```

Guia completo: [docs/SETUP.md](docs/SETUP.md).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `build` / `start` | Desenvolvimento, build de produção, servidor de produção |
| `npm run lint` / `typecheck` | ESLint e TypeScript |
| `npm test` | Testes unitários + integração (RLS, regras de negócio, fluxos) — precisa de Postgres local |
| `npm run test:e2e` | Testes de navegação (desktop e telemóvel) contra um servidor a correr |
| `npm run db:local -- --seed-demo` | Recria a base local com dados de demonstração |
| `npm run admin:create -- --email … --name …` | Cria o primeiro administrador (convite por email) |
| `npm run check:prod-data` | Falha se houver dados de demonstração ou textos legais por publicar |
| `npm run outbox:run` | Força o processamento da fila de notificações |

## Documentação

- [docs/SETUP.md](docs/SETUP.md) — instalação local e estrutura do projeto
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — publicar: GitHub, Supabase, Vercel, domínio, email, cron
- [docs/ADMIN.md](docs/ADMIN.md) — manual do painel (sem código)
- [docs/WHATSAPP.md](docs/WHATSAPP.md) — Click to Chat e Cloud API oficial
- [docs/SECURITY.md](docs/SECURITY.md) — modelo de segurança, RLS, privacidade, cookies
- [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) — cópias de segurança e recuperação
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisões técnicas e comerciais
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitetura e fluxos (diagramas)
- [docs/API.md](docs/API.md) + [docs/openapi.yaml](docs/openapi.yaml) — API pública e privada
- [docs/COSTS.md](docs/COSTS.md) — custos e rotinas de operação
- [docs/STATUS.md](docs/STATUS.md) — estado atual, evidência de testes e pendentes
