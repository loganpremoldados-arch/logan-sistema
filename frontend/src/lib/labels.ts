export const stageLabels: Record<string, string> = {
  NOVO_CONTATO: "Novo contato",
  QUALIFICACAO: "Qualificação",
  LEVANTAMENTO_NECESSIDADE: "Levantamento de necessidade",
  ELABORACAO_ORCAMENTO: "Elaboração de orçamento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  EM_NEGOCIACAO: "Em negociação",
  AGUARDANDO_DECISAO: "Aguardando decisão",
  FECHADA: "Fechada",
  PERDIDA: "Perdida",
  SUSPENSA: "Suspensa",
};

export const stageOrder = [
  "NOVO_CONTATO", "QUALIFICACAO", "LEVANTAMENTO_NECESSIDADE", "ELABORACAO_ORCAMENTO",
  "PROPOSTA_ENVIADA", "EM_NEGOCIACAO", "AGUARDANDO_DECISAO", "FECHADA", "PERDIDA", "SUSPENSA",
];

export const proposalStatusLabels: Record<string, string> = {
  EM_ELABORACAO: "Em elaboração",
  ENVIADA: "Enviada",
  VISUALIZADA: "Visualizada",
  EM_NEGOCIACAO: "Em negociação",
  REVISAO_SOLICITADA: "Revisão solicitada",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

export const orderCommercialLabels: Record<string, string> = {
  EM_ELABORACAO: "Em elaboração",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  CANCELADO: "Cancelado",
  ENCERRADO: "Encerrado",
};

export const orderFinancialLabels: Record<string, string> = {
  NAO_FATURADO: "Não faturado",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PARCIALMENTE_PAGO: "Parcialmente pago",
  PAGO: "Pago",
  VENCIDO: "Vencido",
  COM_SALDO_PENDENTE: "Com saldo pendente",
};

export const orderOperationalLabels: Record<string, string> = {
  AGUARDANDO_LIBERACAO: "Aguardando liberação",
  AGUARDANDO_PROGRAMACAO: "Aguardando programação",
  AGUARDANDO_MATERIA_PRIMA: "Aguardando matéria-prima",
  AGUARDANDO_FORMAS: "Aguardando formas",
  NA_FILA_PRODUCAO: "Na fila de produção",
  EM_FABRICACAO: "Em fabricação",
  EM_CURA: "Em cura",
  EM_ACABAMENTO: "Em acabamento",
  PRONTO_PARA_SEPARACAO: "Pronto para separação",
  EM_SEPARACAO: "Em separação",
  PARCIALMENTE_ENTREGUE: "Parcialmente entregue",
  ENTREGUE_INTEGRALMENTE: "Entregue integralmente",
};

export const deadlineLabels: Record<string, { label: string; badge: string }> = {
  NO_PRAZO: { label: "No prazo", badge: "badge-green" },
  ATENCAO: { label: "Atenção", badge: "badge-yellow" },
  URGENTE: { label: "Urgente", badge: "badge-orange" },
  EM_RISCO_DE_ATRASO: { label: "Risco de atraso", badge: "badge-orange" },
  ATRASADO: { label: "Atrasado", badge: "badge-red" },
  CONCLUIDO: { label: "Concluído", badge: "badge-green" },
};

export const customerProfileLabels: Record<string, string> = {
  CONSUMIDOR_FINAL: "Consumidor final",
  CONSTRUTORA: "Construtora",
  REVENDEDOR: "Revendedor",
  ENGENHEIRO: "Engenheiro",
  ARQUITETO: "Arquiteto",
  PROFISSIONAL_CONSTRUCAO: "Profissional da construção civil",
  ORGAO_PUBLICO: "Órgão público",
  OUTROS: "Outros",
};

export const activityTypeLabels: Record<string, string> = {
  LIGACAO: "Ligação", WHATSAPP: "WhatsApp", EMAIL: "E-mail", VISITA: "Visita", REUNIAO: "Reunião",
  ENVIO_ORCAMENTO: "Envio de orçamento", NEGOCIACAO: "Negociação", RETORNO_CLIENTE: "Retorno do cliente", OUTROS: "Outros",
};

export const roleLabels: Record<string, string> = {
  ADMINISTRADOR: "Administrador", GESTAO: "Gestão", COMERCIAL: "Comercial",
  PRODUCAO: "Produção", EXPEDICAO: "Expedição", FINANCEIRO: "Financeiro",
};

export const migrationIssueStatusLabels: Record<string, string> = {
  PENDENTE: "Pendente", APROVADO: "Aprovado", IGNORADO: "Ignorado", REPROCESSAR: "Reprocessar",
};
