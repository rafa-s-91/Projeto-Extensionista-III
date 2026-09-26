// Arquivo limpo sem dados identificáveis
// Lembrete com botões de confirmação, com antecedência configurável (RF01/RF02). Resumo final de participação, ao fim do prazo de confirmação (RF04)

const agendadorCron = require('node-cron');
const armazenamento = require('./armazenamento');
const usuarios = require('./usuarios');
const utilitariosData = require('./utilitariosData');
const { enviarMensagem, enviarBotoes } = require('./mensagens');
const {
  NOME_BOT,
  MINUTOS_ANTECEDENCIA_LEMBRETE,
  MINUTOS_PRAZO_CONFIRMACAO,
} = require('./configuracao');

async function verificarEventosENotificar() {
  const eventos = armazenamento.listarEventos();
  const agora = new Date();

  for (const evento of eventos) {
    if (evento.cancelado) continue; // evento cancelado não dispara nada
    if (!evento.hora) continue; // sem hora definida. não dá pra calcular os avisos

    const dataEvento = armazenamento.obterDataHoraEvento(evento);
    if (!dataEvento) continue;

    const minutosRestantes = (dataEvento.getTime() - agora.getTime()) / 60000;

    // RF01 + RF02: lembrete com botões, na antecedência configurada. A janela de 1 minuto existe porque o cron roda a cada minuto.
    if (
      !evento.lembreteEnviado &&
      minutosRestantes <= MINUTOS_ANTECEDENCIA_LEMBRETE &&
      minutosRestantes > MINUTOS_ANTECEDENCIA_LEMBRETE - 1
    ) {
      // O lembrete vai para todos que já interagiram com o bot, para que quem ainda não respondeu também possa confirmar pelo botão.
      const destinatarios = new Set([...evento.confirmados, evento.criadoPor]);

      for (const numero of destinatarios) {
        const nome = usuarios.obterNome(numero);
        await enviarBotoes(
          numero,
          `Olá, ${nome}!\n\nO evento "${evento.nome}" acontece em breve (${utilitariosData.converterParaExibicao(evento.data)} às ${evento.hora}).\n\nVocê vai participar?`,
          [
            { identificador: `simresumo_${evento.id}`, titulo: 'Sim, eu vou' },
            { identificador: `naoresumo_${evento.id}`, titulo: 'Não vou' },
          ]
        );
      }

      armazenamento.marcarLembreteEnviado(evento.id);
      console.log(`Lembrete enviado para o evento #${evento.id}`);
    }

    // RF04: resumo final ao fim do prazo de confirmação
    if (
      !evento.resumoEnviado &&
      minutosRestantes <= MINUTOS_PRAZO_CONFIRMACAO &&
      minutosRestantes > MINUTOS_PRAZO_CONFIRMACAO - 1
    ) {
      const total = evento.confirmados.length;
      const listaNomes = evento.confirmados
        .map(numero => `- ${usuarios.obterNome(numero)}`)
        .join('\n');

      const texto =
        total === 0
          ? `Resumo do evento "${evento.nome}"\n\nNinguém confirmou presença.\n\n— ${NOME_BOT}`
          : `Resumo do evento "${evento.nome}"\n${utilitariosData.converterParaExibicao(evento.data)} às ${evento.hora}\n\nTotal de confirmados: ${total}\n\n${listaNomes}\n\n— ${NOME_BOT}`;

      const destinatarios = new Set(evento.confirmados);
      destinatarios.add(evento.criadoPor);

      for (const numero of destinatarios) {
        await enviarMensagem(numero, texto);
      }

      armazenamento.marcarResumoEnviado(evento.id);
      console.log(`Resumo final enviado para o evento #${evento.id}`);
    }
  }
}

function iniciar() {
  agendadorCron.schedule('* * * * *', () => {
    verificarEventosENotificar().catch(erro => console.error('Erro no agendador:', erro));
  });
  console.log('Agendador de lembretes iniciado (checando a cada minuto).');
}

module.exports = { iniciar };
