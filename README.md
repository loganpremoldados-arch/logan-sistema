# LOGAN | Gestão Integrada

Sistema de gestão integrada para a **Logan Pré-Moldados** (Milagres/CE) — CRM comercial, propostas,
pedidos, produção e indicadores, com banco de dados relacional real (PostgreSQL) e migração
validada das planilhas em uso hoje.

Este repositório entrega a **Fase 1** do sistema, definida junto com o Rafael: Clientes, Comercial/CRM
(funil + atividades), Propostas, Pedidos (com múltiplos produtos), Produção básica (capacidade +
apontamento + estoque de produto acabado), Dashboard executivo com gráficos, e a migração validada
das duas planilhas (`Controle_de_pedidos.xlsx` e `PLANILHA_DE_OPORTUNIDADES2026.xlsx`).

## Onde está cada coisa

```
logan-sistema/
├── backend/        API (Node.js + TypeScript + Express + Drizzle ORM + PostgreSQL)
├── frontend/       Aplicação web (React + TypeScript + Vite)
├── migracao/       Planilhas de origem usadas na migração (dados sensíveis — não versionar publicamente)
└── docs/           Documentação do projeto (este diretório)
```

Documentos em `docs/`:

| Arquivo | Conteúdo |
|---|---|
| `documentacao-tecnica.md` | Arquitetura, stack, modelo de dados, regras de negócio implementadas |
| `manual-usuario.md` | Como usar cada módulo do sistema, no dia a dia |
| `relatorio-migracao.md` | O que foi migrado, o que ficou pendente de revisão e por quê |
| `relatorio-testes.md` | O que foi testado, evidências e limitações conhecidas |
| `implantacao-backup.md` | Como colocar o sistema no ar (Supabase/Railway/VPS) e rotina de backup |

## Acesso inicial

Dois usuários administradores já estão cadastrados (senha provisória — o sistema força a troca no
primeiro acesso: `mustResetPwd`):

| E-mail | Senha provisória | Perfil |
|---|---|---|
| `rafaelmilito2.0@gmail.com` | `Logan@2026` | Administrador |
| `admin@loganpremoldados.com.br` | `Logan@2026` | Administrador |

**Troque essas senhas assim que o sistema estiver no ar.** Veja `docs/implantacao-backup.md` para
como gerar novos usuários e desativar os de teste, se desejar.

## Rodando localmente (desenvolvimento)

Pré-requisitos: Node.js 20+, PostgreSQL 16+.

```bash
# 1) Banco de dados
createdb logan_gestao
cd backend
cp .env.example .env     # edite DATABASE_URL e JWT_SECRET
npm install
npx drizzle-kit push     # cria as 26 tabelas a partir de src/db/schema.ts
npm run seed              # cria os 2 usuários admin + cadastros padrão
npm run migrar             # migra as planilhas em ../migracao (idempotente)
npm run backfill:estoque  # consolida o estoque a partir da produção/entregas migradas
npm run dev                # API em http://localhost:3334

# 2) Frontend (em outro terminal)
cd frontend
npm install
npm run dev                # app em http://localhost:5173 (proxy para a API em /api)
```

Para implantação (Supabase, Railway ou VPS próprio) e rotina de backup, veja
`docs/implantacao-backup.md`.

## Sobre dados "zerados" no dashboard

Vários valores comerciais (preço unitário, valor de proposta) não existiam nas planilhas de origem
para parte dos pedidos e oportunidades migrados. O sistema **não inventa esses valores** — eles
aparecem como R$ 0,00 ou "—" até serem preenchidos manualmente, e cada caso está listado e
rastreável na tela **Validação da Migração**. Isso é esperado e está detalhado em
`docs/relatorio-migracao.md`.

## Próximas fases (não incluídas nesta entrega, por decisão do Rafael)

Programação avançada de produção, módulo completo de Estoque (matéria-prima), Expedição/Entregas
como módulo próprio, Financeiro completo (parcelas e inadimplência), central de Relatórios com
exportação, permissões granulares por módulo, e tela de auditoria. O banco de dados já tem a
estrutura para a maior parte disso (auditoria é gravada desde já, só falta a tela); ver
`documentacao-tecnica.md` → "Fases futuras".
