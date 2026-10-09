# Estado do projeto

Atualizado a 8 de outubro de 2026. Ficheiro de continuidade: o próximo passo está no fim.

## Entregue
| Fase | Resultado |
| --- | --- |
| 1 · Requisitos e desenho | Perguntas respondidas, decisões em [DECISIONS.md](DECISIONS.md), sistema de design (`src/app/globals.css`), logótipo vetorial |
| 2 · Projeto | Next.js 16.3.8, dependências fixadas + lockfile, configuração tipada (`src/lib/env.ts`), CI, `.env.example` |
| 3 · Base de dados e segurança | 5 migrações, RLS em todas as tabelas, Storage, criação segura do 1.º administrador, demo isolada |
| 4 · Site público | Home, catálogo com filtros/URL/paginação, ficha completa, galeria, favoritos, comparador, contactos, serviços, retomas, financiamento (pedido), guias, páginas legais, SEO, consentimento |
| 5 · Operação | Painel: viaturas, fotografias, reservas, CRM, visitas, conteúdo, importação CSV, configuração, utilizadores, auditoria, outbox |
| 6 · Integrações | Click to Chat; Cloud API (webhook, caixa de entrada, envio, templates) **implementada e por ativar**; email Resend **implementado e por ativar**; alertas de pesquisa |
| 7 · Qualidade | Testes abaixo; verificação responsiva 320/360/390/768/1024/1440 sem deslocamento horizontal |
| 8 · Produção | Roteiro em [DEPLOYMENT.md](DEPLOYMENT.md). **Não publicado** — depende das ações do proprietário |

## Evidência (executado neste ambiente, Node 22.22, Postgres 16.15)
| Comando | Resultado |
| --- | --- |
| `npm run lint` | 0 erros, 0 avisos |
| `npm run typecheck` | sem erros |
| `npm test` | 6 ficheiros, **69 testes passados** (35 unitários; 34 de integração com Postgres: RLS por perfil, regras de publicação, concorrência, reservas, sobreposição de marcações, distribuição de contactos, dados demo em produção, outbox concorrente, limite de pedidos, fluxo de pedido, falha de email, webhook duplicado/fora de ordem, opt-out) |
| `npm run build` | sucesso (todas as rotas dinâmicas) |
| `npm run test:e2e` | **21 passados**, 3 ignorados (fluxo do painel corre só em desktop): pesquisa, filtros no URL e voltar atrás, filtros no telemóvel, ficha, galeria, favoritos, comparador, WhatsApp com referência, pedido de informação, erros de validação, retoma com fotografia, pedido de visita, 404, cookies rejeitados sem terceiros, login, edição de preço, venda, permissões do vendedor |
| Verificações manuais | `/api/cron/outbox` sem segredo → 401; webhook sem assinatura → 401; GET de verificação devolve o challenge; cabeçalhos CSP/HSTS/X-Frame-Options presentes |

**Não verificado aqui** (exige contas reais): Supabase Auth/MFA/Storage reais, envio real pelo Resend,
WhatsApp Cloud API real, deployment na Vercel, DNS. Estes pontos estão no roteiro e devem ser
confirmados em staging. Em particular, confirmar em staging que o utilizador da ligação ao pooler
pode fazer `set role anon/authenticated/service_role` (comportamento normal da Supabase).

## Limitações conhecidas
- CSP com `'unsafe-inline'` em scripts (sem nonces) — ver SECURITY.md.
- Fotografias do Instagram: os URLs do CDN expiram; importar logo a seguir a copiá-los, ou carregar os originais.
- Template WhatsApp com parâmetros fixos (+ `{nome}`); parâmetros por marcação ficam para evolução.
- Sem morada/horário configurados, as marcações online ficam desligadas.

## Pendentes (do proprietário)
1. Enviar o código para `inovaautopt/INOVAAUTOPT`.
2. Supabase (staging + produção, plano Pro em produção) e Vercel (plano Pro) — DEPLOYMENT passos 3–5.
3. Indicar o tratamento de IVA das viaturas (regime da margem / dedutível).
4. Rever textos legais e decidir sobre identificação da empresa (DECISIONS, ponto 5).
5. Domínio, Resend e, opcionalmente, WhatsApp Cloud API.

## Próximo passo
Depois do envio para o GitHub: criar o projeto Supabase de staging, aplicar migrações, ligar a
Vercel em modo Preview, criar o 1.º administrador e importar `stock-inicial-instagram.csv`.
