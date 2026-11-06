# Relatório de testes — LOGAN | Gestão Integrada (Fase 1)

## Metodologia

Dois níveis de teste, feitos sobre o sistema rodando de verdade (não simulado):

1. **Integração via API** (`curl`, direto contra o backend) — percorrendo o fluxo de ponta a ponta:
   criar oportunidade → gerar proposta → converter em pedido com múltiplos itens → aprovar
   comercialmente (reserva de estoque) → apontar produção (entrada em estoque, status em cascata)
   → registrar entrega (baixa de estoque, status operacional) → conferir que os números batem no
   dashboard. Cada etapa foi conferida olhando a resposta JSON da API, não só o código HTTP.
2. **Interface via navegador real** (Playwright + Chromium, headless), cobrindo login, navegação por
   todos os módulos da Fase 1, interações (abrir um registro, clicar em "Aprovar" numa pendência de
   migração, trocar período do dashboard) e captura de tela para conferência visual. Console e
   erros de página foram monitorados em cada rodada (`page.on('pageerror'/'console')`) — qualquer
   exceção do React ou do bundle teria aparecido aqui.
3. **Checagem estática**: `npx tsc --noEmit` no backend e no frontend a cada mudança relevante —
   nenhum erro de tipo pendente na entrega.

## Cenários cobertos (mapeados à seção 24 do briefing, itens da Fase 1)

| # | Cenário | Resultado |
|---|---|---|
| 1 | Criar oportunidade, avançar etapas do funil, registrar atividade | **OK** — testado via UI e API; evento de mudança de etapa gravado em `opportunity_stage_events` |
| 2 | Converter oportunidade em proposta e proposta em pedido | **OK** — testado via API (criação de proposta a partir da oportunidade, pedido a partir da proposta) e via UI (botão "+ Criar proposta") |
| 3 | Pedido com múltiplos produtos | **OK** — testado via API com 2+ itens no mesmo pedido; cada item calcula sua própria necessidade de produção independentemente; total do pedido soma corretamente os itens |
| 4 | Estoque (entrada por produção, baixa por entrega, disponível = físico − reservado − inspeção − rejeitado) | **OK** — testado via API (apontamento → entrada; entrega → saída) e confirmado na UI (tela Estoque antes/depois do backfill de dados migrados) |
| 5 | Apontamento de produção e cascata de status | **OK** — apontamento aprovado atualiza `order_items` e recalcula status do pedido automaticamente; testado via API e UI (Apontamento diário) |
| 6 | Registrar entrega (parcial e integral) | **OK** — testado via API; UI confirmada (botão "Registrar entrega" no detalhe do pedido, habilitado só quando há saldo aprovado e pendente) |
| 7 | Indicadores do dashboard refletem dados reais | **OK** — valores comparados com os totais calculados manualmente a partir do banco (ex.: "Qtde. produzida" bateu com a soma de `quantityApproved` em `order_items`) e com os totais que já apareciam na aba Dashboard da própria planilha original (ex.: "Qtde Total Pedida" = 2.859, idêntico nos dois) |
| 8 | Gráficos do dashboard | **OK** — 7 gráficos implementados (evolução de vendas, evolução de oportunidades, funil comercial, pedidos por situação, produção por produto, produção por mês, planejado × realizado, vendas por canal); testados com dados reais migrados; paleta validada por script de acessibilidade de cor (ver abaixo) |
| 9 | Permissões por perfil | **Parcial — limitação conhecida** (ver seção abaixo) |
| 10 | Migração validada, nada inventado, tela de pendências funcional | **OK** — 41 pendências corretamente classificadas e navegáveis; botões Aprovar/Ignorar/Reprocessar testados via UI (contagem de "pendentes de revisão" caiu de 41 para 40 após um "Aprovar" clicado, confirmando que o estado persiste) |
| 11 | Integridade referencial e de regras | **OK** — chaves estrangeiras reais no Postgres (não é possível, por ex., ter um item de pedido sem produto válido); reserva de estoque nunca excede o disponível (testado tentando reservar mais do que o físico); erros de violação de restrição única (ex. e-mail duplicado) retornam mensagem amigável em português, não um erro bruto do banco |
| 12 | Responsividade (celular) | **OK, com correção durante os testes** — ver seção abaixo |

## Problema encontrado e corrigido durante os testes

**Layout quebrava em tela de celular.** A primeira rodada de testes em viewport de celular (390×844)
mostrou a barra lateral fixa ocupando largura própria e empurrando o conteúdo para fora da tela
(overflow horizontal da página inteira), e tabelas longas (ex. lista de pedidos) vazando para fora
do cartão. Corrigido com: barra lateral deslizante por trás de um botão ☰ no topo (fechada por
padrão abaixo de 860px, com fundo escurecido ao abrir), e rolagem horizontal própria para qualquer
cartão que contenha uma tabela, em vez de a página inteira estourar a largura. Reconferido após a
correção: **nenhum overflow horizontal na página** (`document.documentElement.scrollWidth −
clientWidth = 0`) em `/`, `/pedidos` e no menu aberto.

**Estoque mostrava tudo zerado apesar de produção migrada.** A migração grava os registros de
produção e os itens de pedido diretamente no banco, sem passar pela mesma rotina que, no uso ao
vivo, soma a produção aprovada ao estoque físico. Resultado: a tela de Estoque mostrava físico = 0
para todos os 17 produtos, mesmo havendo 2.181 unidades de produção histórica aprovada. Corrigido
com um script de consolidação (`backfill-inventory.ts`) que aplica, uma única vez, a mesma regra do
fluxo ao vivo sobre os dados já migrados (não inventa nenhuma quantidade — soma o que já estava
gravado). Reconferido: estoque agora reflete a produção real (ex.: "Meio fio 80×30×10": 795 un.
disponíveis).

## Acessibilidade de cor dos gráficos

A paleta de marca (laranja/azul/verde/amarelo) foi validada com o verificador de daltonismo/
contraste do padrão de visualização de dados usado neste projeto: aprovada para uso categórico com
4 cores (sem o cinza de marca, que falha o piso mínimo de saturação para dado — usado só em texto/
bordas). O par amarelo/verde ficou no limite de separação para daltonismo protanope/tritanope, por
isso os gráficos que usam essas duas cores lado a lado (vendas por canal) sempre mostram o valor
numérico escrito sobre a barra, não dependendo só da cor para diferenciar.

## Limitações conhecidas (não são bugs — são escopo da Fase 2, combinado com o Rafael)

- **Permissões granulares por módulo** ainda não existem — hoje o perfil `ADMINISTRADOR` tem acesso
  total e os demais perfis do enum (`GERENTE`, `VENDEDOR`, `PRODUCAO`, etc., conforme cadastrados)
  ainda não têm restrição fina por tela/ação. O middleware `requireRole` já existe e está pronto
  para essa extensão.
- **Reserva de estoque para a carteira migrada** não foi retroativamente criada como reserva formal
  (ver `relatorio-migracao.md`) — os itens de pedido mostram corretamente o que foi produzido e
  aprovado, mas o campo "reservado" da tela de Estoque só passa a valer para pedidos confirmados a
  partir de agora.
- **Valores comerciais ausentes na planilha de origem** continuam ausentes no sistema (R$ 0,00 ou
  "—") até preenchimento manual — por design, não por falha (ver `relatorio-migracao.md`).

## Como repetir os testes

Os scripts de verificação usados nesta rodada (Playwright avulso) foram ferramentas de apoio ao
desenvolvimento, não fazem parte do produto entregue. Para reconferir qualquer cenário da tabela
acima, basta abrir o sistema no navegador com o backend e o frontend no ar (`npm run dev` em cada
pasta, conforme `README.md`) e seguir o roteiro descrito — todos os cenários usam apenas a
interface normal do sistema, sem necessidade de acesso direto ao banco.
