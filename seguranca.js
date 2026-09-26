// RNF04 - Segurança: valida que a requisição veio mesmo da Meta. A Meta assina cada requisição do webhook com o "App Secret" do seu app, no cabeçalho X-Hub-Signature-256 . Sem essa checagem, qualquer pessoa que descobrisse a URL do seu servidor poderia enviar mensagens falsas criando eventos ou confirmando presenças em nome de outros.

const criptografia = require('crypto');

const CHAVE_SECRETA_APP = process.env.CHAVE_SECRETA_APP;

// Importante: captura o corpo bruto da requisição que é necessário para calcular a assinatura. O express.json() converte automaticamente o corpo para um objeto JavaScript e descarta o texto original. Mas o cálculo da assinatura HMAC exige os bytes exatamente como a Meta os enviou, por isso guardar uma cópia aqui antes dessa conversão acontecer.
function capturarCorpoBruto(requisicao, resposta, buffer) {
  requisicao.corpoBruto = buffer;
}

function verificarAssinatura(requisicao, resposta, proximo) {
  // Se a CHAVE_SECRETA_APP não estiver configurada, avisar mas não bloquear. O projeto continua rodando em ambiente de teste inicial.
  if (!CHAVE_SECRETA_APP) {
    console.warn('CHAVE_SECRETA_APP não configurada: assinatura do webhook NÃO está sendo validada.');
    return proximo();
  }

  const assinatura = requisicao.get('X-Hub-Signature-256'); // nome de cabeçalho definido pela Meta
  if (!assinatura) {
    console.error('Requisição sem assinatura, rejeitada.');
    return resposta.sendStatus(401);
  }

  const esperado =
    'sha256=' +
    criptografia.createHmac('sha256', CHAVE_SECRETA_APP).update(requisicao.corpoBruto).digest('hex');

  // IMPORTANTE: timingSafeEqual evita um tipo de ataque que descobre a assinatura medindo o tempo de resposta da comparação.
  const bufferAssinatura = Buffer.from(assinatura);
  const bufferEsperado = Buffer.from(esperado);

  if (
    bufferAssinatura.length !== bufferEsperado.length ||
    !criptografia.timingSafeEqual(bufferAssinatura, bufferEsperado)
  ) {
    console.error('Assinatura inválida, requisição rejeitada.');
    return resposta.sendStatus(401);
  }

  proximo();
}

module.exports = { capturarCorpoBruto, verificarAssinatura };
