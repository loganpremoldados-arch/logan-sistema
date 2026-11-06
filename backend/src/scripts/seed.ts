import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, pool } from "../db/client";
import {
  users, productUnits, productCategories, salesChannels, lossReasons, systemSettings,
} from "../db/schema";
import { newId } from "../lib/ids";
import { eq } from "drizzle-orm";

async function upsertUser(name: string, email: string, password: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    console.log(`Usuário já existe: ${email}`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ id: newId(), name, email, passwordHash, role: "ADMINISTRADOR", mustResetPwd: true });
  console.log(`Usuário administrador criado: ${email} / senha provisória: ${password}`);
}

async function seedUnits() {
  const defaults: [string, string][] = [
    ["UN", "Unidade"], ["M", "Metro linear"], ["M2", "Metro quadrado"], ["M3", "Metro cúbico"],
    ["KG", "Quilograma"], ["SC", "Saco"], ["TON", "Tonelada"],
  ];
  for (const [code, description] of defaults) {
    const [existing] = await db.select().from(productUnits).where(eq(productUnits.code, code));
    if (!existing) await db.insert(productUnits).values({ code, description });
  }
}

async function seedCategories() {
  const defaults = ["Blocos", "Pavimentação", "Meio-fio", "Postes e mourões", "Vigotas e lajes", "Tubos", "Cobogós", "Outros"];
  for (const name of defaults) {
    const [existing] = await db.select().from(productCategories).where(eq(productCategories.name, name));
    if (!existing) await db.insert(productCategories).values({ id: newId(), name });
  }
}

async function seedChannels() {
  const defaults = ["WhatsApp", "Instagram", "Facebook", "Telefone", "Indicação", "Visita à fábrica", "Visita em obra", "Site", "Prospecção ativa", "Outro"];
  for (const name of defaults) {
    const [existing] = await db.select().from(salesChannels).where(eq(salesChannels.name, name));
    if (!existing) await db.insert(salesChannels).values({ id: newId(), name });
  }
}

async function seedLossReasons() {
  const defaults = ["Preço", "Frete", "Prazo de entrega", "Concorrência", "Cliente desistiu", "Projeto cancelado", "Falta de disponibilidade", "Produto não atende à necessidade", "Sem retorno", "Outros"];
  for (const name of defaults) {
    const [existing] = await db.select().from(lossReasons).where(eq(lossReasons.name, name));
    if (!existing) await db.insert(lossReasons).values({ id: newId(), name });
  }
}

async function seedSettings() {
  const defaults: [string, string, string][] = [
    ["currency", "BRL", "Moeda padrão do sistema"],
    ["timezone", "America/Fortaleza", "Fuso horário padrão"],
    ["date_format", "DD/MM/AAAA", "Formato de data padrão"],
    ["deadline_urgent_margin_days", "1", "Margem (dias) para classificar um pedido como Urgente"],
    ["deadline_attention_margin_days", "3", "Margem (dias) para classificar um pedido como Atenção"],
  ];
  for (const [key, value, description] of defaults) {
    const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (!existing) await db.insert(systemSettings).values({ key, value, description });
  }
}

async function main() {
  console.log("Semeando dados iniciais do LOGAN | Gestão Integrada...");
  await upsertUser("Administrador", "admin@loganpremoldados.com.br", "Logan@2026");
  await upsertUser("Rafael", "rafaelmilito2.0@gmail.com", "Logan@2026");
  await seedUnits();
  await seedCategories();
  await seedChannels();
  await seedLossReasons();
  await seedSettings();
  console.log("Seed concluído.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
