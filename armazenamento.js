// Armazenamento simples em arquivo JSON

const sistemaArquivos = require('fs');
const caminho = require('path');

const CAMINHO_BD = caminho.join(__dirname, 'db.json');

function carregar() {
  if (!sistemaArquivos.existsSync(CAMINHO_BD)) {
    sistemaArquivos.writeFileSync(CAMINHO_BD, JSON.stringify({ eventos: [], proximoId: 1 }, null, 2));
  }
  return JSON.parse(sistemaArquivos.readFileSync(CAMINHO_BD, 'utf-8'));
}

function salvar(bd) {
  sistemaArquivos.writeFileSync(CAMINHO_BD, JSON.stringify(bd, null, 2));
}

function criarEvento({ nome, data, hora, criadoPor }) {
  const bd = carregar();
  const evento = {
    id: String(bd.proximoId),
    nome,
    data,
    hora: hora || '',
    criadoPor, // número de telefone de quem criou o evento
    confirmados: [],
    lembreteEnviado: false, // controla se o lembrete de 1h antes já foi mandado
    resumoEnviado: false, // controla se o resumo final (quando o evento começa) já foi mandado
    cancelado: false, // se o organizador cancelar o evento
  };
  bd.eventos.push(evento);
  bd.proximoId += 1;
  salvar(bd);
  return evento;
}

function listarEventos() {
  return carregar().eventos;
}

function obterEvento(id) {
  return carregar().eventos.find(e => e.id === String(id));
}

function confirmarPresenca(id, remetente) {
  const bd = carregar();
  const evento = bd.eventos.find(e => e.id === String(id));
  if (!evento) return false;
  if (!evento.confirmados.includes(remetente)) evento.confirmados.push(remetente);
  salvar(bd);
  return true;
}

function cancelarPresenca(id, remetente) {
  const bd = carregar();
  const evento = bd.eventos.find(e => e.id === String(id));
  if (!evento) return false;
  evento.confirmados = evento.confirmados.filter(n => n !== remetente);
  salvar(bd);
  return true;
}

function marcarLembreteEnviado(id) {
  const bd = carregar();
  const evento = bd.eventos.find(e => e.id === String(id));
  if (!evento) return false;
  evento.lembreteEnviado = true;
  salvar(bd);
  return true;
}

// Cancela o evento inteiro (diferente de cancelar a presença de uma pessoa). Só quem criou o evento pode cancelar. Marcado como cancelado em vez de apagar para manter o registro histórico.
function cancelarEvento(id, remetente) {
  const bd = carregar();
  const evento = bd.eventos.find(e => e.id === String(id));
  if (!evento) return { ok: false, motivo: 'nao_encontrado' };
  if (evento.criadoPor !== remetente) return { ok: false, motivo: 'sem_permissao', evento };
  if (evento.cancelado) return { ok: false, motivo: 'ja_cancelado', evento };

  evento.cancelado = true;
  salvar(bd);
  return { ok: true, evento };
}

function marcarResumoEnviado(id) {
  const bd = carregar();
  const evento = bd.eventos.find(e => e.id === String(id));
  if (!evento) return false;
  evento.resumoEnviado = true;
  salvar(bd);
  return true;
}

// Monta a data/hora do evento como um objeto Date, pra dar pra comparar com "agora". Se não tiver hora definida, assume final do dia (23:59), assim o evento só "some" da lista no dia seguinte.
function obterDataHoraEvento(evento) {
  if (!evento.data) return null;
  const parteHora = evento.hora ? evento.hora : '23:59';
  const data = new Date(`${evento.data}T${parteHora}:00`);
  return isNaN(data.getTime()) ? null : data;
}

// Só os eventos que ainda vão acontecer
function listarEventosFuturos() {
  const agora = new Date();
  return carregar().eventos.filter(e => {
    if (e.cancelado) return false; // eventos cancelados somem da lista
    const dataHora = obterDataHoraEvento(e);
    return !dataHora || dataHora >= agora;
  });
}

// O próximo evento a acontecer, usado quando o usuário não informa o ID.
function obterProximoEvento() {
  const futuros = listarEventosFuturos();
  if (futuros.length === 0) return null;

  futuros.sort((a, b) => {
    const dataA = obterDataHoraEvento(a);
    const dataB = obterDataHoraEvento(b);
    if (!dataA) return 1;
    if (!dataB) return -1;
    return dataA - dataB;
  });

  return futuros[0];
}

module.exports = {
  criarEvento,
  listarEventos,
  listarEventosFuturos,
  obterProximoEvento,
  obterDataHoraEvento,
  obterEvento,
  confirmarPresenca,
  cancelarPresenca,
  cancelarEvento,
  marcarLembreteEnviado,
  marcarResumoEnviado,
};
