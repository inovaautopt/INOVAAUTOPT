# Segurança e privacidade

## Autorização em camadas
1. **Servidor**: cada página e ação do painel valida sessão, perfil ativo, MFA (administradores) e
   papel (`requireStaff` / `withStaff`).
2. **Base de dados (RLS)**: todas as tabelas do esquema `app` têm RLS. O servidor executa as
   consultas de colaboradores com o papel `authenticated` e as claims verificadas
   (`auth.uid()`, `aal`); as do site com `anon`. Testado em `tests/db/rls.test.ts`
   (visitante, vendedor, gestor, administrador, administrador sem MFA, perfil desativado).
3. **service_role** (contorna RLS) só em rotinas de confiança: gravar pedidos públicos já
   validados, outbox, webhooks, importações de imagens. Cada uso tem verificações explícitas.
4. Chaves secretas (Supabase, Resend, Meta, CRON_SECRET) só existem no servidor; nenhuma variável
   `NEXT_PUBLIC_` contém segredos.

## Dados sensíveis
- VIN, matrícula, custos e documentos: `vehicle_private_details` (sem acesso para visitantes e vendedores).
- Fotografias de retomas: bucket privado; acesso por URL temporária de 5 minutos depois de
  verificar permissão sobre o contacto.
- Uploads: tipo real verificado por descodificação (não pela extensão), máx. 10 MB, conversão para
  WebP/JPEG (remove EXIF/GPS), servidos com `nosniff` e CSP restritiva — nunca como código.
- Auditoria (`audit_logs`) escrita só por triggers/funções de confiança; campos pessoais e privados
  aparecem apenas como «alterado».
- Logs sem segredos nem conteúdo de mensagens; emails mascarados no modo `log`.

## Proteções da aplicação
- Validação Zod no cliente **e** no servidor; consultas parametrizadas (postgres.js).
- Formulários públicos: verificação de origem (CSRF), honeypot, tempo mínimo de preenchimento,
  limite de pedidos por IP (cifrado com sal) e por email, chave de idempotência contra duplicados.
- Ações do painel: Server Actions do Next.js (protegidas contra CSRF por origem) e cookies de sessão
  `HttpOnly`, `Secure`, `SameSite=Lax` da Supabase.
- Cabeçalhos: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
  A CSP usa `'unsafe-inline'` em scripts por compatibilidade com o renderizador do Next.js sem
  nonces (que obrigariam a renderização dinâmica total); não há scripts de terceiros sem consentimento.
- Conteúdo editorial: Markdown restrito → HTML sanitizado (`sanitize-html`).
- Importação por URL: só https, domínios autorizados, resolução DNS verificada contra redes
  privadas/metadados, sem seguir redirecionamentos automaticamente, limite de tamanho e tempo.
  Risco residual: *DNS rebinding* entre a verificação e a ligação, mitigado pela lista de domínios.
- Exportações CSV protegidas contra fórmulas (CSV injection).
- Webhook WhatsApp: assinatura HMAC-SHA256 sobre o corpo bruto; o verify token não a substitui.
- Endpoint de cron: `Authorization: Bearer CRON_SECRET` com comparação de tempo constante.

## Armazenamento no navegador
| Chave | Conteúdo | Classificação |
| --- | --- | --- |
| `inova.favoritos.v1` | IDs de viaturas | Estritamente necessário (funcionalidade pedida) |
| `inova.comparar.v1` | IDs de viaturas (máx. 4) | Estritamente necessário |
| `inova.consentimento.v1` | Escolhas de cookies + versão do texto | Estritamente necessário |
Cookies de sessão Supabase só no painel.

## Consentimento
Banner com **Aceitar todos**, **Rejeitar não essenciais** e **Personalizar**, sem opções
pré-selecionadas; nada não essencial carrega antes da escolha; retirada em «Preferências de
cookies» no rodapé; nova versão do texto pede nova escolha. Mapas e vídeos incorporados exigem
«Conteúdos externos» e têm sempre alternativa por ligação.

## Direitos dos titulares (processo restrito)
Pedidos de acesso, retificação, exportação ou apagamento chegam ao email de privacidade.
O administrador localiza o contacto (pesquisa por email/telefone), exporta os dados do contacto
(CSV), retifica no painel ou pede ao programador o apagamento pelo SQL controlado:
`delete from app.leads where id = '<id>';` (apaga atividades, marcações, retomas e autorizações
associadas; ficheiros privados devem ser removidos do bucket). Respeitar obrigações legais de
conservação (por exemplo, faturação) antes de apagar. Prazos de conservação: definir com o
proprietário (Configuração → Informação legal).

## Rotação de segredos
1. Gerar o novo valor no fornecedor (Supabase/Resend/Meta) ou aleatoriamente (CRON_SECRET).
2. Atualizar na Vercel e fazer *Redeploy*.
3. Revogar o antigo. Para `META_APP_SECRET`, atualizar primeiro a Vercel e só depois rodar na Meta
   (pedidos com a assinatura antiga são rejeitados durante a transição).
Em suspeita de comprometimento: rodar todos os segredos, terminar sessões (Supabase → Auth →
Users → *Sign out*), rever `audit_logs`.
