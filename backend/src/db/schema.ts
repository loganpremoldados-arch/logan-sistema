// ============================================================================
// LOGAN | Gestão Integrada — Schema do banco (Drizzle ORM / PostgreSQL)
// Fase 1: Clientes, Comercial/CRM, Propostas, Pedidos, Produção básica,
// Estoque básico, Usuários, Auditoria, Validação da Migração.
// ============================================================================
import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------
export const roleEnum = pgEnum("role", [
  "ADMINISTRADOR",
  "GESTAO",
  "COMERCIAL",
  "PRODUCAO",
  "EXPEDICAO",
  "FINANCEIRO",
]);

export const customerProfileEnum = pgEnum("customer_profile", [
  "CONSUMIDOR_FINAL",
  "CONSTRUTORA",
  "REVENDEDOR",
  "ENGENHEIRO",
  "ARQUITETO",
  "PROFISSIONAL_CONSTRUCAO",
  "ORGAO_PUBLICO",
  "OUTROS",
]);

export const customerStatusEnum = pgEnum("customer_status", [
  "ATIVO",
  "INATIVO",
  "EM_ANALISE",
]);

export const opportunityStageEnum = pgEnum("opportunity_stage", [
  "NOVO_CONTATO",
  "QUALIFICACAO",
  "LEVANTAMENTO_NECESSIDADE",
  "ELABORACAO_ORCAMENTO",
  "PROPOSTA_ENVIADA",
  "EM_NEGOCIACAO",
  "AGUARDANDO_DECISAO",
  "FECHADA",
  "PERDIDA",
  "SUSPENSA",
]);

export const priorityEnum = pgEnum("priority", [
  "BAIXA",
  "NORMAL",
  "ALTA",
  "URGENTE",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "LIGACAO",
  "WHATSAPP",
  "EMAIL",
  "VISITA",
  "REUNIAO",
  "ENVIO_ORCAMENTO",
  "NEGOCIACAO",
  "RETORNO_CLIENTE",
  "OUTROS",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "EM_ELABORACAO",
  "ENVIADA",
  "VISUALIZADA",
  "EM_NEGOCIACAO",
  "REVISAO_SOLICITADA",
  "APROVADA",
  "RECUSADA",
  "EXPIRADA",
  "CANCELADA",
]);

export const orderCommercialStatusEnum = pgEnum("order_commercial_status", [
  "EM_ELABORACAO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "CANCELADO",
  "ENCERRADO",
]);

export const orderFinancialStatusEnum = pgEnum("order_financial_status", [
  "NAO_FATURADO",
  "AGUARDANDO_PAGAMENTO",
  "PARCIALMENTE_PAGO",
  "PAGO",
  "VENCIDO",
  "COM_SALDO_PENDENTE",
]);

export const orderOperationalStatusEnum = pgEnum("order_operational_status", [
  "AGUARDANDO_LIBERACAO",
  "AGUARDANDO_PROGRAMACAO",
  "AGUARDANDO_MATERIA_PRIMA",
  "AGUARDANDO_FORMAS",
  "NA_FILA_PRODUCAO",
  "EM_FABRICACAO",
  "EM_CURA",
  "EM_ACABAMENTO",
  "PRONTO_PARA_SEPARACAO",
  "EM_SEPARACAO",
  "PARCIALMENTE_ENTREGUE",
  "ENTREGUE_INTEGRALMENTE",
]);

export const deliveryModeEnum = pgEnum("delivery_mode", ["RETIRADA", "ENTREGA"]);

export const productionStageEnum = pgEnum("production_stage", [
  "AGUARDANDO_PRODUCAO",
  "EM_FABRICACAO",
  "FABRICACAO_CONCLUIDA",
  "EM_CURA",
  "EM_ACABAMENTO",
  "AGUARDANDO_INSPECAO",
  "APROVADO",
  "REPROVADO",
  "DISPONIVEL",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "ENTRADA_PRODUCAO",
  "SAIDA_ENTREGA",
  "RESERVA",
  "CANCELAMENTO_RESERVA",
  "AJUSTE",
  "PERDA",
  "DEVOLUCAO",
  "TRANSFERENCIA",
]);

export const migrationIssueStatusEnum = pgEnum("migration_issue_status", [
  "PENDENTE",
  "APROVADO",
  "IGNORADO",
  "REPROCESSAR",
]);

// ---------------------------------------------------------------------------
// USUÁRIOS / AUDITORIA / CONFIG
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
  mustResetPwd: boolean("must_reset_pwd").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  changes: jsonb("changes"),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
}));

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("notif_user_idx").on(t.userId, t.read),
}));

// ---------------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------------
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  document: text("document"),
  stateRegistration: text("state_registration"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  profile: customerProfileEnum("profile").notNull().default("OUTROS"),
  status: customerStatusEnum("status").notNull().default("ATIVO"),
  ownerId: text("owner_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("customers_code_idx").on(t.code),
  docIdx: index("customers_doc_idx").on(t.document),
  nameIdx: index("customers_name_idx").on(t.name),
}));

export const customerContacts = pgTable("customer_contacts", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// PRODUTOS
// ---------------------------------------------------------------------------
export const productCategories = pgTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
}, (t) => ({ nameIdx: uniqueIndex("prodcat_name_idx").on(t.name) }));

export const productUnits = pgTable("product_units", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: text("category_id").references(() => productCategories.id),
  unitCode: text("unit_code").notNull().references(() => productUnits.code),
  active: boolean("active").notNull().default(true),
  defaultPrice: numeric("default_price", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("products_code_idx").on(t.code),
  nameIdx: index("products_name_idx").on(t.name),
}));

// ---------------------------------------------------------------------------
// COMERCIAL / CRM
// ---------------------------------------------------------------------------
export const salesChannels = pgTable("sales_channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => ({ nameIdx: uniqueIndex("channel_name_idx").on(t.name) }));

export const lossReasons = pgTable("loss_reasons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => ({ nameIdx: uniqueIndex("loss_reason_name_idx").on(t.name) }));

export const opportunities = pgTable("opportunities", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  entryDate: timestamp("entry_date").notNull().defaultNow(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  contactName: text("contact_name"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  city: text("city"),
  channelId: text("channel_id").references(() => salesChannels.id),
  ownerId: text("owner_id").references(() => users.id),
  productId: text("product_id").references(() => products.id),
  productDescription: text("product_description"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }),
  unitCode: text("unit_code"),
  estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
  proposalValue: numeric("proposal_value", { precision: 14, scale: 2 }),
  desiredDeadline: text("desired_deadline"),
  expectedCloseDate: timestamp("expected_close_date"),
  probability: integer("probability").notNull().default(10),
  stage: opportunityStageEnum("stage").notNull().default("NOVO_CONTATO"),
  priority: priorityEnum("priority").notNull().default("NORMAL"),
  nextAction: text("next_action"),
  nextContactDate: timestamp("next_contact_date"),
  lossReasonId: text("loss_reason_id").references(() => lossReasons.id),
  lossJustification: text("loss_justification"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
}, (t) => ({
  codeIdx: uniqueIndex("opp_code_idx").on(t.code),
  stageIdx: index("opp_stage_idx").on(t.stage),
  customerIdx: index("opp_customer_idx").on(t.customerId),
  nextContactIdx: index("opp_next_contact_idx").on(t.nextContactDate),
}));

export const opportunityStageEvents = pgTable("opportunity_stage_events", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  fromStage: opportunityStageEnum("from_stage"),
  toStage: opportunityStageEnum("to_stage").notNull(),
  changedBy: text("changed_by"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commercialActivities = pgTable("commercial_activities", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  userId: text("user_id").references(() => users.id),
  type: activityTypeEnum("type").notNull(),
  channelUsed: text("channel_used"),
  description: text("description").notNull(),
  result: text("result"),
  nextAction: text("next_action"),
  nextContactAt: timestamp("next_contact_at"),
  attachmentPath: text("attachment_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  oppIdx: index("activity_opp_idx").on(t.opportunityId),
}));

// ---------------------------------------------------------------------------
// PROPOSTAS
// ---------------------------------------------------------------------------
export const proposals = pgTable("proposals", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  opportunityId: text("opportunity_id").notNull().references(() => opportunities.id),
  customerId: text("customer_id").notNull().references(() => customers.id),
  issueDate: timestamp("issue_date").notNull().defaultNow(),
  ownerId: text("owner_id").references(() => users.id),
  validUntil: timestamp("valid_until"),
  paymentTerms: text("payment_terms"),
  estimatedDays: integer("estimated_days"),
  freightValue: numeric("freight_value", { precision: 12, scale: 2 }).notNull().default("0"),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  status: proposalStatusEnum("status").notNull().default("EM_ELABORACAO"),
  currentVersion: integer("current_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ numberIdx: uniqueIndex("proposal_number_idx").on(t.number) }));

export const proposalVersions = pgTable("proposal_versions", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  versionIdx: uniqueIndex("proposal_version_idx").on(t.proposalId, t.version),
}));

export const proposalItems = pgTable("proposal_items", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id),
  description: text("description").notNull(),
  unitCode: text("unit_code").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }).notNull(),
});

// ---------------------------------------------------------------------------
// PEDIDOS
// ---------------------------------------------------------------------------
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  opportunityId: text("opportunity_id").references(() => opportunities.id),
  proposalId: text("proposal_id").references(() => proposals.id),
  closingDate: timestamp("closing_date").notNull().defaultNow(),
  authorizationDate: timestamp("authorization_date"),
  ownerId: text("owner_id").references(() => users.id),
  agreedDeadlineDays: integer("agreed_deadline_days"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  priority: priorityEnum("priority").notNull().default("NORMAL"),
  paymentTerms: text("payment_terms"),
  paymentMethod: text("payment_method"),
  deliveryMode: deliveryModeEnum("delivery_mode").notNull().default("RETIRADA"),
  freightValue: numeric("freight_value", { precision: 12, scale: 2 }).notNull().default("0"),
  deliveryAddress: text("delivery_address"),
  notes: text("notes"),
  commercialStatus: orderCommercialStatusEnum("commercial_status").notNull().default("EM_ELABORACAO"),
  financialStatus: orderFinancialStatusEnum("financial_status").notNull().default("NAO_FATURADO"),
  operationalStatus: orderOperationalStatusEnum("operational_status").notNull().default("AGUARDANDO_LIBERACAO"),
  grossValue: numeric("gross_value", { precision: 14, scale: 2 }).notNull().default("0"),
  discountValue: numeric("discount_value", { precision: 14, scale: 2 }).notNull().default("0"),
  netValue: numeric("net_value", { precision: 14, scale: 2 }).notNull().default("0"),
  receivedValue: numeric("received_value", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  numberIdx: uniqueIndex("order_number_idx").on(t.number),
  commStatusIdx: index("order_comm_status_idx").on(t.commercialStatus),
  opStatusIdx: index("order_op_status_idx").on(t.operationalStatus),
  customerIdx: index("order_customer_idx").on(t.customerId),
}));

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  description: text("description"),
  unitCode: text("unit_code").notNull(),
  quantityRequested: numeric("quantity_requested", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }).notNull(),

  quantityReserved: numeric("quantity_reserved", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityNeeded: numeric("quantity_needed", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityProduced: numeric("quantity_produced", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityApproved: numeric("quantity_approved", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityRejected: numeric("quantity_rejected", { precision: 14, scale: 3 }).notNull().default("0"),
  quantitySeparated: numeric("quantity_separated", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityDelivered: numeric("quantity_delivered", { precision: 14, scale: 3 }).notNull().default("0"),

  plannedDate: timestamp("planned_date"),
  estimatedDate: timestamp("estimated_date"),
  completedDate: timestamp("completed_date"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  orderIdx: index("orderitem_order_idx").on(t.orderId),
  productIdx: index("orderitem_product_idx").on(t.productId),
}));

export const orderStatusEvents = pgTable("order_status_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(), // COMERCIAL | FINANCEIRO | OPERACIONAL
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// PRODUÇÃO
// ---------------------------------------------------------------------------
export const productionCapacity = pgTable("production_capacity", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id),
  theoreticalDailyQty: numeric("theoretical_daily_qty", { precision: 14, scale: 3 }).notNull(),
  realDailyQty: numeric("real_daily_qty", { precision: 14, scale: 3 }),
  moldsAvailable: integer("molds_available"),
  moldCycleDays: numeric("mold_cycle_days", { precision: 6, scale: 2 }),
  manufactureTimeDays: numeric("manufacture_time_days", { precision: 6, scale: 2 }),
  curingTimeDays: numeric("curing_time_days", { precision: 6, scale: 2 }),
  finishingTimeDays: numeric("finishing_time_days", { precision: 6, scale: 2 }),
  effectiveDaysPerWeek: integer("effective_days_per_week").notNull().default(6),
  defaultLeadTimeDays: integer("default_lead_time_days"),
  restrictions: text("restrictions"),
  notes: text("notes"),
  validated: boolean("validated").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ productIdx: uniqueIndex("prodcap_product_idx").on(t.productId) }));

export const productionRecords = pgTable("production_records", {
  id: text("id").primaryKey(),
  date: timestamp("date").notNull(),
  orderId: text("order_id").references(() => orders.id),
  orderItemId: text("order_item_id").references(() => orderItems.id),
  productId: text("product_id").notNull().references(() => products.id),
  stage: productionStageEnum("stage").notNull().default("EM_FABRICACAO"),
  quantityProduced: numeric("quantity_produced", { precision: 14, scale: 3 }).notNull(),
  quantityApproved: numeric("quantity_approved", { precision: 14, scale: 3 }).notNull().default("0"),
  quantityRejected: numeric("quantity_rejected", { precision: 14, scale: 3 }).notNull().default("0"),
  lossReason: text("loss_reason"),
  userId: text("user_id").references(() => users.id),
  shift: text("shift"),
  occurrences: text("occurrences"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  dateIdx: index("prodrecord_date_idx").on(t.date),
  productIdx: index("prodrecord_product_idx").on(t.productId),
  orderIdx: index("prodrecord_order_idx").on(t.orderId),
}));

// ---------------------------------------------------------------------------
// ESTOQUE
// ---------------------------------------------------------------------------
export const inventoryItems = pgTable("inventory_items", {
  productId: text("product_id").primaryKey().references(() => products.id),
  physicalQty: numeric("physical_qty", { precision: 14, scale: 3 }).notNull().default("0"),
  reservedQty: numeric("reserved_qty", { precision: 14, scale: 3 }).notNull().default("0"),
  inspectionQty: numeric("inspection_qty", { precision: 14, scale: 3 }).notNull().default("0"),
  rejectedQty: numeric("rejected_qty", { precision: 14, scale: 3 }).notNull().default("0"),
  minimumQty: numeric("minimum_qty", { precision: 14, scale: 3 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => inventoryItems.productId),
  type: movementTypeEnum("type").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  reference: text("reference"),
  userId: text("user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ productIdx: index("invmov_product_idx").on(t.productId) }));

export const inventoryReservations = pgTable("inventory_reservations", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => inventoryItems.productId),
  orderId: text("order_id").notNull().references(() => orders.id),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
});

// ---------------------------------------------------------------------------
// VALIDAÇÃO DA MIGRAÇÃO
// ---------------------------------------------------------------------------
export const migrationIssues = pgTable("migration_issues", {
  id: text("id").primaryKey(),
  sourceFile: text("source_file").notNull(),
  sourceSheet: text("source_sheet").notNull(),
  sourceRow: integer("source_row").notNull(),
  entityType: text("entity_type").notNull(),
  rawData: jsonb("raw_data").notNull(),
  issueType: text("issue_type").notNull(),
  issueDescription: text("issue_description").notNull(),
  suggestion: text("suggestion"),
  status: migrationIssueStatusEnum("status").notNull().default("PENDENTE"),
  resolvedById: text("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),

  linkedOpportunityId: text("linked_opportunity_id").references(() => opportunities.id),
  linkedProposalId: text("linked_proposal_id").references(() => proposals.id),
  linkedOrderId: text("linked_order_id").references(() => orders.id),
  linkedProductionId: text("linked_production_id").references(() => productionRecords.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("migissue_status_idx").on(t.status),
  sourceIdx: index("migissue_source_idx").on(t.sourceFile, t.sourceSheet),
}));

// ---------------------------------------------------------------------------
// RELATIONS (para queries aninhadas via Drizzle)
// ---------------------------------------------------------------------------
export const customersRelations = relations(customers, ({ many }) => ({
  contacts: many(customerContacts),
  opportunities: many(opportunities),
  proposals: many(proposals),
  orders: many(orders),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  customer: one(customers, { fields: [opportunities.customerId], references: [customers.id] }),
  channel: one(salesChannels, { fields: [opportunities.channelId], references: [salesChannels.id] }),
  owner: one(users, { fields: [opportunities.ownerId], references: [users.id] }),
  product: one(products, { fields: [opportunities.productId], references: [products.id] }),
  lossReason: one(lossReasons, { fields: [opportunities.lossReasonId], references: [lossReasons.id] }),
  activities: many(commercialActivities),
  proposals: many(proposals),
  orders: many(orders),
  stageEvents: many(opportunityStageEvents),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  opportunity: one(opportunities, { fields: [proposals.opportunityId], references: [opportunities.id] }),
  customer: one(customers, { fields: [proposals.customerId], references: [customers.id] }),
  owner: one(users, { fields: [proposals.ownerId], references: [users.id] }),
  items: many(proposalItems),
  versions: many(proposalVersions),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  opportunity: one(opportunities, { fields: [orders.opportunityId], references: [opportunities.id] }),
  proposal: one(proposals, { fields: [orders.proposalId], references: [proposals.id] }),
  owner: one(users, { fields: [orders.ownerId], references: [users.id] }),
  items: many(orderItems),
  statusEvents: many(orderStatusEvents),
  productionRecords: many(productionRecords),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  productionRecords: many(productionRecords),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  unit: one(productUnits, { fields: [products.unitCode], references: [productUnits.code] }),
  capacity: one(productionCapacity, { fields: [products.id], references: [productionCapacity.productId] }),
  inventory: one(inventoryItems, { fields: [products.id], references: [inventoryItems.productId] }),
}));
