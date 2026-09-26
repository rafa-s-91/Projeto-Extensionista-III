# Projeto-Extensionista-III

**Assistente Virtual de WhatsApp — Confirmação de Presença em Eventos**  
Chatbot para WhatsApp que permite a uma associação criar eventos e deixar seus membros confirmarem ou cancelarem presença com lembrete automático, botões de resposta rápida e resumo de participação usando a API oficial da Meta.  

**O que o assistente faz**  

- Qualquer membro pode criar um evento respondendo a três perguntas simples (nome, data e horário), sem precisar decorar comando nenhum.  
- Ao ser criado, o evento já pergunta "Você vai participar?" com botões de resposta sem precisar digitar.  
- Um lembrete automático é enviado a cada membro antes do evento (com antecedência configurável), também com botões.  
- Ao confirmar pelo botão do lembrete, a pessoa já recebe na hora um resumo com o total de confirmados e a lista de nomes.  
- Quem criou o evento pode cancelá-lo a qualquer momento e todos que haviam confirmado são avisados automaticamente.  
- Eventos que já aconteceram somem sozinhos da listagem.

**Tecnologias utilizadas**  
| | |  
|-|-|
| **Tecnologia** | **Papel no projeto** |   
| JavaScript (Node.js >= 18) | Linguagem e ambiente de execução |   
| Express.js | Servidor HTTP que recebe as mensagens do WhatsApp |   
| WhatsApp Cloud API (Meta) | Envio e recebimento de mensagens |   
| node-cron | Agendamento do lembrete e do resumo automáticos |   
| crypto (nativo do Node) | Validação da assinatura do webhook |   
| dotenv | Leitura das variáveis de ambiente |   
| ngrok | Exposição do ambiente durante o desenvolvimento/testes |   
| Render | Hospedagem em produção |
| | |  

   
**Estrutura do projeto**  

 ├── servidor.js          # Ponto de entrada: recebe mensagens, roteia comandos  
 ├── armazenamento.js     # Persistência dos eventos (db.json)  
 ├── usuarios.js          # Cadastro de nome por número de telefone  
 ├── sessoes.js            # Estado da conversa (ex: no meio da criação de um evento)  
 ├── utilitariosData.js    # Conversão de datas entre formato do usuário e ISO  
 ├── mensagens.js           # Envio de mensagens e botões via API da Meta  
 ├── agendador.js            # Lembrete e resumo automáticos (roda a cada minuto)  
 ├── seguranca.js             # Validação de que a requisição veio mesmo da Meta  
 ├── configuracao.js           # Nome do bot e prazos configuráveis  
 ├── package.json  
 ├── .env.example                # Modelo de variáveis de ambiente  
 └── .gitignore  
   
Cada arquivo tem uma única responsabilidade  

**Pré-requisitos**  

- Node.js versão 18 ou superior  
- Uma conta de desenvolvedor na Meta for Developers  
- Um número de telefone de teste no WhatsApp Cloud API  
- ngrok (apenas para rodar localmente em ambiente de teste)

**Como executar**
  
**Instalar as dependências**  

npm install  
   
**Configurar as variáveis de ambiente**  

Copie .env.example para .env: cp .env.example .env  
   
E preencha com seus dados:  
| | |  
|-|-|
| **Variável** | **Onde encontrar** |   
| TOKEN_VERIFICACAO | Você mesmo escolhe  |   
| TOKEN_WHATSAPP | Painel da Meta -> WhatsApp  |   
| ID_NUMERO_TELEFONE | Painel da Meta -> WhatsApp  |   
| CHAVE_SECRETA_APP | Painel da Meta -> Configurações do app |   
| PORTA | Porta local do servidor (padrão: 3000) |
| | |  

   
**Rodar o servidor**  

npm start  
   
**Expor o servidor publicamente** (para o ambiente de teste)

Como a Meta precisa de uma URL pública com HTTPS para falar com o seu servidor, use o ngrok em outro terminal:  
ngrok http 3000  
   
**Configurar o Webhook no painel da Meta**  

1. Em **WhatsApp -> Configuração**, defina a  **Callback URL** como https://SUA_URL_DO_NGROK/webhook.  
2. Em **Verify Token**, use o mesmo valor de TOKEN_VERIFICACAO do seu .env.  
3. Depois de verificado, assine o campo **messages**.
    
**Comandos disponíveis**  

O bot também entende comandos digitados, além dos botões:  
criar evento     -> inicia a criação de um evento, pergunta por pergunta  
 eventos          -> lista os próximos eventos e oferece botões de confirmação  
 presentes        -> mostra quem já confirmou presença  
 cancelar         -> cancela a SUA presença  
 cancelar evento  -> cancela o evento inteiro (só quem criou pode)  
   
**Configuração de prazos**  

Em configuracao.js:  
MINUTOS_ANTECEDENCIA_LEMBRETE: 60, -> quantos minutos antes o lembrete é enviado | MINUTOS_PRAZO_CONFIRMACAO: 0, -> quando o resumo final é enviado, em relação ao horário do evento  
   
**Segurança e privacidade**  
- As credenciais reais nunca ficam no código: todas vêm do .env, que está no .gitignore e nunca é versionado.  
- Toda requisição recebida no webhook tem sua assinatura validada (seguranca.js), garantindo que ela veio mesmo da Meta.  
- Os únicos dados pessoais armazenados são o nome (fornecido voluntariamente pelo próprio usuário na primeira conversa) e o número de telefone, guardados localmente em db.json e db-usuarios.json — arquivos gerados em tempo de execução, também fora do controle de versão, e não compartilhados com terceiros.  
