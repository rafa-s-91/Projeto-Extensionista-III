// Centraliza o envio de mensagens pela API do WhatsApp. Tanto o servidor.js quanto o agendador.js usam essa mesma função.

const TOKEN_WHATSAPP = process.env.TOKEN_WHATSAPP;
const ID_NUMERO_TELEFONE = process.env.ID_NUMERO_TELEFONE;

async function enviarMensagem(para, corpo) {
  const url = `https://graph.facebook.com/v20.0/${ID_NUMERO_TELEFONE}/messages`;

  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_WHATSAPP}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      text: { body: corpo },
    }),
  });

  if (!resposta.ok) {
    const textoErro = await resposta.text();
    console.error('Erro ao enviar mensagem:', resposta.status, textoErro);
  }

  return resposta.ok;
}

// Envia uma mensagem com botões clicáveis (até 3), em vez de exigir que a pessoa digite
async function enviarBotoes(para, corpo, botoes) {
  const url = `https://graph.facebook.com/v20.0/${ID_NUMERO_TELEFONE}/messages`;

  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_WHATSAPP}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: corpo },
        action: {
          // A API aceita no máximo 3 botões por mensagem. O título de cada botão tem limite de 20 caracteres.
          buttons: botoes.slice(0, 3).map(botao => ({
            type: 'reply',
            reply: { id: botao.identificador, title: botao.titulo.slice(0, 20) },
          })),
        },
      },
    }),
  });

  if (!resposta.ok) {
    const textoErro = await resposta.text();
    console.error('Erro ao enviar botões:', resposta.status, textoErro);
  }

  return resposta.ok;
}

module.exports = { enviarMensagem, enviarBotoes };
