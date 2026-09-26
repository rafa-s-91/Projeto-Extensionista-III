// Converte entre o formato que o usuário digita (DD-MM-AAAA, mais natural no Brasil) e o formato usado internamente pelo armazenamento.js para salvar e comparar datas (AAAA-MM-DD, padrão ISO, que JavaScript entende nativamente com "new Date()").

const REGEX_DATA = /^(\d{2})-(\d{2})-(\d{4})$/;

// Verifica se o texto está no formato DD-MM-AAAA E é uma data que existe de verdade.
function dataValida(texto) {
  const correspondencia = REGEX_DATA.exec(texto.trim());
  if (!correspondencia) return false;

  const dia = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const ano = Number(correspondencia[3]);

  const data = new Date(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T00:00:00`);
  return (
    !isNaN(data.getTime()) &&
    data.getFullYear() === ano &&
    data.getMonth() + 1 === mes &&
    data.getDate() === dia
  );
}

// "15-08-2026" -> "2026-08-15" (para salvar e para os cálculos de data)
function converterParaIso(texto) {
  const [, dia, mes, ano] = REGEX_DATA.exec(texto.trim());
  return `${ano}-${mes}-${dia}`;
}

// "2026-08-15" -> "15-08-2026" (para mostrar de volta pro usuário)
function converterParaExibicao(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}-${mes}-${ano}`;
}

module.exports = { dataValida, converterParaIso, converterParaExibicao };
