# Manual de utilização — LOGAN | Gestão Integrada

## Acessando o sistema

Abra o endereço do sistema no navegador, informe e-mail e senha. No primeiro acesso com a senha
provisória, o sistema vai pedir a troca de senha (`mustResetPwd`). Em telas de celular, o menu fica
atrás do ícone ☰ no topo esquerdo.

A busca no topo (ícone de lupa) procura por cliente, pedido, oportunidade, proposta ou produto ao
mesmo tempo — digite e aperte Enter.

## Visão Geral (Dashboard)

Tela inicial. O seletor no topo direito troca o período dos cartões de indicadores (hoje, esta
semana, este mês, mês anterior, últimos 30/90 dias, este ano). Abaixo dos cartões ficam os
gráficos, e mais abaixo:

- **⚠ Atenção necessária** — lista do que precisa de ação agora (follow-up vencido, proposta sem
  retorno do cliente, pedido atrasado ou em risco, pedido pronto aguardando retirada, estoque
  abaixo do mínimo, pagamento vencido, cadastro incompleto). Clique em qualquer item para ir direto
  ao registro.
- **Visão operacional de hoje** — o que foi produzido hoje, quantos itens aguardam produção, e os
  follow-ups/atividades agendados para hoje.

## Comercial (CRM)

**Oportunidades** — lista de todos os contatos comerciais em andamento. Cada oportunidade tem um
código sequencial (ex.: `20260301-001`). Abrir uma oportunidade mostra os dados do contato, o
histórico de mudança de etapa, e as atividades comerciais registradas (ligação, WhatsApp, e-mail,
visita, etc. — botão "+ Registrar atividade"). O botão "+ Criar proposta" gera uma proposta a
partir dos dados da oportunidade.

**Funil de vendas** — visão em colunas (kanban) por etapa. Arraste ou abra o card para avançar a
oportunidade de etapa.

**Follow-ups** — lista de oportunidades com próximo contato agendado, para organizar a rotina do
time comercial.

**Propostas** — propostas geradas a partir de oportunidades, com itens, valores, condições de
pagamento e prazo. Cada edição de proposta aprovada mantém versão anterior salva
(`proposal_versions`) para rastreabilidade.

## Clientes

Lista e ficha de cliente com abas: **Dados cadastrais** (documento, telefone, WhatsApp, e-mail,
cidade, endereço), **Oportunidades**, **Propostas**, **Pedidos** e **Indicadores** (total vendido,
saldo a receber, pedidos, ticket médio, última compra, oportunidades abertas). Um traço (—) num
campo significa que a informação não veio da planilha de origem e ainda não foi preenchida — não é
erro do sistema, é um convite para completar o cadastro.

## Pedidos

**Todos os pedidos** / **Pedidos atrasados** / **Pedidos prontos** — mesma lista, com filtro
pré-aplicado conforme o item de menu clicado.

Abrir um pedido mostra:
- os três status (comercial, financeiro, operacional) com seletor para mudar o que for permitido
  no momento;
- o selo de **prazo** (No prazo / Atenção / Urgente / Em risco de atraso / Atrasado / Concluído),
  com o motivo explicado ao lado — esse selo é calculado a partir da capacidade de produção
  cadastrada e **não é uma promessa automática ao cliente**; valide antes de repassar;
- os valores (bruto, líquido, recebido);
- a **linha do tempo** com cada mudança de status registrada;
- a tabela de **itens do pedido**, cada um com solicitado / necessário produzir / produzido /
  aprovado / separado / entregue / pendente entregar / valor, e o botão **Registrar entrega** para
  dar baixa (parcial ou total) de um item;
- os **registros de produção** vinculados a este pedido.

Um pedido com múltiplos produtos tem uma linha por item — cada um com sua própria necessidade de
produção, calculada individualmente.

## Produção

**Fila de produção** — itens que ainda precisam ser produzidos (necessário produzir > aprovado),
ordenados por urgência.

**Apontamento diário** — tela onde o time de produção registra o que foi fabricado em cada turno:
produto, quantidade produzida, quantidade aprovada/rejeitada e motivo de perda, se houver. Ao
aprovar uma quantidade, o sistema automaticamente soma ao estoque físico do produto e atualiza o
pedido vinculado (se o apontamento estiver ligado a um pedido).

**Capacidade produtiva** — parâmetros por produto: capacidade teórica/dia, capacidade real/dia,
dias de cura, dias de acabamento. Os valores migrados da planilha aparecem com o selo **Pendente**
de validação (conforme pedido explicitamente no briefing — nenhuma capacidade é considerada
"oficial" até alguém da gestão revisar e validar). Use "Editar" para ajustar e validar.

**Planejado × Realizado** — comparação entre o que a carteira de pedidos precisa (necessário
produzir, somado) e o que já foi produzido e aprovado.

## Estoque

Mostra, por produto acabado: físico, reservado (para pedidos aprovados), em inspeção, rejeitado,
disponível (= físico − reservado − inspeção − rejeitado) e mínimo cadastrado. A situação fica
"Abaixo do mínimo" quando o disponível cai abaixo do mínimo — isso também aparece em "Atenção
necessária" no Dashboard.

## Gestão

**Cadastros** — categorias e unidades de produto, produtos, canais de venda, motivos de perda:
a base usada em todo o resto do sistema.

**Validação da Migração** — toda pendência encontrada ao migrar as duas planilhas originais, uma
por linha, com a descrição exata do problema e um link para a origem (arquivo/aba/linha). Para
cada pendência:
- **Aprovar** — marca como revisada e aceita como está;
- **Ignorar** — marca como revisada e descartada (não será corrigida);
- **Reprocessar** — sinaliza que o dado precisa ser corrigido e re-importado.

Nenhuma pendência é resolvida sozinha pelo sistema — a tela existe justamente para que uma pessoa
decida, caso a caso, o que fazer com cada dado ambíguo ou faltante da planilha original. Veja
`relatorio-migracao.md` para o detalhamento completo do que foi encontrado.

**Usuários** — gestão dos usuários do sistema e seus perfis de acesso.

## Dúvidas frequentes

**"Por que este pedido mostra R$ 0,00?"** — porque a planilha de origem não tinha preço unitário
nem valor total para esse pedido. O sistema não inventa valor comercial; preencha manualmente
quando tiver a informação correta.

**"O selo de prazo está errado."** — ele depende diretamente dos parâmetros em "Capacidade
produtiva", que vieram da planilha ainda não validados. Valide os parâmetros do produto em questão
e o selo será recalculado automaticamente na próxima vez que a tela for aberta.

**"Um cliente aparece duas vezes com nomes parecidos."** — provavelmente foi sinalizado em
"Validação da Migração" como possível duplicidade. O sistema não funde cadastros sozinho; decida e
use "Aprovar"/"Ignorar" conforme o caso.
