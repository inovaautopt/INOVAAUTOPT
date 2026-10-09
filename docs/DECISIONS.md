# Decisões

Registo de decisões técnicas e comerciais (data: 8 de outubro de 2026).

## Briefing recebido
| Tema | Resposta do proprietário |
| --- | --- |
| Nome | INOVA AUTO (Instagram @inovaautopt) |
| Domínio | Ainda não comprado |
| Logótipo | Só versão pequena; recriado em vetor mantendo a ideia (SUV + «iNA» cromado + traço azul) |
| Stock | 4 viaturas (stand novo); dados e fotografias nas publicações do Instagram |
| Equipa | 2 vendedores, ambos administradores |
| WhatsApp | Número central +351 929 218 224 |
| Serviços | Mostrar só os existentes. Confirmado nas publicações: possibilidade de crédito |
| Contas | Criadas: GitHub, Supabase, Vercel |
| Código | Repositório GitHub `inovaautopt/INOVAAUTOPT` (envio manual pelo proprietário) |
| Morada, NIF, firma, horário | O proprietário indicou que não serão mostrados no site (ver nota legal abaixo) |

## Decisões técnicas
1. **Next.js 16.3.8 + React 19.2.8 + TypeScript 5.9.3**: versões estáveis com mais de uma semana;
   Next 16.4.0 tinha 2 dias e TypeScript 7 ainda não é suportado pelo ecossistema Next.
2. **Acesso ao Postgres direto (postgres.js) com mudança de papel por transação**, em vez da Data
   API: permite manter o esquema `app` fora da API pública e aplicar RLS também ao código do servidor.
3. **Supabase Auth** com MFA TOTP obrigatória para administradores (verificada também nas
   políticas RLS via `aal2`). Modo `dev` só local, recusado em produção.
4. **Fotografias processadas no carregamento** (sharp → WebP 480/960/1600 px) em vez da otimização
   de imagens da Vercel: custo previsível e remoção de EXIF garantida.
5. **Outbox na base de dados** + `after()` (processamento imediato) + cron autenticado
   (Vercel diário; pg_cron recomendado a cada 2 min). Sem timers em memória.
6. **Sem Tailwind UI de terceiros (shadcn)**: componentes próprios acessíveis com `<dialog>` nativo,
   para reduzir dependências. Ícones: lucide-react.
7. **Tipografia**: Archivo (variável, largura e peso) auto-alojada — sem pedidos ao Google Fonts.
8. **Identidade**: fundo claro, grafite e azul-aço do logótipo; elemento distintivo = «placa» ao
   estilo da matrícula portuguesa com a **referência do stand** (nunca a matrícula real) e o ano/mês.
9. **Região**: Vercel `cdg1` (Paris) e Supabase UE (Paris/Frankfurt).
10. **Catálogo**: páginas renderizadas no servidor por pedido (stock pequeno, dados sempre atuais);
    indexáveis só a listagem sem filtros e por marca; vendidas acessíveis mas `noindex`.

## Decisões comerciais e legais (a validar)
1. **IVA**: as publicações não indicam o regime. As viaturas foram preparadas com «IVA por indicar»,
   o que **bloqueia a publicação** até o proprietário escolher (regime da margem ou IVA dedutível).
2. **Financiamento**: o perfil do Instagram anuncia «120x sem entrada/fiador» e «aprovação super
   rápida». Estas afirmações **não** foram reproduzidas no site: a publicidade a crédito tem regras
   próprias (Banco de Portugal — TAEG, MTIC, exemplo representativo, identificação do intermediário).
   O site oferece apenas «pedido de informação sobre financiamento», sem mensalidades nem taxas.
3. **Garantia**: texto das publicações («Garantia incluída», «18 meses» no 500e) colocado como
   rascunho; confirmar condições antes de publicar.
4. **Bateria**: estado de saúde do 500e (93,4%) indicado como estimativa do stand; do MG4 (92,8%)
   sem fonte documental indicada — confirmar a fonte (relatório de diagnóstico) antes de publicar.
5. **Identificação da empresa**: o proprietário não pretende mostrar morada/NIF. Nota: a lei
   portuguesa exige, em geral, que um prestador de serviços em linha identifique nome/firma, morada
   e NIF, e que um estabelecimento indique o Livro de Reclamações e a entidade de resolução
   alternativa de litígios. Os textos legais não podem ser publicados sem esses dados (bloqueio
   automático). Recomenda-se validar com contabilista/jurista. Sem morada no site, as marcações
   online ficam desligadas (não há instalação com horário) e não é publicado o schema AutoDealer.
6. **Retomas**: não confirmadas → página oculta até ativação no painel.
7. **Conservação de dados**: prazos não inventados — campo a preencher pelo responsável.

## Valores por omissão
- Contacto central com distribuição automática à vez; fila central quando ninguém está disponível.
- Alerta de contacto sem resposta: 120 minutos. Reserva: 3 dias. Visita: 60 minutos.
- Pesquisas guardadas por email com dupla confirmação (pode ser desligado se o orçamento obrigar).
