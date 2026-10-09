-- Inova Auto — conteúdo base (seguro para produção, idempotente)
-- Configurações vazias para dados comerciais (preenchidas no painel), catálogo de equipamento e
-- rascunhos de páginas legais com estado "needs_validation". Nada aqui é publicado
-- automaticamente: textos legais exigem validação e publicação explícita no painel.

insert into app.site_settings (key, value, is_public) values
  ('company', '{"tradeName":"Inova Auto","legalName":null,"nif":null,"email":null,"phoneE164":null,"whatsappE164":null,"instagramUrl":null,"facebookUrl":null,"privacyEmail":null,"valueProposition":null,"aboutText":null}', true),
  ('services', '{"trade_in":false,"financing":false,"delivery":false,"workshop":false,"import":false,"extended_warranty":false,"after_sales":false}', true),
  ('legal', '{"complaintsBookUrl":"https://www.livroreclamacoes.pt/","ralEntityName":null,"ralEntityUrl":null,"ralEntityAddress":null,"creditIntermediaryText":null,"dataRetentionText":null,"consentVersion":"2026-10-08"}', true),
  ('financing', '{"simulatorEnabled":false,"partnerName":null,"approvedBy":null,"approvedOn":null}', true),
  ('crm', '{"autoAssign":true,"unansweredAlertMinutes":120,"reservationDefaultDays":3,"appointmentSlotMinutes":60}', false)
on conflict (key) do nothing;

insert into app.features (feature_group, name) values
  ('comfort', 'Ar condicionado'), ('comfort', 'Ar condicionado automático'), ('comfort', 'Ar condicionado bizona'),
  ('comfort', 'Bancos aquecidos'), ('comfort', 'Bancos elétricos'), ('comfort', 'Cruise control'),
  ('comfort', 'Cruise control adaptativo'), ('comfort', 'Sensores de estacionamento traseiros'),
  ('comfort', 'Sensores de estacionamento dianteiros'), ('comfort', 'Câmara de marcha-atrás'),
  ('comfort', 'Câmara 360°'), ('comfort', 'Chave inteligente (keyless)'), ('comfort', 'Portão traseiro elétrico'),
  ('comfort', 'Volante multifunções'), ('comfort', 'Vidros elétricos'), ('comfort', 'Espelhos rebatíveis eletricamente'),
  ('safety', 'ABS'), ('safety', 'ESP'), ('safety', 'Airbags laterais'), ('safety', 'Airbags de cortina'),
  ('safety', 'Aviso de saída de faixa'), ('safety', 'Assistente de manutenção de faixa'),
  ('safety', 'Travagem autónoma de emergência'), ('safety', 'Monitorização de ângulo morto'),
  ('safety', 'Reconhecimento de sinais de trânsito'), ('safety', 'Isofix'), ('safety', 'Sensor de chuva'),
  ('safety', 'Sensor de luzes'),
  ('multimedia', 'Navegação GPS'), ('multimedia', 'Apple CarPlay'), ('multimedia', 'Android Auto'),
  ('multimedia', 'Bluetooth'), ('multimedia', 'Ecrã tátil'), ('multimedia', 'Painel de instrumentos digital'),
  ('multimedia', 'Carregador sem fios'), ('multimedia', 'Sistema de som premium'), ('multimedia', 'Head-up display'),
  ('exterior', 'Jantes de liga leve'), ('exterior', 'Faróis LED'), ('exterior', 'Faróis de nevoeiro'),
  ('exterior', 'Teto panorâmico'), ('exterior', 'Teto de abrir'), ('exterior', 'Barras de tejadilho'),
  ('exterior', 'Gancho de reboque'), ('exterior', 'Vidros escurecidos'),
  ('interior', 'Estofos em pele'), ('interior', 'Estofos em tecido'), ('interior', 'Banco traseiro rebatível'),
  ('interior', 'Iluminação ambiente'), ('interior', 'Apoio de braço central')
on conflict (feature_group, name) do nothing;

-- Rascunhos de páginas legais e institucionais. Marcadores {{...}} são preenchidos com os dados
-- configurados; dados em falta aparecem como «por preencher» e impedem o lançamento.
insert into app.site_pages (slug, kind, title, summary, status, body) values
('privacidade', 'legal', 'Política de privacidade', 'Como tratamos os teus dados pessoais.', 'needs_validation', $md$
## Quem é responsável pelos teus dados

O responsável pelo tratamento é {{empresa.nome_legal}}, NIF {{empresa.nif}}, com sede em {{empresa.morada}} («{{empresa.nome}}»). Para qualquer questão sobre dados pessoais, escreve para {{empresa.email_privacidade}}.

## Que dados tratamos e para quê

- **Pedidos de informação, visitas, test drives e retomas**: nome, telefone e/ou email, mensagem, viatura de interesse e, nas retomas, dados e fotografias da tua viatura. Usamos estes dados para responder ao teu pedido e preparar uma eventual proposta. Fundamento: diligências pré-contratuais a teu pedido.
- **Contacto por WhatsApp**: só respondemos por WhatsApp quando o autorizas ou quando és tu a iniciar a conversa. Podes pedir para parar a qualquer momento.
- **Novidades e promoções**: só com a tua autorização expressa, que podes retirar quando quiseres.
- **Alertas de viaturas por email**: com a tua confirmação por email; cada mensagem tem uma ligação para cancelar.
- **Segurança do site**: registos técnicos mínimos e um identificador cifrado do endereço IP para impedir abusos dos formulários. Fundamento: interesse legítimo em proteger o serviço.
- **Medição de audiência**: só com o teu consentimento (ver a política de cookies).

Não pedimos neste site documentos de identificação, recibos de vencimento nem dados bancários.

## Quem recebe os dados

Os dados são acedidos pela equipa comercial do stand. Recorremos a prestadores de serviços que tratam dados por nossa conta: alojamento do site (Vercel), base de dados e ficheiros (Supabase, região da União Europeia), envio de emails (Resend) e, quando usas WhatsApp, a Meta (WhatsApp Business Platform). Alguns destes prestadores podem tratar dados fora do Espaço Económico Europeu, com as garantias previstas no RGPD (por exemplo, cláusulas contratuais-tipo).

## Durante quanto tempo

{{legal.retencao}}

## Os teus direitos

Podes pedir acesso, retificação, apagamento, limitação, portabilidade e opor-te ao tratamento, bem como retirar o consentimento a qualquer momento, escrevendo para {{empresa.email_privacidade}}. Tens também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados ([www.cnpd.pt](https://www.cnpd.pt)).
$md$),
('cookies', 'legal', 'Política de cookies', 'Que cookies e armazenamento local usamos e como os podes gerir.', 'needs_validation', $md$
## O que usamos

- **Essenciais (sempre ativos)**: guardar a tua escolha de cookies, os favoritos e o comparador. Ficam no armazenamento local do teu navegador, contêm apenas identificadores de viaturas e não são usados para te seguir.
- **Medição de audiência (opcional)**: Google Analytics 4, só depois de autorizares. Não enviamos nomes, emails, telefones, mensagens, matrículas ou VIN.
- **Publicidade (opcional)**: Meta Pixel, só depois de autorizares, para medir a eficácia de anúncios.
- **Conteúdos externos (opcional)**: mapas do Google e vídeos do YouTube/Vimeo incorporados. Sem autorização, mostramos uma ligação em vez do conteúdo.

## Como gerir

Podes aceitar, rejeitar ou personalizar a qualquer momento em «Preferências de cookies», no rodapé do site. Rejeitar não impede a utilização do site.

Responsável: {{empresa.nome_legal}} ({{empresa.email_privacidade}}).
$md$),
('termos', 'legal', 'Termos de utilização', 'Condições de utilização deste site.', 'needs_validation', $md$
## Sobre este site

Este site é explorado por {{empresa.nome_legal}}, NIF {{empresa.nif}}, {{empresa.morada}}. Apresenta viaturas do stock próprio do stand {{empresa.nome}}.

## Informação das viaturas

Procuramos manter a informação correta e atualizada. Preços, disponibilidade e características podem mudar e devem ser confirmados com o stand antes da compra. Em caso de erro manifesto, prevalece a informação confirmada pelo stand.

## Pedidos feitos no site

Os pedidos de informação, visita, test drive ou retoma não constituem reserva nem contrato. Uma marcação só fica confirmada quando o stand a confirmar. Uma avaliação de retoma depende de inspeção da viatura.

## Contactos

{{empresa.email}} · {{empresa.telefone}}
$md$),
('reclamacoes', 'legal', 'Reclamações e resolução de litígios', 'Como apresentar uma reclamação e entidades de resolução alternativa de litígios.', 'needs_validation', $md$
## Livro de Reclamações

Podes apresentar uma reclamação no Livro de Reclamações físico disponível no stand ou no [Livro de Reclamações Eletrónico]({{legal.livro_reclamacoes}}).

## Resolução alternativa de litígios

Em caso de litígio de consumo, podes recorrer à seguinte entidade de resolução alternativa de litígios:

{{legal.ral_nome}} — {{legal.ral_morada}} — {{legal.ral_url}}

Mais informação no Portal do Consumidor ([www.consumidor.gov.pt](https://www.consumidor.gov.pt)).
$md$),
('sobre', 'page', 'Sobre a Inova Auto', null, 'draft', $md$
## Quem somos

[Texto a escrever pelo proprietário: história do stand, forma de trabalhar e o que distingue o serviço. Não incluir prémios, anos de atividade ou certificações sem comprovativo.]
$md$)
on conflict (slug) do nothing;
