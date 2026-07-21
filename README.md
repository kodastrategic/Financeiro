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
├── script.js             # Toda a lógica do app
├── supabase-config.js    # Credenciais Supabase (URL + anonKey)
├── schema.sql            # Schema do banco PostgreSQL
├── js/
│   └── db.js             # Wrapper Supabase com key mapping
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

## 📂 Funções Principais (script.js)

| Função | Descrição |
|--------|-----------|
| `seedData()` | Popula categorias iniciais se vazio |
| `processCommand(text)` | Processa comando do chat, exibe modal se não encontrado |
| `executeCommand(keyword, amount)` | Executa comando, fallback para categoria, cria transação |
| `showCreateCommandModal(keyword, amount, date)` | Modal de criação de comando não encontrado |
| `showAutocomplete(input, box)` | Autocomplete combinado comandos + categorias |
| `refreshDashboard()` | Atualiza cards e gráficos |
| `renderChatHistory()` | Renderiza histórico de transações no chat |
| `renderSummaryCards()` | Cards de resumo do dashboard |
| `getAvgMonthly()` | Média mensal (3 meses) |
| `getFutureMonthly()` | Projeção de compromissos futuros (12 meses) |

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
9. **Modularização do script.js** — separar em módulos (db, chat, dashboard, cards, modals, utils)
10. **Migrar `onclick=` para `addEventListener`** — remover event handlers inline do HTML

---

Para retomar, basta ler este arquivo.
