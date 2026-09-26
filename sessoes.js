// Guarda o estado temporário da conversa de cada número — usado para fluxos de várias perguntas.

const sistemaArquivos = require('fs');
const caminho = require('path');

const CAMINHO_BD = caminho.join(__dirname, 'db-sessoes.json');

function carregar() {
  if (!sistemaArquivos.existsSync(CAMINHO_BD)) {
    sistemaArquivos.writeFileSync(CAMINHO_BD, JSON.stringify({}, null, 2));
  }
  return JSON.parse(sistemaArquivos.readFileSync(CAMINHO_BD, 'utf-8'));
}

function salvar(sessoes) {
  sistemaArquivos.writeFileSync(CAMINHO_BD, JSON.stringify(sessoes, null, 2));
}

// Retorna a sessão ativa do número, ou null se ele não está no meio de nada.
function obterSessao(telefone) {
  const sessoes = carregar();
  return sessoes[telefone] || null;
}

function definirSessao(telefone, dados) {
  const sessoes = carregar();
  sessoes[telefone] = dados;
  salvar(sessoes);
}

function limparSessao(telefone) {
  const sessoes = carregar();
  delete sessoes[telefone];
  salvar(sessoes);
}

module.exports = { obterSessao, definirSessao, limparSessao };
