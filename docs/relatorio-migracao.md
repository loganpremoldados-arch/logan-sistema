# Relatório de migração — planilhas → LOGAN | Gestão Integrada

Script: `backend/src/scripts/migrar-planilhas.ts` (idempotente — pode ser executado de novo após
limpar as tabelas, sempre chegando ao mesmo resultado a partir das mesmas planilhas de origem).

## Origem

| Arquivo | Abas migradas |
|---|---|
| `Controle_de_pedidos.xlsx` | Pedidos, Produção, Configurações (capacidade produtiva) |
| `PLANILHA_DE_OPORTUNIDADES2026.xlsx` | Oportunidades 2026 |

## Princípio seguido em todo o script

**Nenhum valor comercial, data, quantidade ou motivo foi inventado.** Quando uma informação estava
ausente ou ambígua na planilha, uma das duas coisas acontece:

1. o dado é migrado **sem** aquele campo (deixado em branco/null no banco), e uma pendência é
   criada em `migration_issues` explicando o que falta e de onde veio (arquivo, aba, linha); ou
2. uma decisão conservadora e reversível é tomada (ex.: unificar dois cadastros de cliente que só
   diferem em maiúscula/minúscula) — e mesmo assim fica registrado como pendência, para revisão
   humana, não como correção silenciosa.

Todas as 41 pendências encontradas estão navegáveis na tela **Validação da Migração**, com link
para a origem exata (arquivo + aba + linha).

## Resultado da migração

| Entidade | Registros criados |
|---|---|
| Clientes | 45 |
| Produtos | 17 |
| Parâmetros de capacidade produtiva | 17 (todos migrados como **não validados** — seção 21.4 do briefing) |
| Oportunidades | 46 |
| Pedidos | 5 |
| Itens de pedido | 14 |
| Registros de produção (apontamentos históricos) | 25 |

## Pendências encontradas (41 no total)

| Tipo | Quantidade | O que significa |
|---|---|---|
| `PRODUTO_NAO_INFORMADO` | 13 | Oportunidade sem produto/item de interesse preenchido na planilha |
| `DATA_AUSENTE` | 8 | Apontamento de produção sem data informada — **não foi migrado automaticamente** |
| `VALOR_COMERCIAL_AUSENTE` | 5 | Pedido sem preço unitário nem valor total na planilha de origem — nenhum valor foi inventado |
| `MOTIVO_PERDA_AUSENTE` | 3 | Oportunidade marcada como perdida, mas sem motivo registrado |
| `POSSIVEL_CLIENTE_DUPLICADO` | 2 | Nomes de cliente parecidos o suficiente para serem a mesma pessoa/empresa digitada de formas diferentes — sinalizado, **não unificado automaticamente** |
| `NOME_CLIENTE_NAO_PADRONIZADO` | 2 | Nome de cliente que parece combinar mais de uma pessoa/localidade (ex.: "Genivaldo/Joelma-Jati") — migrado como está |
| `STATUS_AUSENTE` | 1 | "Status da demanda" não preenchido — migrado como "Novo contato" |
| `OPORTUNIDADE_SEM_CLIENTE` | 1 | Código de oportunidade sem cliente identificável na planilha |
| `TELEFONE_INCOMPLETO` | 1 | Telefone com menos de 8 dígitos |
| `DATA_OU_CODIGO_INVALIDO` | 1 | Data e código da oportunidade inconsistentes entre si (prováveis erros de digitação, ex. ano trocado) |
| `QUANTIDADE_AUSENTE` | 1 | Apontamento de produção sem quantidade produzida informada |
| `LINHA_SEM_PRODUTO` | 1 | Linha de configuração de capacidade sem produto associado (provável resíduo de formatação da planilha) |
| `OBSERVACAO_PENDENTE` | 1 | Observação da planilha original que precisa de atenção humana (ex.: "Falta acabamento em todos") |
| `VALIDACAO_PENDENTE` | 1 | Lembrete consolidado: todas as 17 capacidades produtivas migradas precisam de validação da gestão antes de embasar promessas de prazo |

Status atual: **1 aprovada**, **40 pendentes de revisão** (a aprovação foi feita durante o teste da
funcionalidade "Aprovar" da tela, para confirmar que o fluxo funciona ponta a ponta — ver
`relatorio-testes.md`).

## Decisões conservadoras tomadas (e por quê)

- **Clientes duplicados só por maiúscula/minúscula** (ex.: "joão silva" e "João Silva") foram
  unificados automaticamente no mesmo cadastro — é a mesma informação, só com capitalização
  diferente, não uma inferência nova. Nomes realmente diferentes (ex.: "Riverton"/"Everton") foram
  **apenas sinalizados**, nunca unificados sozinhos.
- **Telefone e e-mail do cliente**, quando ausentes no cadastro mas presentes na mesma linha de
  origem da oportunidade (mesma planilha, mesma linha), foram usados para completar o cadastro —
  é a mesma informação da mesma linha, não um dado novo. 27 dos 45 clientes tiveram telefone
  preenchido dessa forma.
- **Estoque físico de produto acabado** foi calculado a partir da soma da produção aprovada menos
  as entregas já registradas nos próprios pedidos migrados (script
  `backend/src/scripts/backfill-inventory.ts`, executado após a migração) — também não é um valor
  novo, é a aplicação da mesma regra de negócio usada no fluxo ao vivo (apontamento de produção →
  entrada em estoque) sobre os dados que a própria migração já havia gravado. Sem esse passo, a
  tela de Estoque mostraria tudo zerado mesmo com produção histórica registrada, o que seria
  enganoso.

## O que **não** foi migrado

- Movimentações financeiras detalhadas (parcelas, recebimentos individuais) — a planilha não tinha
  essa granularidade; os campos de valor recebido/pendente ficam em zero até o módulo financeiro
  completo (Fase 2) ou lançamento manual.
- Histórico de mudança de status anterior à migração — os pedidos e oportunidades migrados entram
  no sistema no status em que estavam na planilha; a "linha do tempo" de cada um começa vazia
  (eventos novos passam a ser registrados a partir de agora).
- Reservas formais de estoque por pedido (`inventory_reservations`) para a carteira migrada — a
  planilha não registrava reserva como conceito formal; os itens de pedido mostram corretamente
  quanto já foi aprovado/produzido, mas o campo "reservado" do módulo de Estoque só passa a
  refletir pedidos confirmados a partir de agora (fluxo ao vivo).

## Como reprocessar

```bash
cd backend
# dados: zera as tabelas afetadas e mantém usuários/cadastros base
psql "$DATABASE_URL" -c "TRUNCATE orders, order_items, production_records, opportunities, \
  opportunity_stage_events, migration_issues, production_capacity RESTART IDENTITY CASCADE;"
npm run migrar
npm run backfill:estoque
```
