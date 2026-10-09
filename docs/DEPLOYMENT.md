# Publicação passo a passo

Roteiro para pôr o site no ar com contas **em nome da empresa**. Os segredos são introduzidos
pelo proprietário diretamente nos painéis da Supabase e da Vercel: nunca em conversas,
emails ou ficheiros do repositório.

Ambientes:

| Ambiente | Aplicação (Vercel) | Base de dados (Supabase) | Mensagens reais |
| --- | --- | --- | --- |
| Desenvolvimento | `npm run dev` local | Postgres local (`npm run db:local`) | Não (email em consola, WhatsApp mock) |
| Staging / pré-visualização | Deployments *Preview* | Projeto Supabase **inova-staging** | Só para `OUTBOUND_ALLOWLIST` |
| Produção | Deployment *Production* | Projeto Supabase **inova-producao** | Sim |

> Planos: o plano gratuito *Hobby* da Vercel é, segundo a própria Vercel, para uso pessoal e
> não comercial — um stand precisa do plano **Pro**. O plano gratuito da Supabase pausa o
> projeto ao fim de 1 semana sem atividade e não inclui cópias de segurança — para produção usa
> o plano **Pro**. Ver [COSTS.md](COSTS.md).

---

## Passo 1 — Contas e titularidade

1. GitHub (organização ou conta da empresa) com verificação em dois passos.
2. Supabase e Vercel: entrar com a conta GitHub da empresa. Ativar MFA nas duas.
3. Resend (email) — criar conta com o email da empresa.
4. Meta Business (só quando for ativar a WhatsApp Cloud API — ver [WHATSAPP.md](WHATSAPP.md)).
5. Registo do domínio (ex.: `.pt` num registrar acreditado pela PT.PT). Ainda não comprado.

## Passo 2 — Repositório

1. Envia o conteúdo desta pasta para o repositório `inovaautopt/INOVAAUTOPT`
   (pelo site: *Add file → Upload files*, arrastando as pastas; ou com Git:
   `git init && git add . && git commit -m "Projeto inicial" && git branch -M main &&
   git remote add origin https://github.com/inovaautopt/INOVAAUTOPT.git && git push -u origin main`).
2. **Não envies** `.env.local`, `node_modules`, `.next` nem `.data` (o `.gitignore` já os exclui).
3. *Settings → Branches*: proteger `main` (exigir que a CI passe antes de juntar).
4. A CI (`.github/workflows/ci.yml`) corre lint, tipos, testes (com Postgres), build e testes de
   navegação em cada envio.

## Passo 3 — Base de dados (Supabase)

Para **cada** ambiente (staging e produção):

1. *New project* → nome `inova-staging` / `inova-producao` → região **Europe (Paris — eu-west-3)**
   (ou Frankfurt). Guarda a palavra-passe da base num gestor de palavras-passe.
2. Aplicar as migrações por ordem (SQL Editor → colar e executar cada ficheiro de
   `supabase/migrations/`, do mais antigo para o mais recente) **ou** com a Supabase CLI:
   ```bash
   npx supabase@latest login
   npx supabase@latest link --project-ref <ref-do-projeto>
   npx supabase@latest db push
   ```
   Resultado esperado: esquema `app` criado, RLS ativo em todas as tabelas, buckets
   `vehicle-media` (público) e `private-media` (privado).
3. **Só em produção**, no SQL Editor:
   ```sql
   update app.instance set environment = 'production';
   ```
   (a base passa a recusar dados de demonstração). Em staging: `'staging'`.
4. Configuração inicial (produção): executar `db/initial-settings.sql`.
5. *Authentication → URL Configuration*: *Site URL* = `https://<domínio>`; *Redirect URLs* =
   `https://<domínio>/admin/auth/callback` e o URL de staging equivalente.
6. *Authentication → Providers → Email*: desligar **Allow new users to sign up**
   (só convites). Ativar **MFA → TOTP**.
7. *Settings → API Keys*: copiar a **Publishable key** e criar/copiar uma **Secret key**
   (vão diretamente para a Vercel no passo 4).
8. *Database → Connect → Transaction pooler*: copiar a string de ligação (porta 6543).
9. Verificar que *Data API → Exposed schemas* NÃO inclui `app` (por omissão só `public`).

## Passo 4 — Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Visibilidade | Produção | Preview (staging) | Origem |
| --- | --- | --- | --- | --- |
| `APP_ENV` | servidor | `production` | `staging` | — |
| `NEXT_PUBLIC_SITE_URL` | pública | `https://<domínio>` | URL de staging | Vercel |
| `DATABASE_URL` | **secreta** | pooler produção | pooler staging | Supabase (passo 3.8) |
| `AUTH_PROVIDER` | servidor | `supabase` | `supabase` | — |
| `NEXT_PUBLIC_SUPABASE_URL` | pública | URL produção | URL staging | Supabase → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | chave publicável | idem staging | Supabase → API Keys |
| `SUPABASE_SECRET_KEY` | **secreta** | chave secreta | idem staging | Supabase → API Keys |
| `STORAGE_DRIVER` | servidor | `supabase` | `supabase` | — |
| `EMAIL_PROVIDER` | servidor | `resend` | `resend` ou `disabled` | — |
| `RESEND_API_KEY` | **secreta** | chave Resend | chave Resend (teste) | Resend |
| `EMAIL_FROM` | servidor | `Inova Auto <avisos@<domínio>>` | idem | domínio verificado |
| `EMAIL_REPLY_TO` | servidor | email do stand | — | proprietário |
| `STAFF_NOTIFICATION_EMAILS` | servidor | emails dos vendedores | email de teste | proprietário |
| `OUTBOUND_ALLOWLIST` | servidor | (vazio) | emails/telefones de teste | — |
| `CRON_SECRET` | **secreta** | 32+ caracteres aleatórios | outro valor | gerar (ver abaixo) |
| `RATE_LIMIT_SALT` | **secreta** | 16+ caracteres aleatórios | outro valor | gerar |
| `WHATSAPP_PROVIDER` | servidor | `disabled` → `cloud_api` | `mock`/`disabled` | — |
| `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` | **secretas** | Meta | Meta (número de teste) | Meta |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_GRAPH_API_VERSION` | servidor | Meta | Meta | Meta |
| `IMAGE_IMPORT_ALLOWED_HOSTS` | servidor | (opcional) | (opcional) | por omissão Instagram/Facebook CDN |
| `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | públicas | opcionais | vazio | Google / Meta |

Gerar segredos aleatórios (no teu computador): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
**Nunca** uses o prefixo `NEXT_PUBLIC_` em segredos. A aplicação recusa arrancar em produção com
configuração insegura (autenticação de desenvolvimento, mock de WhatsApp, falta de `CRON_SECRET`…).

## Passo 5 — Pré-visualização (staging)

1. Vercel → *Add New → Project* → importar `inovaautopt/INOVAAUTOPT` → framework **Next.js**,
   Node 22, comando de build por omissão.
2. Configurar as variáveis de *Preview* (staging) e *Production* (passo 4).
3. *Settings → Deployment Protection*: ativar **Vercel Authentication** para pré-visualizações
   (uma URL difícil de adivinhar não é privada). As pré-visualizações enviam `X-Robots-Tag: noindex`
   e o `robots.txt` bloqueia tudo fora de produção.
4. Primeiro administrador de staging: `npm run admin:create` (ver passo 9) com as variáveis de staging.

## Passo 6 — Domínio

1. Comprar o domínio aprovado (ex.: `inovaauto.pt`, se disponível).
2. Vercel → *Settings → Domains*: adicionar `inovaauto.pt` e `www.inovaauto.pt`.
3. No registrar, criar **exatamente** os registos DNS que a Vercel apresentar (não inventar IPs
   ou CNAME). Manter registos MX/TXT de email existentes.
4. Escolher o domínio canónico (ex.: sem `www`) e redirecionar o outro na Vercel.

## Passo 7 — HTTPS e email

1. Confirmar certificado HTTPS ativo e redirecionamentos na Vercel.
2. Resend → *Domains* → adicionar `inovaauto.pt` (ou subdomínio `avisos.inovaauto.pt`) e criar os
   registos SPF, DKIM (e MX de retorno) indicados. Acrescentar DMARC, por exemplo:
   `_dmarc  TXT  v=DMARC1; p=none; rua=mailto:<email-do-stand>` (subir para `quarantine` depois de validar).
3. Se já houver email empresarial (Google Workspace, Microsoft 365…), **não** substituir os MX:
   usar um subdomínio para o Resend.
4. Testar: submeter um pedido no site com o teu email → recebes a confirmação e a equipa o aviso.

## Passo 8 — Processamento agendado e integrações

- A Vercel Cron (em `vercel.json`) chama `/api/cron/outbox` uma vez por dia (compatível com
  todos os planos). Além disso, cada pedido processa a fila imediatamente a seguir (`after()`).
- Para processar a cada 2 minutos, ativar **pg_cron** e **pg_net** na Supabase (*Database →
  Extensions*) e, no SQL Editor (guardar o segredo no Vault):
  ```sql
  select vault.create_secret('<CRON_SECRET>', 'cron_secret');
  select cron.schedule('inova-outbox', '*/2 * * * *', $$
    select net.http_post(
      url := 'https://<domínio>/api/cron/outbox',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
    );
  $$);
  ```
- WhatsApp Cloud API: ver [WHATSAPP.md](WHATSAPP.md). Até lá fica «Implementada e por ativar»;
  os botões Click to Chat funcionam desde o primeiro dia.
- Monitorização: configurar um verificador externo (ex.: UptimeRobot, BetterStack) para
  `GET https://<domínio>/api/health` (200 = aplicação e base OK) com alerta para o email do stand.

## Passo 9 — Conteúdo e verificação final

1. Primeiro administrador (no teu computador, com as variáveis de produção só no terminal):
   ```bash
   SUPABASE_URL=… SUPABASE_SECRET_KEY=… DATABASE_URL=… SITE_URL=https://<domínio> \
   npm run admin:create -- --email <email> --name "<Nome>"
   ```
   A pessoa recebe o convite, define a palavra-passe e configura a verificação em dois passos.
2. No painel: *Configuração* (dados da empresa, serviços, legal), *Utilizadores* (convidar o
   segundo vendedor), *Importar stock* (ficheiro `stock-inicial-instagram.csv`), fotografias
   (*Viaturas → Importar por URL* ou carregar), tratamento de IVA e **Publicar**.
3. *Conteúdo*: rever e publicar privacidade, cookies, termos e reclamações (o sistema impede a
   publicação com dados em falta).
4. `DATABASE_URL=<produção> npm run check:prod-data` → deve terminar com ✓.
5. Pedido real controlado: enviar um pedido no site e confirmar que aparece no painel e que o
   email chega.

## Passo 10 — Publicação

1. Obter aprovação da versão (commit) a publicar.
2. Vercel → *Deployments* → *Promote to Production* (ou juntar em `main`).
3. Registar em `docs/STATUS.md`: URL, commit, data, migrações aplicadas e resultado dos smoke tests:
   `curl https://<domínio>/api/health`, abrir `/`, `/viaturas`, uma ficha, `/admin/entrar`.

## Passo 11 — Descoberta

- Google Search Console: verificar a propriedade do domínio (registo DNS TXT) e submeter
  `https://<domínio>/sitemap.xml`. A indexação não é imediata nem garantida.
- Google Business Profile: rever a ficha do stand (morada, horário, site), se existir acesso.
- GA4/Pixel: só com consentimento; eventos sem dados pessoais (`lead_submitted`, `whatsapp_click`).

## Passo 12 — Recuperação

- Registar o deployment anterior (Vercel permite *Instant Rollback*). Voltar a um deployment
  anterior **não** reverte a base de dados: as migrações são aditivas e compatíveis com a versão
  anterior da aplicação.
- Confirmar cópias de segurança separadas da base e dos ficheiros e fazer um restauro de teste
  em staging ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)).
- Rever logs da Vercel e a página *Integrações* do painel na primeira semana.
