# API

Especificação completa: [openapi.yaml](openapi.yaml).

| Método e caminho | Acesso | Notas |
| --- | --- | --- |
| `GET /api/vehicles` | Público | Mesmos filtros que `/viaturas`; cache 60 s |
| `GET /api/vehicles/{id}` | Público | Só viaturas publicadas |
| `GET /api/vehicles/lookup?ids=` | Público | Estado atual de favoritos/comparador |
| `POST /api/leads` | Público, mesma origem | Idempotente, antiabuso, limite por IP |
| `POST /api/appointments` | Público, mesma origem | Pedido sujeito a confirmação |
| `POST /api/trade-ins` | Público, mesma origem | Multipart, fotografias privadas |
| `POST /api/saved-searches` | Público, mesma origem | Dupla confirmação por email |
| `GET /api/health` | Público | Sem segredos |
| `GET/POST /api/webhooks/whatsapp` | Meta | Verify token / assinatura HMAC |
| `POST /api/admin/whatsapp/send` | Colaborador | Destinatário fixo da conversa |
| `GET/POST /api/cron/outbox` | `CRON_SECRET` | Agendado |

As escritas de stock, conteúdo e CRM são feitas por Server Actions do painel, autenticadas e
autorizadas no servidor e na base de dados (RLS).

## Integrações futuras (CRM / portais)
Só com documentação e acesso autorizado do fornecedor. Padrão previsto: um adaptador por
fornecedor em `src/server/integrations/<nome>.ts` com mapeamento de campos, identificador externo
estável (coluna a acrescentar por migração), registo em `integration_events`, tratamento de
conflitos (o painel é a fonte de verdade para preço e estado) e reconciliação periódica. Um portal
usado como referência visual não tem, por isso, uma API disponível.
