DO $$ BEGIN
 CREATE TYPE "public"."activity_type" AS ENUM('LIGACAO', 'WHATSAPP', 'EMAIL', 'VISITA', 'REUNIAO', 'ENVIO_ORCAMENTO', 'NEGOCIACAO', 'RETORNO_CLIENTE', 'OUTROS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."customer_profile" AS ENUM('CONSUMIDOR_FINAL', 'CONSTRUTORA', 'REVENDEDOR', 'ENGENHEIRO', 'ARQUITETO', 'PROFISSIONAL_CONSTRUCAO', 'ORGAO_PUBLICO', 'OUTROS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."customer_status" AS ENUM('ATIVO', 'INATIVO', 'EM_ANALISE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."delivery_mode" AS ENUM('RETIRADA', 'ENTREGA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."migration_issue_status" AS ENUM('PENDENTE', 'APROVADO', 'IGNORADO', 'REPROCESSAR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."movement_type" AS ENUM('ENTRADA_PRODUCAO', 'SAIDA_ENTREGA', 'RESERVA', 'CANCELAMENTO_RESERVA', 'AJUSTE', 'PERDA', 'DEVOLUCAO', 'TRANSFERENCIA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."opportunity_stage" AS ENUM('NOVO_CONTATO', 'QUALIFICACAO', 'LEVANTAMENTO_NECESSIDADE', 'ELABORACAO_ORCAMENTO', 'PROPOSTA_ENVIADA', 'EM_NEGOCIACAO', 'AGUARDANDO_DECISAO', 'FECHADA', 'PERDIDA', 'SUSPENSA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."order_commercial_status" AS ENUM('EM_ELABORACAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'CANCELADO', 'ENCERRADO');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."order_financial_status" AS ENUM('NAO_FATURADO', 'AGUARDANDO_PAGAMENTO', 'PARCIALMENTE_PAGO', 'PAGO', 'VENCIDO', 'COM_SALDO_PENDENTE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."order_operational_status" AS ENUM('AGUARDANDO_LIBERACAO', 'AGUARDANDO_PROGRAMACAO', 'AGUARDANDO_MATERIA_PRIMA', 'AGUARDANDO_FORMAS', 'NA_FILA_PRODUCAO', 'EM_FABRICACAO', 'EM_CURA', 'EM_ACABAMENTO', 'PRONTO_PARA_SEPARACAO', 'EM_SEPARACAO', 'PARCIALMENTE_ENTREGUE', 'ENTREGUE_INTEGRALMENTE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."priority" AS ENUM('BAIXA', 'NORMAL', 'ALTA', 'URGENTE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."production_stage" AS ENUM('AGUARDANDO_PRODUCAO', 'EM_FABRICACAO', 'FABRICACAO_CONCLUIDA', 'EM_CURA', 'EM_ACABAMENTO', 'AGUARDANDO_INSPECAO', 'APROVADO', 'REPROVADO', 'DISPONIVEL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."proposal_status" AS ENUM('EM_ELABORACAO', 'ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO', 'REVISAO_SOLICITADA', 'APROVADA', 'RECUSADA', 'EXPIRADA', 'CANCELADA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('ADMINISTRADOR', 'GESTAO', 'COMERCIAL', 'PRODUCAO', 'EXPEDICAO', 'FINANCEIRO');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"changes" jsonb,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commercial_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text,
	"type" "activity_type" NOT NULL,
	"channel_used" text,
	"description" text NOT NULL,
	"result" text,
	"next_action" text,
	"next_contact_at" timestamp,
	"attachment_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"document" text,
	"state_registration" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"profile" "customer_profile" DEFAULT 'OUTROS' NOT NULL,
	"status" "customer_status" DEFAULT 'ATIVO' NOT NULL,
	"owner_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_items" (
	"product_id" text PRIMARY KEY NOT NULL,
	"physical_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reserved_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"inspection_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"rejected_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"minimum_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"reference" text,
	"user_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loss_reasons" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "migration_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"source_file" text NOT NULL,
	"source_sheet" text NOT NULL,
	"source_row" integer NOT NULL,
	"entity_type" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"issue_type" text NOT NULL,
	"issue_description" text NOT NULL,
	"suggestion" text,
	"status" "migration_issue_status" DEFAULT 'PENDENTE' NOT NULL,
	"resolved_by_id" text,
	"resolved_at" timestamp,
	"resolution_note" text,
	"linked_opportunity_id" text,
	"linked_proposal_id" text,
	"linked_order_id" text,
	"linked_production_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"entry_date" timestamp DEFAULT now() NOT NULL,
	"customer_id" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"city" text,
	"channel_id" text,
	"owner_id" text,
	"product_id" text,
	"product_description" text,
	"quantity" numeric(14, 3),
	"unit_code" text,
	"estimated_value" numeric(14, 2),
	"proposal_value" numeric(14, 2),
	"desired_deadline" text,
	"expected_close_date" timestamp,
	"probability" integer DEFAULT 10 NOT NULL,
	"stage" "opportunity_stage" DEFAULT 'NOVO_CONTATO' NOT NULL,
	"priority" "priority" DEFAULT 'NORMAL' NOT NULL,
	"next_action" text,
	"next_contact_date" timestamp,
	"loss_reason_id" text,
	"loss_justification" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunity_stage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"from_stage" "opportunity_stage",
	"to_stage" "opportunity_stage" NOT NULL,
	"changed_by" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"description" text,
	"unit_code" text NOT NULL,
	"quantity_requested" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_value" numeric(14, 2) NOT NULL,
	"quantity_reserved" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_needed" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_produced" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_approved" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_rejected" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_separated" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_delivered" numeric(14, 3) DEFAULT '0' NOT NULL,
	"planned_date" timestamp,
	"estimated_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"dimension" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"customer_id" text NOT NULL,
	"opportunity_id" text,
	"proposal_id" text,
	"closing_date" timestamp DEFAULT now() NOT NULL,
	"authorization_date" timestamp,
	"owner_id" text,
	"agreed_deadline_days" integer,
	"expected_delivery_date" timestamp,
	"priority" "priority" DEFAULT 'NORMAL' NOT NULL,
	"payment_terms" text,
	"payment_method" text,
	"delivery_mode" "delivery_mode" DEFAULT 'RETIRADA' NOT NULL,
	"freight_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_address" text,
	"notes" text,
	"commercial_status" "order_commercial_status" DEFAULT 'EM_ELABORACAO' NOT NULL,
	"financial_status" "order_financial_status" DEFAULT 'NAO_FATURADO' NOT NULL,
	"operational_status" "order_operational_status" DEFAULT 'AGUARDANDO_LIBERACAO' NOT NULL,
	"gross_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"received_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_units" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_capacity" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"theoretical_daily_qty" numeric(14, 3) NOT NULL,
	"real_daily_qty" numeric(14, 3),
	"molds_available" integer,
	"mold_cycle_days" numeric(6, 2),
	"manufacture_time_days" numeric(6, 2),
	"curing_time_days" numeric(6, 2),
	"finishing_time_days" numeric(6, 2),
	"effective_days_per_week" integer DEFAULT 6 NOT NULL,
	"default_lead_time_days" integer,
	"restrictions" text,
	"notes" text,
	"validated" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_records" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"order_id" text,
	"order_item_id" text,
	"product_id" text NOT NULL,
	"stage" "production_stage" DEFAULT 'EM_FABRICACAO' NOT NULL,
	"quantity_produced" numeric(14, 3) NOT NULL,
	"quantity_approved" numeric(14, 3) DEFAULT '0' NOT NULL,
	"quantity_rejected" numeric(14, 3) DEFAULT '0' NOT NULL,
	"loss_reason" text,
	"user_id" text,
	"shift" text,
	"occurrences" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" text,
	"unit_code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"default_price" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proposal_items" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"product_id" text,
	"description" text NOT NULL,
	"unit_code" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_value" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proposal_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"owner_id" text,
	"valid_until" timestamp,
	"payment_terms" text,
	"estimated_days" integer,
	"freight_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"status" "proposal_status" DEFAULT 'EM_ELABORACAO' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_reset_pwd" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commercial_activities" ADD CONSTRAINT "commercial_activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commercial_activities" ADD CONSTRAINT "commercial_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_inventory_items_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_items"("product_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_inventory_items_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_items"("product_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_linked_opportunity_id_opportunities_id_fk" FOREIGN KEY ("linked_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_linked_proposal_id_proposals_id_fk" FOREIGN KEY ("linked_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_linked_order_id_orders_id_fk" FOREIGN KEY ("linked_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "migration_issues" ADD CONSTRAINT "migration_issues_linked_production_id_production_records_id_fk" FOREIGN KEY ("linked_production_id") REFERENCES "public"."production_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_channel_id_sales_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."sales_channels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_loss_reason_id_loss_reasons_id_fk" FOREIGN KEY ("loss_reason_id") REFERENCES "public"."loss_reasons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_stage_events" ADD CONSTRAINT "opportunity_stage_events_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_capacity" ADD CONSTRAINT "production_capacity_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_records" ADD CONSTRAINT "production_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_records" ADD CONSTRAINT "production_records_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_records" ADD CONSTRAINT "production_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_records" ADD CONSTRAINT "production_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_unit_code_product_units_code_fk" FOREIGN KEY ("unit_code") REFERENCES "public"."product_units"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_opp_idx" ON "commercial_activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_code_idx" ON "customers" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_doc_idx" ON "customers" USING btree ("document");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invmov_product_idx" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loss_reason_name_idx" ON "loss_reasons" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "migissue_status_idx" ON "migration_issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "migissue_source_idx" ON "migration_issues" USING btree ("source_file","source_sheet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_user_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opp_code_idx" ON "opportunities" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_customer_idx" ON "opportunities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_next_contact_idx" ON "opportunities" USING btree ("next_contact_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orderitem_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orderitem_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_number_idx" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_comm_status_idx" ON "orders" USING btree ("commercial_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_op_status_idx" ON "orders" USING btree ("operational_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prodcat_name_idx" ON "product_categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prodcap_product_idx" ON "production_capacity" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prodrecord_date_idx" ON "production_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prodrecord_product_idx" ON "production_records" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prodrecord_order_idx" ON "production_records" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_code_idx" ON "products" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_version_idx" ON "proposal_versions" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_number_idx" ON "proposals" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_name_idx" ON "sales_channels" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");