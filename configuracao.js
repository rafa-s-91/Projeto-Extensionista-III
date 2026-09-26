// Configurações gerais do bot. Centralizado aqui pra não precisar caçar valores em vários arquivos quando quiser mudar algo.

module.exports = {
  NOME_BOT: 'Assistente Virtual da Associação', // Nome reduzido para ir ao repositório

  // RF01: quantos minutos antes do evento o lembrete deve ser enviado. Ex: 60 = 1 hora antes
  MINUTOS_ANTECEDENCIA_LEMBRETE: 60,

  // RF04: quantos minutos antes do evento as confirmações se encerram e o resumo final é enviado. Use 0 para enviar no horário do evento.
  MINUTOS_PRAZO_CONFIRMACAO: 0,
};
