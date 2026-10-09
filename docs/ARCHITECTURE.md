# Arquitetura

```mermaid
flowchart LR
  V[Visitante] -->|HTTPS| N[Next.js na Vercel]
  S[Colaborador] -->|HTTPS + sessão Supabase + MFA| N
  N -->|asPublic: papel anon| DB[(Postgres Supabase<br/>esquema app + RLS)]
  N -->|asStaff: papel authenticated + claims| DB
  N -->|asSystem: service_role<br/>rotinas de confiança| DB
  N -->|chave secreta, só servidor| ST[(Supabase Storage<br/>vehicle-media público<br/>private-media privado)]
  N --> R[Resend]
  N --> W[WhatsApp Cloud API]
  W -->|webhook assinado| N
  C[Vercel Cron / pg_cron] -->|Bearer CRON_SECRET| N
  V -->|Click to Chat wa.me| WA[WhatsApp do visitante]
```

- O esquema `app` **não** é exposto pela Data API da Supabase; o servidor liga-se ao Postgres
  pelo *transaction pooler* e muda de papel em cada transação (`set local role`). Assim, as
  políticas RLS aplicam-se também ao código do servidor, não só a chamadas diretas.
- Leituras públicas usam o papel `anon` com permissões por coluna (VIN, matrícula, custos e notas
  ficam em `vehicle_private_details`, inacessível a `anon` e a vendedores).

## Fluxo de um pedido e notificações

```mermaid
sequenceDiagram
  participant V as Visitante
  participant API as POST /api/leads
  participant DB as Postgres
  participant W as Worker (after() / cron)
  participant E as Resend
  V->>API: formulário (chave de idempotência, honeypot, tempo)
  API->>API: validação Zod + origem + limite de pedidos
  API->>DB: 1 transação: lead + autorizações + atividade + atribuição + outbox
  API-->>V: 201 «Pedido recebido» (nº do pedido)
  W->>DB: claim_outbox (FOR UPDATE SKIP LOCKED)
  W->>E: envio com Idempotency-Key, timeout 10 s
  alt sucesso
    W->>DB: status sent + id do fornecedor
  else falha temporária
    W->>DB: failed + próxima tentativa (backoff exponencial até 6 h)
  else falha permanente / tentativas esgotadas
    W->>DB: dead (visível em Integrações, botão «Tentar novamente»)
  end
```

O pedido fica sempre no painel, mesmo que o email falhe. O visitante vê a receção do pedido,
nunca uma promessa de entrega de email.

## WhatsApp

```mermaid
sequenceDiagram
  participant M as Meta
  participant H as /api/webhooks/whatsapp
  participant DB as Postgres
  participant P as Processamento
  M->>H: POST + X-Hub-Signature-256
  H->>H: HMAC-SHA256(app secret, corpo bruto) — comparação segura
  H->>DB: integration_events (único por provider+event_key)
  H-->>M: 200 (recebido, não "entregue")
  P->>DB: conversa/mensagem (dedupe por wamid), contacto CRM, estados só avançam
```
