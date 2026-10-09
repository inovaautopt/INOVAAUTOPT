# WhatsApp

Há **dois mecanismos distintos**:

## 1. Click to Chat (ativo desde o primeiro dia)

- Botões «Falar no WhatsApp» abrem `https://wa.me/<número só com algarismos>?text=<mensagem codificada>`.
- Na ficha da viatura a mensagem é: «Olá, tenho interesse na viatura [marca e modelo], referência
  [referência]. Está disponível? [URL]».
- O visitante decide se envia. O servidor **não** envia nada nem sabe se a conversa começou; um
  clique não é contado como conversa, contacto confirmado ou venda.
- Número: o configurado em *Configuração → WhatsApp* (inicialmente +351 929 218 224).

## 2. WhatsApp Business Platform — Cloud API oficial (implementada e por ativar)

Sem bibliotecas que automatizam o WhatsApp Web, sem sessões por QR code, sem APIs não oficiais.

### Antes de alterar o número
O 929 218 224 é usado hoje na aplicação WhatsApp (Business?). Registar um número na Cloud API
pode impedir o uso simultâneo na aplicação, **exceto** se a Meta disponibilizar a coexistência
(aplicação WhatsApp Business + Cloud API) para essa conta. Confirma na documentação atual da Meta
antes de migrar; em alternativa, usa um número novo dedicado para a API.

### Percurso
1. **Meta Business Portfolio** da empresa (business.facebook.com), com verificação da empresa
   quando a Meta a pedir.
2. **developers.facebook.com → Create App** (tipo *Business*) → adicionar o produto **WhatsApp**.
3. Fica associada uma **WhatsApp Business Account (WABA)**. Em *API Setup* há um número de teste
   para ensaios (só envia para destinatários verificados).
4. Adicionar o número de produção, nome de apresentação (sujeito a aprovação) e verificar por SMS/voz.
5. **Token**: criar um *System User* no Business Portfolio com permissões mínimas
   (`whatsapp_business_messaging`, `whatsapp_business_management`) atribuído só a esta app/WABA
   e gerar um token permanente. Guardar diretamente na Vercel (`WHATSAPP_ACCESS_TOKEN`).
6. **Webhook**: *WhatsApp → Configuration* → Callback URL `https://<domínio>/api/webhooks/whatsapp`,
   Verify token = valor de `WHATSAPP_VERIFY_TOKEN`. Subscrever o campo **messages**.
7. Variáveis na Vercel: `WHATSAPP_PROVIDER=cloud_api`, `META_APP_SECRET` (App → Settings → Basic),
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_GRAPH_API_VERSION` (versão **explícita**
   suportada no momento, ex.: `v24.0` — confirmar em developers.facebook.com; nunca «latest»).
8. Painel → *Integrações* → **Sincronizar com a Meta** (lê nome, idioma, categoria e estado real dos templates).

### Funcionamento
- **Webhook GET**: valida `hub.mode=subscribe` e `hub.verify_token`; devolve `hub.challenge`.
- **Webhook POST**: valida `X-Hub-Signature-256` = HMAC-SHA256 com o *app secret* sobre o corpo
  **bruto**, comparação de tempo constante. Persiste cada evento (deduplicado) **antes** de
  responder 200 e processa depois. Aceita reenvios e eventos fora de ordem; os estados de uma
  mensagem só avançam (aceite → enviada → entregue → lida; «falhou» prevalece). A Meta pode não
  enviar todos os estados (por exemplo, leitura).
- **Caixa de entrada** (*Painel → WhatsApp*): conversas do número central, atribuídas a vendedores;
  guarda quem respondeu. As respostas saem sempre do número da empresa — os vendedores **não**
  aparecem com os seus números pessoais.
- **Janela de atendimento**: texto livre só até 24 h depois da última mensagem do cliente (regra
  atual da Meta; confirmar antes de publicar). Fora dela, só templates com estado `APPROVED`.
  Um formulário do site ou um clique em Click to Chat **não** abrem a janela.
- **Envio**: `POST https://graph.facebook.com/<versão>/<phone_number_id>/messages` com Bearer token,
  timeout de 10 s. Resultado incerto (timeout) fica «Resultado incerto» e **não** é reenviado às
  cegas; a confirmação chega pelo webhook.
- **Paragem**: mensagens «STOP», «PARAR», «CANCELAR»… registam a retirada da autorização e
  bloqueiam envios até o cliente voltar a escrever.
- **Associação à viatura**: tenta-se pela referência (ex.: IA-0003) no texto. Se o cliente apagar
  a referência da mensagem pré-preenchida, a associação tem de ser feita manualmente no CRM.
- Não há mensagens de boas-vindas automáticas por alguém abrir uma ficha.

### Templates propostos (submeter na Meta; categoria e aprovação decididas pela Meta)
| Chave | Idioma | Texto proposto |
| --- | --- | --- |
| `confirmacao_pedido` | pt_PT | Olá {{1}}, recebemos o seu pedido na Inova Auto. Vamos responder em breve. |
| `confirmacao_visita` | pt_PT | Olá {{1}}, a sua visita à Inova Auto está confirmada para {{2}}. |

### Custos
Dependem das regras, categorias de mensagem, mercado de destino e data — consultar a tabela de
preços atual da Meta. Ver [COSTS.md](COSTS.md).
