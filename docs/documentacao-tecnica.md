# Documentação técnica — LOGAN | Gestão Integrada

## 1. Visão geral da arquitetura

```
┌─────────────────┐        HTTPS/JSON         ┌──────────────────┐        SQL        ┌────────────┐
│  Frontend (SPA)  │ ───────────────────────▶ │   Backend (API)   │ ────────────────▶ │ PostgreSQL │
│ React + Vite     │ ◀─────────────────────── │ Express + Drizzle │ ◀──────────────── │  (16 tabelas │
│                  │        JWT no header       │        ORM         │                   │ de negócio +│
└─────────────────┘                            └──────────────────┘                   │ auditoria/  │
                                                                                          │ config)     │
                                                                                          └────────────┘
```

- **Não há regra de negócio no frontend.** Cálculos de totais, status, reservas de estoque,
  necessidade de produção e classificação de prazo são todos calculados e persistidos pelo backend.
  O frontend só exibe o que a API retorna — garante que o mesmo resultado apareça para qualquer
  cliente (web hoje, outro app amanhã) e que o histórico fique consistente.
- **Sem armazenamento local como fonte de verdade.** `localStorage`/`sessionStorage` não são usados
  para dados de negócio — apenas o token de sessão fica no browser; todo o resto vem do banco a
  cada carregamento.
- **Autenticação:** JWT assinado pelo backend, com bcrypt para hash de senha. O middleware
  `requireAuth` protege todas as rotas de negócio; `requireRole` permite restringir por perfil
  (hoje usado para ações administrativas).

## 2. Stack e por que cada peça foi escolhida

| Camada | Tecnologia | Observação |
|---|---|---|
| Linguagem | TypeScript (back e front) | Tipagem ponta a ponta, menos erro de "campo que não existe" |
| Backend | Node.js + Express | Simples, maduro, fácil de hospedar em qualquer provedor |
| ORM | **Drizzle ORM** + `pg` | Projetado originalmente com Prisma; trocado por Drizzle porque o ambiente de build bloqueava o download dos binários nativos do Prisma. Drizzle não precisa de binário nativo, gera SQL tipado e migrações legíveis (`backend/drizzle/*.sql`) |
| Banco | PostgreSQL 16 | Relacional real, com chaves estrangeiras, únicos e índices — exigência do briefing |
| Validação de entrada | Zod | Toda rota valida o corpo da requisição antes de tocar no banco |
| Frontend | React 18 + TypeScript + Vite | Build rápido, sem dependência de ferramentas pesadas |
| Estilo | CSS próprio (variáveis de marca) | Sem framework de UI de terceiros — identidade visual aplicada à risca (laranja #E85A2A, cinza-escuro #1A1A1A, cinza-médio #808285, fundo #F4F1EC) |
| Gráficos | Recharts | Dashboard executivo (seção 4) |
| Planilhas | `xlsx` (SheetJS) | Leitura das duas planilhas de origem no script de migração |

## 3. Modelo de dados (26 tabelas)

Arquivo-fonte: `backend/src/db/schema.ts`. Agrupamento lógico:

**Usuários / sistema** — `users`, `audit_logs`, `system_settings`, `notifications`
**Cadastros** — `customers`, `customer_contacts`, `product_categories`, `product_units`, `products`,
`sales_channels`, `loss_reasons`
**Comercial/CRM** — `opportunities`, `opportunity_stage_events`, `commercial_activities`
**Propostas** — `proposals`, `proposal_versions`, `proposal_items`
**Pedidos** — `orders`, `order_items`, `order_status_events`
**Produção** — `production_capacity`, `production_records`
**Estoque** — `inventory_items`, `inventory_movements`, `inventory_reservations`
**Migração** — `migration_issues`

Toda tabela de evento (`*_status_events`, `*_stage_events`, `inventory_movements`,
`commercial_activities`) é **append-only**: nada é sobrescrito, o histórico fica completo e
consultável — é a base do módulo de Histórico/Auditoria (hoje gravado; tela de consulta fica para
fase 2).

## 4. Regras de negócio implementadas (não são só CRUD)

### 4.1 Três dimensões de status do pedido
Cada pedido (`orders`) tem três status independentes, exatamente como pedido no briefing:
- **Comercial** (`commercialStatus`): elaboração → aguardando aprovação → aprovado / cancelado / encerrado
- **Financeiro** (`financialStatus`): não faturado → aguardando pagamento → pago / vencido / parcial
- **Operacional** (`operationalStatus`): aguardando liberação → ... → em fabricação → em cura →
  em acabamento → pronto para separação → parcialmente entregue → entregue integralmente

Mudar um não muda os outros automaticamente, exceto quando a regra de negócio exige (ex.: entregar
o último item pendente muda o operacional para "Entregue integralmente" sozinho — `orders.ts`,
rota `deliver-item`).

### 4.2 Cálculo de item de pedido (`services/orderCalculations.ts`)
```
necessário produzir = max(solicitado − reservado, 0)
pendente produzir    = max(necessário produzir − aprovado, 0)
pendente entregar     = max(solicitado − entregue, 0)
% produzido            = aprovado / necessário produzir × 100  (100% se nada precisa ser produzido)
% entregue              = entregue / solicitado × 100
```
Reserva de estoque (`reserveAvailableStock`) nunca reserva além do fisicamente disponível
(`físico − reservado − em inspeção − rejeitado`) e nunca reserva a mesma unidade física para dois
pedidos — a atualização é feita no mesmo registro de `inventory_items`, sem condição de corrida
entre duas reservas simultâneas na mesma requisição.

### 4.3 Apontamento de produção → estoque (`routes/production.ts`)
Ao aprovar uma quantidade produzida, o sistema, na mesma operação:
1. grava o registro de produção (`production_records`);
2. soma a quantidade aprovada ao físico do produto em `inventory_items`;
3. registra o movimento `ENTRADA_PRODUCAO` em `inventory_movements` (rastreável);
4. atualiza `quantityProduced`/`quantityApproved` do item de pedido vinculado (se houver) e
   recalcula o status do pedido.

Entregar um item (`deliver-item`) faz o caminho inverso: baixa o físico e a reserva, grava
`SAIDA_ENTREGA`, e recalcula o status operacional do pedido (parcial/integral).

### 4.4 Classificação de prazo (`services/deadline.ts`)
Seis situações — `NO_PRAZO`, `ATENCAO`, `URGENTE`, `EM_RISCO_DE_ATRASO`, `ATRASADO`, `CONCLUIDO` —
calculadas a partir da data prevista de entrega, da capacidade de produção cadastrada
(capacidade teórica/dia, tempo de cura, tempo de acabamento) e do que falta produzir. **O código
documenta explicitamente que esta é uma heurística de primeira versão**: ela assume capacidade
dedicada ao pedido e não concorre com outros pedidos na fila — a gestão deve validar os parâmetros
de capacidade (tela "Capacidade produtiva", hoje todos marcados como "Pendente" de validação,
exatamente como os dados vieram da planilha) antes de tratar esse indicador como promessa de prazo
ao cliente.

### 4.5 Funil comercial e conversão
Oportunidade (`opportunities.stage`) percorre 10 etapas (novo contato → ... → fechada/perdida/
suspensa), cada mudança grava um evento em `opportunity_stage_events`. Taxa de conversão no
dashboard = fechadas ÷ (fechadas + perdidas) no período — oportunidades ainda abertas não entram
no denominador (não é correto contar como "não convertido" algo que ainda está em andamento).

## 5. Dashboard executivo — indicadores e gráficos

`routes/dashboard.ts` expõe três agregados: `/summary` (cartões por período selecionável),
`/attention` (lista priorizada do que precisa de ação: follow-up vencido, proposta sem retorno,
pedido atrasado/em risco, pedido pronto aguardando retirada, estoque abaixo do mínimo, financeiro
vencido, cadastro incompleto) e `/charts` (séries para os gráficos). Nenhum desses números é
hard-coded ou simulado — todos vêm de `SELECT`/agregação real sobre as tabelas de negócio no
momento da requisição.

Gráficos implementados na Fase 1 (seção 6.3 do briefing): evolução de vendas, evolução de
oportunidades recebidas, funil comercial, pedidos por situação operacional, planejado × realizado,
produção por produto, vendas por canal. (Vendas por categoria, desempenho por responsável e
valores recebidos/pendentes por extenso ficam para quando houver mais histórico de valores
comerciais migrados — hoje os cartões "Valor recebido"/"Valor a receber" já cobrem esse último.)

## 6. Estrutura de pastas

```
backend/src/
├── db/            schema.ts (fonte única do modelo de dados), client.ts
├── lib/           ids.ts, codes.ts (geração de códigos sequenciais), audit.ts
├── middleware/     auth.ts, errorHandler.ts
├── services/       orderCalculations.ts, deadline.ts
├── routes/         um arquivo por módulo (auth, customers, catalog, opportunities, proposals,
                    orders, production, dashboard, users, migration)
└── scripts/         seed.ts, migrar-planilhas.ts, backfill-inventory.ts

frontend/src/
├── components/     Layout, Modal, Badge, StatCard, Charts
├── lib/            api.ts (cliente HTTP + tratamento de erro), auth.tsx, format.ts, labels.ts
└── pages/          uma pasta por módulo, espelhando o menu lateral
```

## 7. Fases futuras (fora do escopo desta entrega)

Definidas junto com o Rafael como Fase 2+, para não atrasar a entrega do essencial:

- Programação de produção avançada (calendário diário, sequenciamento por forma/molde)
- Estoque de matéria-prima e movimentações mais granulares
- Expedição/Entregas como módulo próprio (romaneio, roteirização)
- Financeiro completo: parcelas, múltiplos recebimentos, relatório de inadimplência
- Central de Relatórios com exportação para Excel/PDF e impressão
- Permissões granulares por módulo/ação (hoje: `ADMINISTRADOR` tem acesso total; outros perfis
  existem no enum `roleEnum` mas ainda sem restrição fina por tela)
- Tela de Auditoria (o banco já grava tudo em `audit_logs`; falta a interface de consulta)

O schema já tem campos e tabelas pensados para a maior parte disso (ex.: `roleEnum` já lista todos
os perfis do briefing, `inventory_reservations` já existe para o controle fino de reserva por
pedido), para que a Fase 2 seja extensão, não retrabalho.
