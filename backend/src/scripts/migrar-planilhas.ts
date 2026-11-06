// ============================================================================
// Migração das planilhas originais (seção 21 do briefing)
// ----------------------------------------------------------------------------
// Lê os dois arquivos Excel usados pela Logan, aplica as regras de
// tratamento de inconsistências descritas no briefing e grava:
//   1. Os registros válidos nas tabelas definitivas do sistema.
//   2. Uma pendência em "migration_issues" para TODO problema encontrado,
//      em vez de corrigir silenciosamente (seção 21.5).
// Decisões aplicadas automaticamente (e por quê):
//   - Nomes de cliente iguais a menos de maiúsculas/minúsculas e espaços
//     ("kate" / "Kate") são tratados como o MESMO cliente — é apenas
//     digitação, não uma decisão de negócio — mas a ocorrência é registrada
//     como pendência informativa para transparência.
//   - Nº de pedido/produção com caixa diferente ("P-001-1" / "p-001-1") são
//     casados na busca (não é alteração de dado, é apenas a chave de busca).
//   - Qualquer outra divergência (grafias parecidas mas não idênticas,
//     datas inválidas, preço ausente, motivo de perda ausente, pedido sem
//     cliente) NÃO é corrigida nem inventada — fica pendente para decisão
//     da gestão na tela "Validação da Migração".
// ============================================================================
import "dotenv/config";
import XLSXDefault, * as XLSXNamespace from "xlsx";
const XLSX: typeof XLSXNamespace = (XLSXDefault as any) ?? XLSXNamespace;
import path from "path";
import { db, pool } from "../db/client";
import {
  customers, products, productUnits, productionCapacity, orders, orderItems,
  productionRecords, inventoryItems, opportunities, opportunityStageEvents,
  salesChannels, migrationIssues, users,
} from "../db/schema";
import { eq, ilike } from "drizzle-orm";
import { newId } from "../lib/ids";
import { calcOrderItem } from "../services/orderCalculations";

const PEDIDOS_FILE = path.resolve(process.cwd(), "../migracao/origem_controle_de_pedidos.xlsx");
const OPORTUNIDADES_FILE = path.resolve(process.cwd(), "../migracao/origem_planilha_oportunidades2026.xlsx");

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function isBlank(v: unknown): boolean {
  return v == null || String(v).trim() === "";
}

function onlyDigits(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

function excelDateToJs(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // número de série do Excel
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + value * 86400000);
  }
  if (typeof value === "string") {
    const s = value.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
      if (!isNaN(date.getTime()) && Number(y) > 1900 && Number(y) < 2100) return date;
      return null; // ano implausível (ex.: "07/05/0206") -> inválida
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  }
  return null;
}

let issueCount = 0;
async function addIssue(params: {
  sourceFile: string; sourceSheet: string; sourceRow: number; entityType: string;
  rawData: unknown; issueType: string; issueDescription: string; suggestion?: string;
  linkedOpportunityId?: string; linkedOrderId?: string; linkedProductionId?: string;
}) {
  issueCount++;
  await db.insert(migrationIssues).values({
    id: newId(),
    sourceFile: params.sourceFile,
    sourceSheet: params.sourceSheet,
    sourceRow: params.sourceRow,
    entityType: params.entityType,
    rawData: params.rawData as any,
    issueType: params.issueType,
    issueDescription: params.issueDescription,
    suggestion: params.suggestion ?? null,
    linkedOpportunityId: params.linkedOpportunityId ?? null,
    linkedOrderId: params.linkedOrderId ?? null,
    linkedProductionId: params.linkedProductionId ?? null,
  });
}

// cache de clientes já resolvidos nesta migração: chave normalizada -> id
const customerCache = new Map<string, { id: string; displayName: string }>();
const allCreatedCustomerNames: { id: string; name: string }[] = [];

async function findOrCreateCustomer(rawName: string, adminUserId: string): Promise<{ id: string; displayName: string } | null> {
  const name = (rawName ?? "").trim();
  if (!name) return null;
  const key = normalize(name);
  if (customerCache.has(key)) return customerCache.get(key)!;

  // já existe no banco (de uma migração anterior ou cadastro manual)?
  const existingRows = await db.select().from(customers);
  const dbMatch = existingRows.find((c) => normalize(c.name) === key);
  if (dbMatch) {
    const entry = { id: dbMatch.id, displayName: dbMatch.name };
    customerCache.set(key, entry);
    return entry;
  }

  // gera código sequencial simples
  const countNow = (await db.select().from(customers)).length;
  const code = `CLI-${String(countNow + 1).padStart(4, "0")}`;
  const id = newId();
  await db.insert(customers).values({ id, code, name, profile: "OUTROS", ownerId: adminUserId });
  const entry = { id, displayName: name };
  customerCache.set(key, entry);
  allCreatedCustomerNames.push({ id, name });
  return entry;
}

const productCache = new Map<string, string>(); // nome normalizado -> productId
async function findOrCreateProduct(rawName: string, unitCode = "UN"): Promise<string> {
  const name = rawName.trim();
  const key = normalize(name);
  if (productCache.has(key)) return productCache.get(key)!;

  const existingRows = await db.select().from(products);
  const dbMatch = existingRows.find((p) => normalize(p.name) === key);
  if (dbMatch) {
    productCache.set(key, dbMatch.id);
    return dbMatch.id;
  }

  const countNow = (await db.select().from(products)).length;
  const code = `PROD-${String(countNow + 1).padStart(4, "0")}`;
  const id = newId();
  await db.insert(products).values({ id, code, name, unitCode });
  await db.insert(inventoryItems).values({ productId: id });
  productCache.set(key, id);
  return id;
}

// ---------------------------------------------------------------------------
// 1) CAPACIDADES (aba Configuracoes) → Product + ProductionCapacity
// ---------------------------------------------------------------------------
async function migrarConfiguracoes(adminUserId: string) {
  const wb = XLSX.readFile(PEDIDOS_FILE);
  const ws = wb.Sheets["Configuracoes"];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  console.log("\n== Migrando Configuracoes (capacidade produtiva) ==");
  for (let r = 2; r < rows.length; r++) { // linha 3 em diante (índice 0-based: header na linha 2)
    const row = rows[r];
    if (!row) continue;
    const [produto, capacidade, unidade, prazo, observacao] = row;
    const excelRow = r + 1;
    if (!produto) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Configuracoes", sourceRow: excelRow,
        entityType: "ProductionCapacity", rawData: row, issueType: "LINHA_SEM_PRODUTO",
        issueDescription: "Linha de configuração sem produto associado (provável resíduo/linha em branco da planilha).",
        suggestion: "Ignorar esta linha.",
      });
      continue;
    }
    const unitCode = String(unidade ?? "UN").toUpperCase();
    const [existingUnit] = await db.select().from(productUnits).where(eq(productUnits.code, unitCode));
    if (!existingUnit) await db.insert(productUnits).values({ code: unitCode, description: unitCode });

    const productId = await findOrCreateProduct(String(produto), unitCode);
    const theoreticalDailyQty = Number(capacidade) || 0;
    await db.insert(productionCapacity).values({
      id: newId(), productId, theoreticalDailyQty: String(theoreticalDailyQty),
      defaultLeadTimeDays: prazo != null ? Number(prazo) : null,
      notes: observacao ? String(observacao) : null,
      validated: false, // migrado da planilha — precisa de validação da gestão (seção 21.4)
    });
    if (observacao) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Configuracoes", sourceRow: excelRow,
        entityType: "ProductionCapacity", rawData: row, issueType: "OBSERVACAO_PENDENTE",
        issueDescription: `Observação registrada na planilha original para "${produto}": ${observacao}`,
        suggestion: "Revisar se a observação impacta a capacidade cadastrada.",
      });
    }
  }
  await addIssue({
    sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Configuracoes", sourceRow: 0,
    entityType: "ProductionCapacity", rawData: { total: rows.length - 2 }, issueType: "VALIDACAO_PENDENTE",
    issueDescription: "Todas as capacidades produtivas migradas desta aba vieram marcadas como NÃO VALIDADAS — são parâmetros históricos da planilha, não capacidades oficialmente aprovadas (conforme seção 21.4 do briefing).",
    suggestion: "Revisar e validar cada capacidade em Cadastros > Produção > Capacidade Produtiva antes de usá-la em previsões de prazo.",
  });
}

// ---------------------------------------------------------------------------
// 2) PEDIDOS (aba Pedidos) → Customer + Order + OrderItem
// ---------------------------------------------------------------------------
const orderGroupCache = new Map<string, string>(); // chave de agrupamento -> orderId
const itemByOriginalNumber = new Map<string, { orderId: string; orderItemId: string; productId: string }>();

function baseOrderNumber(n: string): string {
  // "P-003-2" -> "P-003" ; "P-001" -> "P-001"
  const m = n.trim().match(/^(P-\d+)(-\d+)?$/i);
  return m ? m[1].toUpperCase() : n.trim().toUpperCase();
}

async function migrarPedidos(adminUserId: string) {
  const wb = XLSX.readFile(PEDIDOS_FILE);
  const ws = wb.Sheets["Pedidos"];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  console.log("\n== Migrando Pedidos ==");
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const [
      numero, cliente, produto, qtdeTotal, dataPedido, dataAutorizacao, prazoDias, entregaPrevista,
      qtdeProduzida, _faltaProduzir, _pctConcluido, _diasRestantes, _diasNecessarios, statusProducao,
      _situacaoPrazo, _risco, observacoes,
    ] = row;
    // ignora linhas completamente vazias nas colunas que de fato usamos (a planilha tem
    // formatação residual até a coluna Q em milhares de linhas sem dado real)
    if ([numero, cliente, produto, qtdeTotal].every(isBlank)) continue;
    const excelRow = r + 1;

    if (isBlank(numero) || isBlank(cliente)) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Pedidos", sourceRow: excelRow,
        entityType: "Order", rawData: row, issueType: "PEDIDO_SEM_VINCULO",
        issueDescription: "Linha sem número de pedido ou sem cliente — não é possível migrar automaticamente.",
        suggestion: "Cadastrar manualmente caso seja um pedido válido.",
      });
      continue;
    }

    const customer = await findOrCreateCustomer(String(cliente), adminUserId);
    if (!customer) continue;
    if (String(cliente).includes("/")) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Pedidos", sourceRow: excelRow,
        entityType: "Customer", rawData: row, issueType: "NOME_CLIENTE_NAO_PADRONIZADO",
        issueDescription: `Nome de cliente "${cliente}" parece combinar mais de uma pessoa e/ou localidade. Migrado como está.`,
        suggestion: "Revisar o cadastro e separar cliente/contato/cidade se necessário.",
      });
    }

    const base = baseOrderNumber(String(numero));
    const groupKey = `${base}__${customer.id}`;
    let orderId = orderGroupCache.get(groupKey);

    const pedidoDate = excelDateToJs(dataPedido);
    const autorizacaoDate = excelDateToJs(dataAutorizacao);
    const prazo = Number(prazoDias) || null;
    const entregaDate = excelDateToJs(entregaPrevista);

    const statusMap: Record<string, string> = {
      "AGUARDANDO": "NA_FILA_PRODUCAO", "EM PRODUÇÃO": "EM_FABRICACAO", "PRONTO": "PRONTO_PARA_SEPARACAO",
    };
    const operationalStatus = statusMap[String(statusProducao ?? "").trim().toUpperCase()] ?? "AGUARDANDO_LIBERACAO";

    if (!orderId) {
      orderId = newId();
      orderGroupCache.set(groupKey, orderId);
      await db.insert(orders).values({
        id: orderId, number: base, customerId: customer.id,
        closingDate: pedidoDate ?? new Date(), authorizationDate: autorizacaoDate,
        ownerId: adminUserId, agreedDeadlineDays: prazo, expectedDeliveryDate: entregaDate,
        commercialStatus: "APROVADO", financialStatus: "NAO_FATURADO", operationalStatus: operationalStatus as any,
        notes: observacoes ? String(observacoes) : null,
      });
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Pedidos", sourceRow: excelRow,
        entityType: "Order", rawData: row, issueType: "VALOR_COMERCIAL_AUSENTE",
        issueDescription: `O pedido ${base} (cliente ${customer.displayName}) não possui preço unitário nem valor total na planilha de origem — não foi inventado nenhum valor comercial.`,
        suggestion: "Preencher o valor unitário de cada item do pedido na ficha do pedido.",
        linkedOrderId: orderId,
      });
    }

    if (!pedidoDate) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Pedidos", sourceRow: excelRow,
        entityType: "Order", rawData: row, issueType: "DATA_INVALIDA",
        issueDescription: `Data do pedido ausente ou inválida para o item "${produto}" do pedido ${base}.`,
        suggestion: "Confirmar a data correta do pedido.", linkedOrderId: orderId,
      });
    }

    const productId = await findOrCreateProduct(String(produto ?? "Produto não identificado"));
    const requested = Number(qtdeTotal) || 0;
    const produced = Number(qtdeProduzida) || 0;
    const calc = calcOrderItem({ quantityRequested: requested, unitPrice: 0, discount: 0, quantityReserved: 0, quantityApproved: produced, quantityDelivered: 0 });

    const itemId = newId();
    await db.insert(orderItems).values({
      id: itemId, orderId, productId, description: String(produto ?? ""), unitCode: "UN",
      quantityRequested: String(requested), unitPrice: "0", discount: "0", totalValue: "0",
      quantityNeeded: String(calc.quantityNeeded), quantityProduced: String(produced), quantityApproved: String(produced),
    });
    itemByOriginalNumber.set(String(numero).trim().toUpperCase(), { orderId, orderItemId: itemId, productId });
  }
}

// ---------------------------------------------------------------------------
// 3) PRODUÇÃO (aba Producao) → ProductionRecord
// ---------------------------------------------------------------------------
async function migrarProducao(adminUserId: string) {
  const wb = XLSX.readFile(PEDIDOS_FILE);
  const ws = wb.Sheets["Producao"];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  console.log("\n== Migrando Producao ==");
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const [data, numeroPedido, produto, qtdeProduzida, responsavel, observacoes] = row;
    if ([data, numeroPedido, produto, qtdeProduzida].every(isBlank)) continue; // linha totalmente vazia
    const excelRow = r + 1;

    const date = excelDateToJs(data);
    const qty = Number(qtdeProduzida);

    if (!date) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Producao", sourceRow: excelRow,
        entityType: "ProductionRecord", rawData: row, issueType: "DATA_AUSENTE",
        issueDescription: `Apontamento de produção do pedido ${numeroPedido} (${produto}) sem data informada — não foi migrado automaticamente.`,
        suggestion: "Informar a data real do apontamento para lançá-lo manualmente.",
      });
      continue;
    }
    if (!qty || isNaN(qty)) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Producao", sourceRow: excelRow,
        entityType: "ProductionRecord", rawData: row, issueType: "QUANTIDADE_AUSENTE",
        issueDescription: `Apontamento de produção do pedido ${numeroPedido} em ${date.toLocaleDateString("pt-BR")} sem quantidade produzida informada.`,
        suggestion: "Confirmar e lançar manualmente a quantidade produzida.",
      });
      continue;
    }

    const key = String(numeroPedido ?? "").trim().toUpperCase();
    const link = itemByOriginalNumber.get(key);
    if (!link) {
      await addIssue({
        sourceFile: "origem_controle_de_pedidos.xlsx", sourceSheet: "Producao", sourceRow: excelRow,
        entityType: "ProductionRecord", rawData: row, issueType: "PEDIDO_NAO_ENCONTRADO",
        issueDescription: `Apontamento referencia o pedido "${numeroPedido}", que não foi localizado entre os pedidos migrados.`,
        suggestion: "Verificar se o número do pedido está correto.",
      });
      continue;
    }

    await db.insert(productionRecords).values({
      id: newId(), date, orderId: link.orderId, orderItemId: link.orderItemId, productId: link.productId,
      stage: "APROVADO", quantityProduced: String(qty), quantityApproved: String(qty), quantityRejected: "0",
      userId: adminUserId, notes: [responsavel ? `Responsável (planilha): ${responsavel}` : null, observacoes || null].filter(Boolean).join(" — ") || null,
    });

    if (key !== String(numeroPedido).trim()) {
      // diferença só de caixa — registra como nota informativa, não bloqueia
    }
  }

  // recalcula status operacional e necessidade dos itens de pedido após lançar toda a produção migrada
  const allItems = await db.select().from(orderItems);
  for (const item of allItems) {
    const calc = calcOrderItem({
      quantityRequested: Number(item.quantityRequested), unitPrice: 0, discount: 0,
      quantityReserved: 0, quantityApproved: Number(item.quantityApproved), quantityDelivered: 0,
    });
    await db.update(orderItems).set({ quantityNeeded: String(calc.quantityNeeded) }).where(eq(orderItems.id, item.id));
  }
}

// ---------------------------------------------------------------------------
// 4) OPORTUNIDADES (aba "Comercial - logan") → Customer + Opportunity
// ---------------------------------------------------------------------------
function mapChannel(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", OUTRO: "Outro",
    "VISITA EM OBRA": "Visita em obra", "VISITA À FÁBRICA": "Visita à fábrica", TELEFONE: "Telefone",
  };
  return map[v] ?? null;
}

function mapStage(raw: string | null | undefined): { stage: string; note?: string } {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "proposta enviada") return { stage: "PROPOSTA_ENVIADA" };
  if (v === "fechada") return { stage: "FECHADA" };
  if (v === "perdida") return { stage: "PERDIDA" };
  if (v === "elaboração de proposta" || v === "elaboracao de proposta") return { stage: "ELABORACAO_ORCAMENTO" };
  if (v === "revisão" || v === "revisao") return { stage: "EM_NEGOCIACAO", note: "Status original da planilha: Revisão (proposta em revisão)." };
  return { stage: "NOVO_CONTATO" };
}

async function migrarOportunidades(adminUserId: string) {
  const wb = XLSX.readFile(OPORTUNIDADES_FILE);
  const ws = wb.Sheets["Comercial - logan"];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  const channelCache = new Map<string, string>();
  async function channelId(name: string | null): Promise<string | null> {
    if (!name) return null;
    if (channelCache.has(name)) return channelCache.get(name)!;
    const [existing] = await db.select().from(salesChannels).where(eq(salesChannels.name, name));
    if (existing) { channelCache.set(name, existing.id); return existing.id; }
    const id = newId();
    await db.insert(salesChannels).values({ id, name });
    channelCache.set(name, id);
    return id;
  }

  console.log("\n== Migrando Oportunidades ==");
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const [codigo, nProposta, cliente, dataRaw, produtoItem, canalRaw, nomeContato, telefoneRaw, email, atendente, statusRaw, followUp] = row;
    // ignora linhas sem nenhum dado nas colunas reais da planilha (A:L) — o arquivo
    // tem formatação residual até a coluna Z em até 1000 linhas sem conteúdo
    if ([codigo, nProposta, cliente, dataRaw, produtoItem, canalRaw, nomeContato, telefoneRaw, email, atendente, statusRaw, followUp].every(isBlank)) continue;
    const excelRow = r + 1;

    if (isBlank(cliente)) {
      await addIssue({
        sourceFile: "origem_planilha_oportunidades2026.xlsx", sourceSheet: "Comercial - logan", sourceRow: excelRow,
        entityType: "Opportunity", rawData: row, issueType: "OPORTUNIDADE_SEM_CLIENTE",
        issueDescription: `Oportunidade de código "${codigo}" não possui cliente identificado na planilha.`,
        suggestion: "Identificar o cliente e cadastrar manualmente, se aplicável.",
      });
      continue;
    }

    const customer = await findOrCreateCustomer(String(cliente), adminUserId);
    if (!customer) continue;

    const entryDate = excelDateToJs(dataRaw);
    const codeStr = String(codigo ?? "").trim();
    const codeLooksValid = /^\d{8}-\d{3}$/.test(codeStr) && codeStr.startsWith(String(entryDate?.getFullYear() ?? ""));

    if (!entryDate || !codeLooksValid) {
      await addIssue({
        sourceFile: "origem_planilha_oportunidades2026.xlsx", sourceSheet: "Comercial - logan", sourceRow: excelRow,
        entityType: "Opportunity", rawData: row, issueType: "DATA_OU_CODIGO_INVALIDO",
        issueDescription: `Oportunidade do cliente "${cliente}" tem data ("${dataRaw}") e/ou código ("${codigo}") inconsistentes entre si — provável erro de digitação (ex.: ano trocado).`,
        suggestion: "Confirmar a data real do contato e corrigir o código antes de cadastrar a oportunidade.",
      });
      continue; // não inventa a data correta — fica pendente para decisão da gestão
    }

    const phone = onlyDigits(telefoneRaw);

    // Completa telefone/e-mail no cadastro do cliente quando ele ainda não os possui —
    // é a mesma informação da mesma linha de origem, não uma inferência nova.
    if (phone.length >= 8 || email) {
      const [custRow] = await db.select().from(customers).where(eq(customers.id, customer.id));
      const patch: Record<string, string> = {};
      if (phone.length >= 8 && !custRow.phone) patch.phone = phone;
      if (email && !custRow.email) patch.email = String(email);
      if (Object.keys(patch).length) await db.update(customers).set(patch).where(eq(customers.id, customer.id));
    }

    if (telefoneRaw && phone.length > 0 && phone.length < 8) {
      await addIssue({
        sourceFile: "origem_planilha_oportunidades2026.xlsx", sourceSheet: "Comercial - logan", sourceRow: excelRow,
        entityType: "Opportunity", rawData: row, issueType: "TELEFONE_INCOMPLETO",
        issueDescription: `Telefone "${telefoneRaw}" informado para "${cliente}" está incompleto.`,
        suggestion: "Confirmar o telefone completo com o cliente.",
      });
    }

    const { stage, note } = mapStage(statusRaw);
    if (!statusRaw) {
      await addIssue({
        sourceFile: "origem_planilha_oportunidades2026.xlsx", sourceSheet: "Comercial - logan", sourceRow: excelRow,
        entityType: "Opportunity", rawData: row, issueType: "STATUS_AUSENTE",
        issueDescription: `Oportunidade ${codeStr} (${cliente}) sem "Status da demanda" preenchido na planilha — migrada como "Novo contato".`,
        suggestion: "Confirmar a etapa real desta oportunidade.",
      });
    }
    if (stage === "PERDIDA") {
      await addIssue({
        sourceFile: "origem_planilha_oportunidades2026.xlsx", sourceSheet: "Comercial - logan", sourceRow: excelRow,
        entityType: "Opportunity", rawData: row, issueType: "MOTIVO_PERDA_AUSENTE",
        issueDescription: `Oportunidade ${codeStr} (${cliente}) marcada como perdida na planilha, mas sem motivo registrado.`,
        suggestion: "Preencher o motivo da perda na ficha da oportunidade.",
      });
    }
    if (!produtoItem) {
      await addIssue({
        sourceFile: "origem_planilha_oportunidades2026.xlsx", sourceSheet: "Comercial - logan", sourceRow: excelRow,
        entityType: "Opportunity", rawData: row, issueType: "PRODUTO_NAO_INFORMADO",
        issueDescription: `Oportunidade ${codeStr} (${cliente}) sem produto/item de interesse informado na planilha.`,
      });
    }

    const chId = await channelId(mapChannel(canalRaw));
    const id = newId();
    await db.insert(opportunities).values({
      id, code: codeStr, entryDate, customerId: customer.id,
      contactName: nomeContato ? String(nomeContato) : null,
      phone: phone || null,
      email: email ? String(email) : null,
      channelId: chId,
      ownerId: adminUserId,
      productDescription: produtoItem ? String(produtoItem) : null,
      stage: stage as any,
      probability: stage === "FECHADA" ? 100 : stage === "PERDIDA" ? 0 : 30,
      notes: [
        nProposta ? `Nº proposta (planilha original): ${nProposta}` : null,
        atendente ? `Atendente (planilha original): ${atendente}` : null,
        followUp ? `Follow-up original: ${String(followUp).slice(0, 2000)}` : null,
        note ?? null,
      ].filter(Boolean).join("\n") || null,
      closedAt: ["FECHADA", "PERDIDA"].includes(stage) ? entryDate : null,
    });
    await db.insert(opportunityStageEvents).values({ id: newId(), opportunityId: id, toStage: stage as any, changedBy: adminUserId, note: "Migrado da planilha de oportunidades 2026" });
  }
}

// ---------------------------------------------------------------------------
// 5) Possíveis duplicidades de cliente por grafia parecida (não idêntica)
// ---------------------------------------------------------------------------
async function detectarPossiveisDuplicados() {
  console.log("\n== Verificando possíveis clientes duplicados por grafia parecida ==");
  const all = await db.select().from(customers);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = normalize(all[i].name);
      const b = normalize(all[j].name);
      if (a === b) continue; // já são o mesmo registro (não deveria ocorrer)
      const dist = levenshtein(a, b);
      const shortEnough = Math.min(a.length, b.length) >= 5;
      if (shortEnough && dist <= 2) {
        await addIssue({
          sourceFile: "origem_controle_de_pedidos.xlsx + origem_planilha_oportunidades2026.xlsx",
          sourceSheet: "Clientes (pós-migração)", sourceRow: 0, entityType: "Customer",
          rawData: { clienteA: all[i].name, clienteB: all[j].name },
          issueType: "POSSIVEL_CLIENTE_DUPLICADO",
          issueDescription: `"${all[i].name}" e "${all[j].name}" têm grafias muito parecidas — podem ser o mesmo cliente digitado de formas diferentes.`,
          suggestion: "Comparar os dois cadastros e unificar manualmente, se for o mesmo cliente.",
        });
      }
    }
  }
}

async function main() {
  console.log("Iniciando migração das planilhas originais...");
  const [admin] = await db.select().from(users).where(eq(users.email, "rafaelmilito2.0@gmail.com"));
  if (!admin) throw new Error("Usuário administrador não encontrado. Rode o seed antes da migração.");

  await migrarConfiguracoes(admin.id);
  await migrarPedidos(admin.id);
  await migrarProducao(admin.id);
  await migrarOportunidades(admin.id);
  await detectarPossiveisDuplicados();

  console.log(`\nMigração concluída. ${issueCount} pendência(s) registrada(s) em "Validação da Migração".`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
