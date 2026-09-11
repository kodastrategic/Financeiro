# FinanceApp — Documentação do Projeto

## 📋 Visão Geral

**FinanceApp** é um gerenciador financeiro pessoal com persistência em **Supabase (PostgreSQL)**, deploy automático via **Vercel**. Interface em HTML + CSS + JavaScript puro.

### Tecnologias
- HTML + CSS + JavaScript puro (sem frameworks)
- **Supabase JS v2** (CDN) — banco de dados PostgreSQL
- **Chart.js** 4.4.1 — gráficos no Dashboard
- **Vercel** — hospedagem e deploy automático via GitHub

---

## 🗄️ Banco de Dados (Supabase / PostgreSQL)

**12 tabelas** no schema `public`:

| Tabela | Chave Primária | Descrição |
|--------|---------------|-----------|
| `transactions` | `id SERIAL` | Transações financeiras (receitas/despesas) |
| `commands` | `keyword TEXT` | Comandos do chat (`mercado`, `salario`...) |
| `categories` | `name TEXT` | Categorias com cor e tipo (income/expense) |
| `cards` | `id SERIAL` | Cartões de crédito |
| `installments` | `id SERIAL` | Compras parceladas |
| `debts` | `id SERIAL` | Dívidas |
| `debtpayments` | `id SERIAL` | Histórico de pagamentos de dívidas |
| `invoicepayments` | `id SERIAL` | Pagamentos de faturas de cartão |
| `recurrings` | `id SERIAL` | Despesas recorrentes (assinaturas) |
| `fixedexpenses` | `id SERIAL` | Contas fixas (aluguel, internet) |
| `fixedpayments` | `id SERIAL` | Pagamento de contas fixas por mês |
| `budgets` | `category TEXT` | Orçamentos mensais por categoria |

Todas as colunas em **lowercase** no PostgreSQL. O wrapper `js/db.js` faz o mapeamento bidirecional: `createdat ↔ createdAt`, `txdate ↔ date`, `cardlimit ↔ limit`, etc.

---

## 🧱 Estrutura dos Arquivos

```
finance-app/
├── index.html            # Estrutura da interface
├── style.css             # Tema escuro completo
├── supabase-config.js    # Credenciais Supabase (URL + anonKey)
├── schema.sql            # Schema do banco PostgreSQL
├── js/
│   ├── db.js             # Wrapper Supabase com key mapping
│   ├── globals.js        # Constantes, helpers de data e funções compartilhadas
│   ├── utils.js          # Formatadores, cores, escapeHtml, notificações
│   ├── chat.js           # Chat de comandos, autocomplete, editor de transação
│   ├── dashboard.js      # Dashboard, 13 gráficos, extrato e modais de dashboard
│   ├── commands.js       # Comandos, categorias, orçamentos, modal de criação
│   ├── debts.js          # Dívidas
│   ├── bills.js          # Contas fixas com período (início/término) e lógica de atraso
│   ├── data.js           # Seed, backup, export/import, relatório
│   └── main.js           # Init (DOMContentLoaded) e navegação de abas
├── README.md             # Este arquivo
├── .gitignore
└── .git/
```

---

## 🎯 Funcionalidades

### 1️⃣ Chat de Comandos
- Digite `<comando> <valor>` para lançar transações (sem `/`)
- **Data opcional**: `mercado 350 15/03` ou `mercado 350 1503`
- **Fallback por categoria**: se não existe comando, busca uma categoria com o mesmo nome
- **Modal de criação**: se não existe nem comando nem categoria, abre modal para criar (tipo receita/despesa + categoria existente ou nova)
- Autocomplete combinado: comandos + categorias
- Campo vazio → mostra comandos mais usados por contagem de transações
- Histórico completo com saldo por data, botões editar/excluir

### 2️⃣ Dashboard Financeiro
- **Cards de resumo**: Saldo, Projetado, Dívidas, Receita/Despesa do Mês, Contas Fixas, Compromissos Futuros, Em Atraso
- **9 gráficos**: Evolução do Saldo, Gastos/Receitas por Categoria, Gastos/Receitas Mensais, Investimentos, Comparação Mensal, Top Despesas/Receitas, Fluxo de Caixa (projetado)
- **Orçamentos**: alerta visual quando categoria atinge 80%+ do limite

### 3️⃣ Aba Comandos
- Criar comando com categoria e tipo (receita/despesa)
- Gerenciar categorias (nome, cor, tipo)
- Orçamentos mensais por categoria
- Categorias com paleta de cores inteligente: receitas→tons frios, despesas→tons quentes

### 4️⃣ Contas e Dívidas (abas)
- **Contas Fixas**: despesas mensais com **Início/Término** — para compras parceladas cadastre uma conta fixa com período (ex.: Início 2026-09 e Término 2026-11 = 3 meses); pagamento individual ou em lote, competência mensal e seção de atrasados
- **Dívidas**: simplificadas, pagamento parcial cria transação automaticamente

### 5️⃣ Importação / Exportação
- Backup completo em JSON (todas as tabelas)
- Restauração com substituição total dos dados
- Relatório financeiro em Markdown

---

## 🔧 Alterações da Sessão (11/09/2026) — Dashboard V2

### Dashboard: apenas resumos (modal por tipo)
- A dashboard passou a mostrar **somente resumos**: cards de valor, alertas de orçamento e gráficos. As listas cheias (grids "Receitas/Despesas por Categoria" e "Extrato Detalhado") foram **removidas do corpo** e viraram modais acionados pelos cards
- **Redundância eliminada**: o card "Receita do Mês" (que repetia o total da seção "Receitas por Categoria") agora abre o modal de receitas — um só lugar, um só número
- Cards que **abrem detalhe**:
  - `💰 Receitas do Mês` → `openTypeModal('income')` — total por categoria (grid) + lista de lançamentos com filtros (período, categoria, busca)
  - `📉 Despesas do Mês` → `openTypeModal('expense')` — idem
  - `💳 Dívidas` → abre a aba Dívidas (`openTab('debts')`)
  - `📈 Saldo Projetado`, `📄 Contas Fixas`, `📅 Compromissos Futuros`, `⚠️ Em Atraso` já abriam modais
- Modal `#typeModal` (seção "DASHBOARD V2" em `js/dashboard.js`): cluster de categorias com % e mini-barra (clique aprofunda no modal da categoria) + tabela detalhada com editar/excluir
- Navegação por abas via `openTab()` em `js/main.js`; busca global `#dashSearch` movida para dentro do modal (cada tipo tem sua busca)
- Modal de categoria re-renderiza após refresh se estiver aberto (idem para `#typeModal`)

### Contas atrasadas — competência x vencimento efetivo
- O card `⚠️ Em Atraso` (era "Dívidas Atrasadas", que duplicava o card Dívidas) agora mostra o total de **contas fixas em atraso** por **consulta**, sem alterar/de-duplicar lançamentos
- Conceito: a conta pertence sempre ao mês de **competência** (não muda de mês). O mês atual lista as contas do mês + uma seção **"⚠️ Em atraso (competências anteriores)"** com as competências não pagas cujo vencimento (`dueDay`, com clamp ao último dia do mês) já passou — puxadas da consulta `fixedpayments`, não duplicadas como novos lançamentos
- **Sem cálculo automático de juros**: ao pagar uma competência em atraso o usuário informa o **valor real pago** (ex.: R$ 400 virou R$ 432) — o app entende o excedente como juros/multa e registra a transação pelo valor efetivo
- Helpers em `js/bills.js`: `monthKeyOf`, `addMonths`, `getFixDueDate`, `getUnpaidCompetencias`, `getOverdueFixedTotal`, `promptFixedAmount`, `payOverdueFixed`

### Estrutura
- HTML: `index.html` — modal `#typeModal`; removidas seções `.dash-section` de categorias e do extrato + `#dashSearch`
- CSS: `style.css` — bloco "DASHBOARD V2" (grid de categorias, extrato, filtros, responsivo mobile) + `.fixed-overdue-sec` + `.type-modal-grid`
- JS: `script.js` foi **dividido em módulos** em `js/` (globals, utils, chat, dashboard, commands, cards, debts, bills, data, main) — `setupTypeModal`, `openTypeModal`, `renderTypeModal`, `renderTypeModalGrid`, `openCategoryModal`, `renderCategoryModal`, `setupDashPeriodBadge` em `js/dashboard.js` (seção "DASHBOARD V2"); `openTab` em `js/main.js`

### Testes
- Validação com navegador headless + servidor local contra o banco real: 22 cards de categoria, 228 lançamentos no modal por tipo, 13 gráficos renderizados, sem erro fatal de JS (validação à época)

---

## 🔧 Redesign UI/UX — Design System v2 (Dark Refinado, 11/09/2026)

### Visão geral
- **`style.css` reescrito por completo** mantendo 100% do contrato de classes/ids consumidos pelos JS (nenhuma mudança de markup/JS necessária para o CSS)
- Tema **dark refinado**: fundo mais profundo (`#0a0d12`), superfícies em vidro (`backdrop-filter` + bordas translúcidas), gradientes de acento indigo→violeta, tipografia numérica tabular (`font-variant-numeric`) para valores monetários
- **Tokens centralizados** em `:root`: fundos, texto, acentos, semântico (income/expense/warn), bordas, raios (`--radius*`) e sombras

### Componentes
- **Nav**: barra fixa com blur (`rgba(10,13,18,.82)`), brand com tile em gradiente, abas em **pill** com gradiente ativo e sombra glow
- **Cards de resumo**: hover com lift + sombra; cada variante tem um glow radial próprio (`.card-saldo`/`.card-projetado`/`.card-dividas`/`.card-receita-mes`), valor principal em gradiente de texto
- **Gráficos**: containers vidro com hover glow; h3 com acento; legenda em chips pills
- **Botões**: `.btn-primary` gradiente + glow; `.btn-secondary` outline; `.btn-danger` soft; `.btn-sm` ghost com variantes `.primary`/`.danger`; `.filter-btn` pill
- **Forms**: inputs com focus ring (`box-shadow` 4px accent), `select` com chevron SVG customizado, `color` swatch arredondado
- **Modais**: overlay com blur, animação `modalIn` (escala + slide) e `.modal` em `--radius-lg:16px` com sombra profunda
- **Estruturas**: tabelas com hover suave, badges em pills, progress-bar com gradiente + glow, `.empty-state` com borda tracejada, notifications/toast com blur e bounce-in
- **Chat**: input pill glass, mensagens com gradientes, botões editar/excluir revelados no hover; loader 3D boxes com glow

### Charts (js/dashboard.js)
- **Defaults do Chart.js** no topo do módulo (com guardas para compatibilidade): fonte do body, cores de grid/ticks/tooltip (escuro + borda accent), animação `easeOutQuart` 600ms, legendas pontuais
- **Paleta refinada**: income → `#34d399`/gradientes esmeralda, expense → `#f87171`/gradientes coral, bordas dos donuts alinhadas ao novo fundo (`#0a0d12`), linha "Real" em indigo-400
- **Paletas de categorias** (`js/utils.js`) e **cores seed** (`js/globals.js`) harmonizadas ao novo tema

### Testes
- Validação via **Chrome DevTools Protocol** (Node + WebSocket): página carrega com loading oculto, **14 canvas**, cards do resumo populados (Saldo R$ 3.902,56 · Receitas R$ 12.675,00 · Despesas R$ 9.799,28 · Em Atraso R$ 2.187,77)
- Modal de Despesas: `#typeModal` com `show`, título "💸 Despesas", total **R$ 10.159,44 / 65 lançamentos / Set/2026**, 65 linhas, 19 cards de categoria, busca ativa — zero exceções
- Modal de Receitas: "💰 Receitas", **R$ 12.675,00 / 11 lançamentos**, 11 linhas, 4 cards
- Screenshots de referência: `shot_dash.png`, `shot_modal.png`, `shot_bills.png`, `shot_chat.png` (gerados em ambiente headless na validação)

---

## 🔧 Alterações da Sessão (11/09/2026) — Só Contas Fixas (fim de Cartões/Recorrentes)

### Removida a complexidade de cartão
- **Aba "Cartões" removida** do app (form, tabela, modal de fatura e `invoicepayments` saem da UI)
- **"Compras Recorrentes" removidas** do app
- **"Compras Parceladas" removidas** do app — compras em parcelas agora são cadastradas como **Conta Fixa com período**: campo **Início** (mês da 1ª cobrança) e **Término** (opcional) no formulário de Contas Fixas; ex.: Início 2026-09 → Término 2026-11 = 3 parcelas
- Dados antigos (cartões, parcelas, recorrentes, faturas) **continuam no banco/export/import**, apenas ficam fora da interface
- `js/cards.js` removido; `loadCardsTable`, `loadCardSelect`, `loadInstallmentsTable`, `loadRecurringsTable`, `setupCardForm/Installment/Recurring`, `markInstallmentPaid`, `openInvoiceModal` e helpers de parcela removidos dos demais módulos

### Contas Fixas mês-conscientes
- Cada conta fixa passa a valer de `startMonth` até `endMonth` (ou contínua se sem término) — `fixedAppliesMonth(exp, monthKey)` em `js/bills.js`
- `getUnpaidCompetencias` considera o início/término; tabela de contas ganhou coluna **Período** (`formatMonthRange`)
- Dois novos campos no banco: `fixedexpenses.startmonth` e `fixedexpenses.endmonth` (TEXT). **Aplicar no SQL editor do Supabase**:
  ```sql
  ALTER TABLE fixedexpenses ADD COLUMN IF NOT EXISTS startmonth TEXT;
  ALTER TABLE fixedexpenses ADD COLUMN IF NOT EXISTS endmonth TEXT;
  ```

### Dashboard
- Card **"Parcelas Futuras"** → **"📅 Compromissos Futuros"** (mesmo id `dFutureInstallments`) — soma dos próximos 12 meses de contas fixas (respeitando início/término)
- Removidos gráficos **Compromissos Futuros** (`chartFutureCommitments`) e **Endividamento** (`chartIndebtedness`) e o card **"Crédito Usado"** (`dCreditUsed`)
- Modais `#typeModal`, `#categoryModal`, `#projectedModal` e `#futureInstallmentsModal` agora usam **somente** transações e contas fixas (sem parcelas/recorrentes); modais de tipo/categoria sem coluna Cartão e sem ações de parcela

### Testes
- `node --check` em todos os `js/*.js`
- Validação headless via CDP: dashboard com **12 canvas** (11 no corpo + 1 do modal de categoria), abas sem "Cartões", zero exceções de JS

## 🔧 Alterações da Sessão (21/07/2026)

### Migração Dexie → Supabase (sessões anteriores)
- Dexie removido; Supabase JS v2 via CDN substitui
- `js/db.js`: wrapper com `lowerKeys()` (camelCase→lowercase) e `camelKeys()` (lowercase→camelCase)
- Deploy automático via Vercel em `https://financeiro-taupe-five.vercel.app`
- Loading screen, favicon, meta tags mobile

### Bugfix: INSERT não persistia (`.select()`)
- **Causa**: `supabase.insert().select()` retornava `{data: null, error: null}` sem persistir
- **Solução**: `add()` agora usa `fetch` direto com `Prefer: return=representation` — retorna o ID real do banco

### Bugfix: Categoria não funcionava no chat
- **Causa**: `executeCommand()` só buscava comandos, ignorava categorias existentes
- **Solução**: fallback para categoria com mesmo nome quando comando não encontrado

### Feature: Modal de criação de comando
- Quando o usuário digita algo que não existe (nem comando nem categoria), abre modal
- Usuário escolhe tipo (Receita/Despesa) e categoria (existente ou criar nova)
- Ao salvar: cria categoria (se nova), cria comando, executa transação
- Card gerado aparece com botões editar/excluir (usando ID real do banco)

### Melhorias de Layout
- `gap: 0.75rem` entre informações e botões nos cards do chat
- Removido `/comando` tag redundante dos cards no histórico

### Análise Técnica
- Confirmado via PowerShell: INSERT e SELECT funcionam diretamente na API REST do Supabase
- 13% de disco no plano free (~65MB de ~500MB) — normal para o volume de dados

---

## 📂 Funções Principais (js/)

| Função | Módulo | Descrição |
|--------|--------|-----------|
| `seedData()` | `data.js` | Popula categorias iniciais se vazio |
| `processCommand(text)` | `chat.js` | Processa comando do chat, exibe modal se não encontrado |
| `executeCommand(keyword, amount)` | `chat.js` | Executa comando, fallback para categoria, cria transação |
| `showCreateCommandModal(keyword, amount, date)` | `commands.js` | Modal de criação de comando não encontrado |
| `showAutocomplete(input, box)` | `chat.js` | Autocomplete combinado comandos + categorias |
| `refreshDashboard()` | `dashboard.js` | Atualiza cards, gráficos, alertas e modais abertos |
| `openTypeModal(type)` | `dashboard.js` | Modal por tipo (receitas/despesas): categorias + lançamentos + filtros |
| `getUnpaidCompetencias(exp, paysSet, curKey)` | `bills.js` | Competências não pagas e já vencidas (lógica de atraso) |
| `getOverdueFixedTotal()` | `bills.js` | Total de contas fixas em atraso (card `⚠️ Em Atraso`) |
| `renderChatHistory()` | `chat.js` | Renderiza histórico de transações no chat |
| `renderSummaryCards()` | `dashboard.js` | Cards de resumo do dashboard |
| `getAvgMonthly()` | `dashboard.js` | Média mensal (3 meses) |
| `getFutureMonthly()` | `dashboard.js` | Projeção de compromissos futuros (12 meses) |

---

## 🎨 Design

- **Design System v2 (dark refinado)** — reescrito em 11/09/2026: fundo `#0a0d12`, superfícies vidro com `backdrop-filter`, acento `#6366f1→#8b5cf6`, income `#34d399`, expense `#f87171`
- Tema escuro com tokens centralizados em `:root` (raios, sombras, cores, tipografia)
- Cards com gradientes e efeito glow nos gráficos (hover segue o mouse)
- Notificações animadas no canto inferior direito
- Responsivo (mobile-first com breakpoints 900/768/480)
- Scrollbar customizada
- Loading screen com animação 3D box + glow

---

## 💡 Melhorias Futuras

### 🏆 Prioritárias
1. ~~**Bug: INSERT não persiste**~~ (resolvido — fetch direto com `return=representation`)
2. **Responsivo** — ajustes finos de layout mobile (dashboard, tabelas)
3. **Cores dos gráficos** — harmonizar paleta com categorias
4. **Modal de confirmação** — substituir `confirm()` nativo

### 📊 Médio Impacto
5. **Metas de Economia** — savings goals com barra de progresso
6. **Calendário Financeiro** — visão mensal com contas a vencer
7. **Filtros na Lista de Transações** — busca por período/categoria
8. **Relatório em PDF** — substituir Markdown por PDF formatado

### 🔧 Qualidade de Código
9. ~~**Modularização do script.js**~~ (feito 11/09/2026 — separado em `js/globals|utils|chat|dashboard|commands|cards|debts|bills|data|main.js`)
10. **Migrar `onclick=` para `addEventListener`** — remover event handlers inline do HTML

---

Para retomar, basta ler este arquivo.
