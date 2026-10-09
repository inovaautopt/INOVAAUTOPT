# Manual do painel (para a equipa do stand)

Endereço: `https://<domínio>/admin`. Não é preciso saber programar.

## Entrar
1. Recebes um convite por email → defines a palavra-passe (mínimo 12 caracteres).
2. Administradores configuram a **verificação em dois passos**: instala Google Authenticator ou
   Microsoft Authenticator no telemóvel, lê o código QR e indica o código de 6 dígitos. Em cada
   entrada é pedido um código novo.
3. Esqueceste a palavra-passe? «Esqueci-me da palavra-passe» no ecrã de entrada.

## Perfis
| Perfil | Pode | Não pode |
| --- | --- | --- |
| Administrador | Tudo: utilizadores, configuração, integrações, exportações | — |
| Gestor de stock | Viaturas, preços, fotografias, importação, conteúdo | Ver contactos de clientes, gerir utilizadores |
| Vendedor | Os seus contactos e a fila central, visitas, reservas, WhatsApp | Alterar preços, dados de viaturas ou permissões |

## Viaturas
- **Nova viatura**: preenche marca e modelo e guarda (fica em *Rascunho* com referência automática, ex.: IA-0005).
- **Fotografias**: na página da viatura, *Carregar fotografias* (várias de uma vez, do computador ou
  telemóvel) ou *Importar por URL*. Ordena com ↑/↓, escolhe a capa e escreve um texto alternativo
  (ex.: «Interior com bancos em pele»). A localização GPS das fotografias é removida automaticamente.
- **Publicar**: só fica disponível com preço, tratamento de IVA, ano, quilómetros, combustível e caixa.
- **Preço**: indica o **preço total de venda** com IVA. Cada alteração fica no histórico; uma descida
  real aparece no site como «Preço reduzido» durante 60 dias.
- **Elétricos**: autonomia, bateria e estado de saúde só aparecem com fonte e data.
- **Histórico verificado** (proprietários, revisões, inspeção, sem acidentes): só com fonte e data.
- **Dados internos** (VIN, matrícula, custo, notas): nunca aparecem no site.
- **Duplicar**: cria uma cópia em rascunho com nova referência (sem fotografias).
- **Reservar** (sem pagamento): escolhe dias e contacto. A viatura deixa de estar «Disponível» e
  aparece «Reservado». No fim: *Converter em venda* ou *Cancelar reserva*. Reservas vencidas
  reabrem o stock automaticamente.
- **Marcar vendida**: sai do stock disponível; a página continua acessível com a indicação «vendida»
  e alternativas, e deixa de aceitar marcações.
- **Arquivar**: sai do site.

## Contactos (CRM)
Estados: Novo → Atribuído → Em contacto → Visita agendada → Proposta enviada → Ganho / Perdido / Arquivado.
- Novos pedidos são **distribuídos automaticamente** entre os vendedores ativos que recebem contactos,
  à vez (quem recebeu há mais tempo recebe o próximo); quem tem ausência registada é saltado; se
  ninguém estiver disponível, o contacto fica na **fila central**.
- Vendedores podem **assumir** contactos da fila. O administrador atribui a qualquer pessoa.
- Regista o que fazes: nota interna, chamada, email, WhatsApp ou proposta. A primeira resposta
  registada tira o alerta «Sem resposta».
- **Perdido** exige o motivo. **Próxima ação** com data aparece a vermelho quando atrasada.
- Autorizações: vês se o cliente autorizou WhatsApp ou marketing; regista quando ele retirar.
- Exportar CSV: só administradores (fica na auditoria).

## Visitas
Os pedidos do site são **pedidos**, não marcações. Em *Visitas* (ou no contacto) escolhe data, hora,
duração e vendedor e *Confirmar*. O sistema impede duas marcações confirmadas sobrepostas para a
mesma viatura ou vendedor. Se o cliente tiver email, recebe a confirmação.

## WhatsApp
Ver [WHATSAPP.md](WHATSAPP.md). Até a Cloud API estar ativa, usa o botão «Abrir WhatsApp» no contacto.

## Importar stock (CSV)
1. *Descarregar modelo CSV* e preencher (uma viatura por linha; separador «;»).
2. Linhas **sem** referência criam viaturas; **com** referência (ex.: IA-0003) atualizam essa viatura.
3. *Analisar ficheiro* mostra o que vai acontecer e os erros por linha, sem gravar nada.
4. *Confirmar e aplicar*. Viaturas ausentes do ficheiro **nunca** são vendidas ou apagadas automaticamente.

## Conteúdo
Páginas, guias, textos legais e perguntas frequentes. Textos legais só podem ser publicados por um
administrador e só com todos os dados da empresa preenchidos.

## Configuração (administrador)
Dados da empresa, serviços (os desligados ficam ocultos no site), informação legal, regras do CRM,
instalações, horários e dias de encerramento.

## Rotinas recomendadas
- **Diária**: contactos novos e sem resposta; visitas por confirmar; WhatsApp.
- **Semanal**: rever stock publicado (preços, estado, fotografias); página *Integrações* (falhas).
- **Mensal**: rever utilizadores e permissões; atualizar dependências (programador); testar um restauro.
