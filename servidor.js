require('dotenv').config();
const express = require('express');
const armazenamento = require('./armazenamento');
const usuarios = require('./usuarios');
const sessoes = require('./sessoes');
const utilitariosData = require('./utilitariosData');
const { enviarMensagem, enviarBotoes } = require('./mensagens');
const agendador = require('./agendador');
const { NOME_BOT } = require('./configuracao');

const seguranca = require('./seguranca');

const aplicativo = express();
aplicativo.use(express.json({ verify: seguranca.capturarCorpoBruto }));

const TOKEN_VERIFICACAO = process.env.TOKEN_VERIFICACAO;

// Verificação do Webhook. A mta faz essa checagem quando você configura o webhook no painel de desenvolvedores
aplicativo.get('/webhook', (requisicao, resposta) => {
  const modo = requisicao.query['hub.mode'];
  const tokenRecebido = requisicao.query['hub.verify_token'];
  const desafio = requisicao.query['hub.challenge'];

  if (modo === 'subscribe' && tokenRecebido === TOKEN_VERIFICACAO) {
    console.log('Webhook verificado com sucesso!');
    return resposta.status(200).send(desafio);
  }
  return resposta.sendStatus(403);
});

// Recebimento de mensagens dos usuários
aplicativo.post('/webhook', seguranca.verificarAssinatura, async (requisicao, resposta) => {
  // Responde rápido pra meta não ficar reenviando o evento
  resposta.sendStatus(200);

  try {
    const entrada = requisicao.body.entry?.[0];
    const alteracao = entrada?.changes?.[0];
    const mensagemRecebida = alteracao?.value?.messages?.[0];
    if (!mensagemRecebida) return; // pode ser só uma notificação de status (entregue/lido)

    const remetente = mensagemRecebida.from; // número de quem mandou (com código do país)

    // A pessoa pode ter digitado um texto OU clicado num botão. Quando clica, a resposta vem em interactive.button_reply.
    const idBotao = mensagemRecebida.interactive?.button_reply?.id;
    const texto = idBotao || mensagemRecebida.text?.body?.trim();
    if (!texto) return; // ignora áudios, figurinhas, etc

    // Fluxo de cadastro de nome (só acontece na primeira conversa)
    const usuario = usuarios.obterUsuario(remetente);

    if (!usuario) {
      usuarios.criarUsuarioPendente(remetente);
      await enviarMensagem(remetente, `Olá! Eu sou o ${NOME_BOT}. Antes de começar, como você gostaria de ser chamado(a)? (Digite seu nome)`);
      return;
    }

    // O número de telefone é o único dado que identifica a pessoa nesta etapa; o nome, quando ainda não informado, fica como placeholder vazio (null) até o próprio usuário digitá-lo — não há nenhum dado pessoal no código.
    if (usuario.aguardandoNome) {
      usuarios.definirNomeUsuario(remetente, texto);
      // Na primeira interação, em vez de já despejar a lista completa de comandos, pergunta o que a pessoa quer fazer. Simplifica a primeira experiência de uso — resposta em texto livre mesmo (sem botões), pois ainda não hánenhum evento para oferecer como opção clicável.
      await enviarMensagem(remetente, `${texto}, vi que esta é nossa primeira interação. Gostaria de criar um evento ou consultar os eventos existentes?`);
      return;
    }

    // Fluxo de criação de evento passo a passo com várias perguntas seguidas
    const sessao = sessoes.obterSessao(remetente);
    if (sessao) {
      const respostaFluxo = await continuarCriacaoEvento(remetente, texto, sessao);
      if (respostaFluxo) await enviarMensagem(remetente, respostaFluxo);
      return;
    }

    const respostaComando = await tratarComando(remetente, texto);
    if (respostaComando) await enviarMensagem(remetente, respostaComando);
  } catch (erro) {
    console.error('Erro ao processar mensagem:', erro);
  }
});

function textoAjuda() {
  return (
    `${NOME_BOT} - comandos disponíveis:\n\n` +
    'criar evento — cria um evento respondendo pergunta por pergunta\n' +
    'eventos — mostra os eventos e botões para confirmar\n' +
    'presentes — mostra quem já confirmou\n' +
    'cancelar — cancela a SUA presença\n' +
    'cancelar evento — cancela o evento (só quem criou)\n\n' +
    'Dica: você também pode responder usando os botões, sem precisar digitar.'
  );
}

// Descobre qual evento o comando deve afetar: se a pessoa digitou um ID (ex: "confirmar 3"), usa esse. Se não digitou nada (ex: só "confirmar"), usa o próximo evento a acontecer.
function resolverIdEvento(texto) {
  const partes = texto.trim().split(/\s+/);
  if (partes.length >= 2) return partes[1];

  const proximo = armazenamento.obterProximoEvento();
  return proximo ? proximo.id : null;
}

// Conduz o fluxo de criação de evento em várias mensagens (nome -> data -> hora)
async function continuarCriacaoEvento(remetente, texto, sessao) {
  const textoMinusculo = texto.trim().toLowerCase();

  // Permite desistir a qualquer momento do fluxo
  if (textoMinusculo === 'cancelar' || textoMinusculo === 'sair') {
    sessoes.limparSessao(remetente);
    return 'Criação de evento cancelada.';
  }

  if (sessao.etapa === 'nome') {
    sessao.dados.nome = texto.trim();
    sessao.etapa = 'data';
    sessoes.definirSessao(remetente, sessao);
    return 'Qual é a data do evento? (formato: DD-MM-AAAA, ex: 01-01-2001)';
  }

  if (sessao.etapa === 'data') {
    if (!utilitariosData.dataValida(texto)) {
      return 'Formato inválido. Digite a data como DD-MM-AAAA (ex: 01-01-2001).';
    }
    sessao.dados.data = utilitariosData.converterParaIso(texto); // guarda internamente como AAAA-MM-DD
    sessao.etapa = 'hora';
    sessoes.definirSessao(remetente, sessao);
    return 'Qual é o horário? (formato: HH:MM, ex: 19:00)';
  }

  if (sessao.etapa === 'hora') {
    let hora = '';
    if (textoMinusculo !== 'pular') {
      const horaValida = /^([01]\d|2[0-3]):([0-5]\d)$/.test(texto.trim());
      if (!horaValida) {
        return 'Formato inválido. Digite o horário como HH:MM (ex: 19:00) ou "pular".';
      }
      hora = texto.trim();
    }

    const evento = armazenamento.criarEvento({
      nome: sessao.dados.nome,
      data: sessao.dados.data,
      hora,
      criadoPor: remetente,
    });
    sessoes.limparSessao(remetente);

    // Alteração pós-validação: removido o ID: e o emoji de calendário da mensagem.
    await enviarBotoes(
      remetente,
      `Evento criado!\n\n${evento.nome} no dia ${utilitariosData.converterParaExibicao(evento.data)}\n\nVocê vai participar?`,
      [
        { identificador: `sim_${evento.id}`, titulo: 'Sim, eu vou' },
        { identificador: `nao_${evento.id}`, titulo: 'Não vou' },
      ]
    );
    return null; // a resposta já foi enviada acima, com botões
  }
}

// 3. Cérebro do bot: decide o que fazer com cada mensagem recebida
async function tratarComando(remetente, texto) {
  const textoMinusculo = texto.toLowerCase();

  // Cliques de botão chegam como IDs no formato "sim_<id>" / "nao_<id>".
  if (textoMinusculo.startsWith('sim_')) {
    const id = texto.slice(4);
    const ok = armazenamento.confirmarPresenca(id, remetente);
    if (!ok) return 'Esse evento não foi encontrado.';
    const evento = armazenamento.obterEvento(id);
    return `Presença confirmada em "${evento.nome}" às ${evento.hora}!\nAté lá.`;
  }

  if (textoMinusculo.startsWith('nao_')) {
    const id = texto.slice(4);
    const evento = armazenamento.obterEvento(id);
    const ok = armazenamento.cancelarPresenca(id, remetente);
    if (!ok) return 'Esse evento não foi encontrado.';
    return `Tudo bem, anotamos que você não vai a "${evento.nome}".`;
  }

  if (textoMinusculo.startsWith('simresumo_')) {
    const id = texto.slice('simresumo_'.length);
    const ok = armazenamento.confirmarPresenca(id, remetente);
    if (!ok) return 'Esse evento não foi encontrado.';
    const evento = armazenamento.obterEvento(id);

    const nomes = evento.confirmados.map(numero => usuarios.obterNome(numero));
    return (
      `Resumo do evento "${evento.nome}" marcado para hoje às ${evento.hora}.\n\n` +
      `Total de confirmados: ${evento.confirmados.length}\n\n` +
      nomes.join('\n')
    );
  }

  if (textoMinusculo.startsWith('naoresumo_')) {
    const id = texto.slice('naoresumo_'.length);
    const evento = armazenamento.obterEvento(id);
    const ok = armazenamento.cancelarPresenca(id, remetente);
    if (!ok) return 'Esse evento não foi encontrado.';
    return `Tudo bem, anotamos que você não vai a "${evento.nome}".`;
  }

  // "criar evento" inicia o fluxo guiado (pergunta por pergunta)
  if (textoMinusculo === 'criar evento' || textoMinusculo === 'novo evento') {
    sessoes.definirSessao(remetente, { etapa: 'nome', dados: {} });
    return 'Qual o nome do evento?';
  }

  if (textoMinusculo === 'eventos') {
    const eventos = armazenamento.listarEventosFuturos();
    if (eventos.length === 0) return 'Nenhum evento futuro no momento. Crie um digitando:\ncriar evento';

    // Se só existe um evento futuro, já manda com botões
    if (eventos.length === 1) {
      const evento = eventos[0];
      await enviarBotoes(
        remetente,
        `${evento.nome}\n${utilitariosData.converterParaExibicao(evento.data)}${evento.hora ? ' às ' + evento.hora : ''}\nConfirmados até agora: ${evento.confirmados.length}\n\nVocê vai participar?`,
        [
          { identificador: `sim_${evento.id}`, titulo: 'Sim, eu vou' },
          { identificador: `nao_${evento.id}`, titulo: 'Não vou' },
        ]
      );
      return null;
    }

    // Com vários eventos, lista todos e manda os botões do próximo a acontecer
    const lista = eventos
      .map(evento => `#${evento.id} - ${evento.nome} (${utilitariosData.converterParaExibicao(evento.data)} ${evento.hora || ''})\nConfirmados: ${evento.confirmados.length}`)
      .join('\n\n');
    await enviarMensagem(remetente, lista);

    const proximo = armazenamento.obterProximoEvento();
    await enviarBotoes(
      remetente,
      `O próximo é "${proximo.nome}".\nVocê vai participar?`,
      [
        { identificador: `sim_${proximo.id}`, titulo: 'Sim, eu vou' },
        { identificador: `nao_${proximo.id}`, titulo: 'Não vou' },
      ]
    );
    return null;
  }

  if (textoMinusculo.startsWith('confirmar')) {
    const id = resolverIdEvento(texto);
    if (!id) return 'Não há nenhum evento futuro no momento. Crie um digitando:\ncriar evento';
    const ok = armazenamento.confirmarPresenca(id, remetente);
    if (!ok) return `Evento #${id} não encontrado.`;
    const evento = armazenamento.obterEvento(id);
    return `Presença confirmada em "${evento.nome}"!`;
  }

  // RF05: cancelar o EVENTO INTEIRO (só quem criou pode) e avisar todo mundo
  if (textoMinusculo.startsWith('cancelar evento')) {
    // "cancelar evento" (usa o próximo) ou "cancelar evento 3" (id explícito)
    const partes = texto.trim().split(/\s+/);
    let id = partes[2];
    if (!id) {
      const proximo = armazenamento.obterProximoEvento();
      id = proximo ? proximo.id : null;
    }
    if (!id) return 'Não há nenhum evento futuro para cancelar.';

    const resultado = armazenamento.cancelarEvento(id, remetente);

    if (!resultado.ok && resultado.motivo === 'nao_encontrado') {
      return `Evento #${id} não encontrado.`;
    }
    if (!resultado.ok && resultado.motivo === 'sem_permissao') {
      return `Só quem criou o evento "${resultado.evento.nome}" pode cancelá-lo.`;
    }
    if (!resultado.ok && resultado.motivo === 'ja_cancelado') {
      return `O evento "${resultado.evento.nome}" já estava cancelado.`;
    }

    const evento = resultado.evento;

    // Notifica todos que haviam confirmado presença
    const aviso = `ATENÇÃO: o evento "${evento.nome}" (${utilitariosData.converterParaExibicao(evento.data)}${evento.hora ? ' às ' + evento.hora : ''}) foi CANCELADO.\n\n— ${NOME_BOT}`;
    for (const numero of evento.confirmados) {
      if (numero !== remetente) await enviarMensagem(numero, aviso);
    }

    const quantidade = evento.confirmados.filter(n => n !== remetente).length;
    return `Evento "${evento.nome}" cancelado.\n${quantidade > 0 ? `${quantidade} participante(s) foram avisados.` : 'Ninguém havia confirmado presença.'}`;
  }

  // Cancelar apenas a PRESENÇA da própria pessoa
  if (textoMinusculo.startsWith('cancelar')) {
    const id = resolverIdEvento(texto);
    if (!id) return 'Não há nenhum evento futuro no momento.';
    const evento = armazenamento.obterEvento(id);
    const ok = armazenamento.cancelarPresenca(id, remetente);
    if (!ok) return `Evento #${id} não encontrado.`;
    return `Presença cancelada em "${evento.nome}".`;
  }

  if (textoMinusculo.startsWith('presentes')) {
    const id = resolverIdEvento(texto);
    if (!id) return 'Não há nenhum evento futuro no momento.';
    const evento = armazenamento.obterEvento(id);
    if (!evento) return `Evento #${id} não encontrado.`;
    if (evento.confirmados.length === 0) return `Ninguém confirmou presença em "${evento.nome}" ainda.`;
    const nomes = evento.confirmados.map(numero => usuarios.obterNome(numero));
    return `Confirmados em "${evento.nome}":\n` + nomes.map(item => `- ${item}`).join('\n');
  }

  return 'Não entendi. ' + textoAjuda();
}

const PORTA = process.env.PORTA || 3000;
aplicativo.listen(PORTA, () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
  agendador.iniciar(); // liga a checagem periódica de lembretes
});
