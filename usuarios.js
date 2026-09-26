// Guarda a relação "número de telefone -> nome" que a pessoa escolhe da primeira vez que fala com o bot. Fica num arquivo JSON separado do db.json de eventos pra não misturar.

const sistemaArquivos = require('fs');
const caminho = require('path');

const CAMINHO_BD = caminho.join(__dirname, 'db-usuarios.json');

function carregar() {
  if (!sistemaArquivos.existsSync(CAMINHO_BD)) {
    sistemaArquivos.writeFileSync(CAMINHO_BD, JSON.stringify({}, null, 2));
  }
  return JSON.parse(sistemaArquivos.readFileSync(CAMINHO_BD, 'utf-8'));
}

function salvar(usuarios) {
  sistemaArquivos.writeFileSync(CAMINHO_BD, JSON.stringify(usuarios, null, 2));
}

// Retorna o registro do usuário, ou null se ele nunca falou com o bot antes.
function obterUsuario(telefone) {
  const usuarios = carregar();
  return usuarios[telefone] || null;
}

// Cria um registro "pendente": o bot já sabe desse número, mas ainda está esperando a pessoa responder qual é o nome dela.
function criarUsuarioPendente(telefone) {
  const usuarios = carregar();
  // "nome" começa como placeholder vazio (null): é um campo que vai receber um dado pessoal fornecido pelo próprio usuário durante a conversa (RNF04 - Segurança/privacidade). Nenhum nome no código.
  usuarios[telefone] = { nome: null, aguardandoNome: true };
  salvar(usuarios);
  return usuarios[telefone];
}

// Salva o nome escolhido e encerra o estado de "esperando nome".
function definirNomeUsuario(telefone, nome) {
  const usuarios = carregar();
  if (!usuarios[telefone]) usuarios[telefone] = {};
  usuarios[telefone].nome = nome;
  usuarios[telefone].aguardandoNome = false;
  salvar(usuarios);
  return usuarios[telefone];
}

// Atalho: devolve o nome já cadastrado, ou o próprio número como alternativa (caso, por algum motivo, não tenha nome salvo).
function obterNome(telefone) {
  const usuario = obterUsuario(telefone);
  return usuario?.nome || telefone;
}

module.exports = { obterUsuario, criarUsuarioPendente, definirNomeUsuario, obterNome };
