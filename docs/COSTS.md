# Custos e operação

Preços consultados nas páginas oficiais a 8 de outubro de 2026 (valores sem IVA, podem mudar).

| Serviço | Finalidade | Titular | Plano proposto | Unidade | Limites relevantes | Custo atual |
| --- | --- | --- | --- | --- | --- | --- |
| Domínio `.pt` | Endereço do site | Empresa | Registo anual | ano | — | Por confirmar (depende do registrar) |
| Vercel | Alojamento Next.js | Empresa | **Pro** (Hobby é só para uso pessoal, não comercial) | mês + utilização | inclui 20 USD de créditos de utilização | 20 USD/mês |
| Supabase | Base de dados, autenticação, ficheiros | Empresa | **Pro** em produção; Free em staging | mês | Pro: 8 GB disco, 100 GB ficheiros, 250 GB tráfego, cópias diárias 7 dias. Free: pausa após 1 semana inativo, sem cópias | Pro desde 25 USD/mês; Free 0 |
| Resend | Email transacional | Empresa | Free (inicial) | mês | 3 000 emails/mês, 100/dia, 3 domínios | 0 (Pro 20 USD/mês, 50 000 emails) |
| WhatsApp Cloud API | Mensagens oficiais | Empresa (Meta) | Pagamento por mensagem/categoria | mensagem | depende da categoria, mercado e janela | Por confirmar (tabela atual da Meta) |
| Monitorização | Disponibilidade `/api/health` | Empresa | Plano gratuito de um serviço de uptime | mês | — | Por confirmar |
| Manutenção | Atualizações, apoio | A definir | — | hora/mês | — | Por confirmar |

Fontes: vercel.com/pricing, supabase.com/pricing, resend.com/pricing.

## Cenários (hipóteses, não previsões)
| Cenário | Hipóteses | Custo mensal estimado |
| --- | --- | --- |
| Arranque | ≤ 30 viaturas, ≤ 5 000 visitas/mês, ≤ 500 emails/mês, Click to Chat | Vercel Pro 20 + Supabase Pro 25 ≈ **45 USD + domínio** |
| Crescimento | ≤ 150 viaturas, ≤ 30 000 visitas, ≤ 3 000 emails, Cloud API ativa | ≈ 45 USD + mensagens WhatsApp (por confirmar) |

## Investimento vs. recorrente
- Desenvolvimento inicial: entregue neste repositório.
- Recorrente: alojamento, base de dados, domínio, email e mensagens; manutenção (por acordar).

## Rotinas
| Frequência | Tarefa | Responsável |
| --- | --- | --- |
| Diária | Contactos novos/sem resposta, visitas, WhatsApp | Vendedores |
| Semanal | Rever stock, preços e fotografias; *Integrações* (falhas); cópia própria da base e ficheiros | Administrador |
| Mensal | Utilizadores e permissões; `npm outdated` + atualização de dependências com testes | Administrador / programador |
| Trimestral | Restauro de teste em staging; rotação de segredos | Programador |

## Evolução (sujeita a dados e aprovação)
Pesquisas guardadas com WhatsApp, integrações com portais de anúncios (com documentação e acesso
autorizado), simulador de financiamento (com condições aprovadas), assistente com IA (limitado a
stock e conteúdo aprovados) e pagamentos — nenhum implementado sem decisão explícita.
