# Contexto: FinanceApp v2

## Stack e restrições
- HTML + CSS + JS puro, sem build. Scripts globais carregados em ordem.
- Supabase via CDN; `js/db.js` expõe `window.db.<tabela>`.
- Chart.js 4.4.1.
- Deploy estático na Vercel.

## Contratos que NÃO podem quebrar
- IDs/classes consumidos por `js/*.js` (ex.: `dBalance`, `dProjected`,
  `dMonthIncome`, `dMonthExpense`, `dFutureInstallments`, `dTotalDebt`,
  `dOverdueDebt`, `dFixedExpenses`, `budgetAlerts`, `chatInput`, `chatSend`,
  `chatMessages`, `autocompleteBox`, `fixedBody`, `debtsBody`, `commandsBody`,
  `categoriesBody`, `budgetsBody`, `typeModal*`, `categoryModal*`).
- Modais usam `.modal-overlay.show`; `closeModal(id)` remove a classe.
- Abas: `.tab-btn[data-tab]` + `.tab-content#<tab>.active`.
- `openTab(tab)` depende de `.tab-btn`.
- Gráficos: cada `<canvas id="chartX">` é usado por `makeChart`.
- Tabelas: `<tbody id="...">` preenchidos por JS.

## Estrutura de telas
- **Chat**: histórico + composer fixo + banner de saldo/comprometido.
- **Dashboard**: 8 cards (4 principais + 4 sutis), alertas de orçamento,
  11 gráficos.
- **Comandos**: 3 painéis (comandos, categorias, orçamentos).
- **Contas**: formulário + tabela de contas fixas; modal do mês.
- **Dívidas**: formulário + tabela + histórico de pagamentos.
- **Modais**: projeção, compromissos futuros, contas do mês, editar transação,
  novo comando, categoria, tipo.

## Direção visual atual
- Apple Dark: fundo `#0a0a0c`, superfícies vidro, azul sistema `#0a84ff`,
  verde `#30d158`, vermelho `#ff453a`, âmbar `#ff9f0a`.
- Tipografia SF/system, números tabulares.
- Estética contida: sem glow excessivo, sem gradientes chamativos.

## Oportunidades conhecidas
- Chat com coluna estreita e muito vazio à direita.
- Emojis estruturais com renderização inconsistente no Windows.
- Painéis de Comandos espremidos; coluna de orçamentos cortada.
- Contas/Dívidas em uma única coluna larga e vazia.
- Falta de foco visível, ESC/focus trap em modais, aria-labels.
- Tabelas sem indicação de scroll; ações minúsculas.
- Mobile: tabs e formulários precisam de ajuste.
