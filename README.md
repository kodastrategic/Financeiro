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
│   ├── cards.js          # Cartões e modal de fatura
│   ├── debts.js          # Parcelas (installments) e dívidas
│   ├── bills.js          # Contas fixas, recorrentes e lógica de atraso
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
- **Cards de resumo**: Saldo, Projetado, Dívidas, Receita/Despesa do Mês, Contas Fixas, Parcelas Futuras, Crédito Usado
- **11 gráficos**: Evolução do Saldo, Gastos/Receitas por Categoria, Gastos/Receitas Mensais, Compromissos Futuros, Investimentos, Comparação Mensal, Top Despesas/Receitas, Endividamento, Fluxo de Caixa
- **Orçamentos**: alerta visual quando categoria atinge 80%+ do limite

### 3️⃣ Aba Comandos
- Criar comando com categoria e tipo (receita/despesa)
- Gerenciar categorias (nome, cor, tipo)
- Orçamentos mensais por categoria
- Categorias com paleta de cores inteligente: receitas→tons frios, despesas→tons quentes

### 4️⃣ Cartões, Contas e Dívidas (abas)
- **Cartões**: gestão com limite, fechamento/vencimento, modal de fatura mensal
- **Contas Fixas**: despesas mensais recorrentes sem cartão, pagamento individual ou em lote
- **Compras Recorrentes**: assinaturas vinculadas a cartão
- **Compras Parceladas**: cadastro com cálculo automático de parcela, vínculo com cartão
- **Dívidas**: simplificadas, pagamento parcial cria transação automaticamente

### 5️⃣ Importação / Exportação
- Backup completo em JSON (todas as tabelas)
- Restauração com substituição total dos dados
- Relatório financeiro em Markdown

---

## 🔧 Alterações da Sessão (11/09/2026) — Dashboard V2

### Dashboard explorável
- Novo header com busca global, filtro de mês e ações compactas (ícones com tooltip)
- **Receitas/Despesas por Categoria**: grid de cards por categoria (cor, total do período, % , nº de lançamentos, mini-barra proporcional)
  - Clique no card abre **modal de detalhes**: seleção de período, subtotal, progresso do orçamento (despesas), mini-gráfico mensal e lista completa de lançamentos (parcelas identificadas, editar/excluir/pagar)
- **Extrato Detalhado**: tabela com todas as transações e filtros combináveis — período, tipo, categoria e busca por texto; total calculado por filtro; ações de editar/excluir por linha
- "Ver todas →" em cada seção foca o extrato já filtrado (receitas/despesas)
- Modal de categoria re-renderiza após refresh se estiver aberto

### Contas atrasadas — competência x vencimento efetivo
- O card `⚠️ Em Atraso` (era "Dívidas Atrasadas", que duplicava o card Dívidas) agora mostra o total de **contas fixas em atraso** por **consulta**, sem alterar/de-duplicar lançamentos
- Conceito: a conta pertence sempre ao mês de **competência** (não muda de mês). O mês atual lista as contas do mês + uma seção **"⚠️ Em atraso (competências anteriores)"** com as competências não pagas cujo vencimento (`dueDay`, com clamp ao último dia do mês) já passou — puxadas da consulta `fixedpayments`, não duplicadas como novos lançamentos
- **Sem cálculo automático de juros**: ao pagar uma competência em atraso o usuário informa o **valor real pago** (ex.: R$ 400 virou R$ 432) — o app entende o excedente como juros/multa e registra a transação pelo valor efetivo
- Helpers em `js/bills.js`: `monthKeyOf`, `addMonths`, `getFixDueDate`, `getUnpaidCompetencias`, `getOverdueFixedTotal`, `promptFixedAmount`, `payOverdueFixed`

### Estrutura
- HTML: `index.html` — novas seções `.dash-section` + modal `#categoryModal`
- CSS: `style.css` — bloco "DASHBOARD V2" (grid de categorias, extrato, filtros, responsivo mobile) + `.fixed-overdue-sec`
- JS: `script.js` foi **dividido em módulos** em `js/` (globals, utils, chat, dashboard, commands, cards, debts, bills, data, main) — funções `setupExtract`, `renderCategorySections`, `renderCategoryGrid`, `openCategoryModal`, `renderCategoryModal`, `renderExtract`, `focusExtract`, `clearExtractFilters`, `updateExtractFilters`, `setupDashPeriodBadge` agora em `js/dashboard.js` (seção "DASHBOARD V2")

### Testes
- Validação com navegador headless + servidor local contra o banco real: 22 cards de categoria, 228 linhas no extrato, 13 gráficos renderizados, sem erro fatal de JS

---

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
| `refreshDashboard()` | `dashboard.js` | Atualiza cards, gráficos, categorias e extrato |
| `getUnpaidCompetencias(exp, paysSet, curKey)` | `bills.js` | Competências não pagas e já vencidas (lógica de atraso) |
| `getOverdueFixedTotal()` | `bills.js` | Total de contas fixas em atraso (card `⚠️ Em Atraso`) |
| `renderChatHistory()` | `chat.js` | Renderiza histórico de transações no chat |
| `renderSummaryCards()` | `dashboard.js` | Cards de resumo do dashboard |
| `getAvgMonthly()` | `dashboard.js` | Média mensal (3 meses) |
| `getFutureMonthly()` | `dashboard.js` | Projeção de compromissos futuros (12 meses) |

---

## 🎨 Design

- Tema escuro (`--bg-primary: #12141a`)
- Cards com gradientes e efeito glow nos gráficos
- Notificações animadas no canto inferior direito
- Responsivo (mobile-first com breakpoints)
- Scrollbar customizada
- Loading screen com animação 3D box

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
