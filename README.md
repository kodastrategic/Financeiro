# FinanceApp — Documentação do Projeto

## 📋 Visão Geral

**FinanceApp** é um gerenciador financeiro pessoal **offline** (app portable, roda direto do `index.html` no navegador). Utiliza armazenamento local via IndexedDB — nenhum dado sai da máquina.

### Tecnologias
- HTML + CSS + JavaScript puro (sem frameworks)
- **Dexie.js** 3.2.6 — wrapper para IndexedDB
- **Chart.js** 4.4.1 — gráficos no Dashboard
- Hospedagem: ~~Vercel~~ (removido na sessão, app é puramente local)

---

## 🧱 Estrutura dos Arquivos

```
finance-app/
├── index.html      # Estrutura da interface (~275 linhas)
├── style.css       # Tema escuro completo (~770 linhas)
├── script.js       # Toda a lógica do app (~1390 linhas)
├── README.md       # Este arquivo
├── .gitignore
└── .git/
```

---

## 🗄️ Banco de Dados (IndexedDB — Dexie)

**11 tabelas** na versão 6 do schema (`script.js:22-28`):

| Tabela | Chave Primária | Índices | Descrição |
|--------|---------------|---------|-----------|
| `transactions` | `++id` | `type, category, date, command, invoicePaymentId` | Transações financeiras (receitas/despesas) |
| `commands` | `&keyword` | `category, type` | Comandos do chat (`/salario`, `/mercado`...) |
| `categories` | `&name` | `type` | Categorias com cor e tipo (income/expense) |
| `cards` | `++id` | `name` | Cartões de crédito |
| `installments` | `++id` | `cardId, category, purchaseDate` | Compras parceladas |
| `debts` | `++id` | — | Dívidas (simplificado: sem status/vencimento/juros) |
| `debtPayments` | `++id` | `debtId, date` | Histórico de pagamentos de dívidas |
| `invoicePayments` | `++id` | `cardId, monthKey` | Pagamentos de faturas de cartão |
| `recurrings` | `++id` | `cardId, category` | Despesas recorrentes (assinaturas) |
| `fixedExpenses` | `++id` | `name, active` | Contas fixas (aluguel, internet) |
| `fixedPayments` | `++id` | `expenseId, monthKey` | Pagamento de contas fixas por mês |

---

## 🎯 Funcionalidades

### 1️⃣ Chat de Comandos
- Digite `/<comando> <valor>` para lançar transações
- Autocomplete ao digitar `/` (busca no banco de comandos)
- Histórico completo com saldo por data
- Botão para excluir transação individual

### 2️⃣ Dashboard Financeiro
- **9 cartões de resumo**:
  - Saldo Atual, Saldo Projetado (próximo mês), Dívidas, Receita do Mês
  - Contas Fixas (clicável → modal), Despesas do Mês (clicável → modal), Parcelas Futuras (clicável → modal filtrado), Dívidas Atrasadas, Crédito Usado
- **11 gráficos**: Evolução do Saldo, Gastos por Categoria, Receitas por Categoria, Gastos Mensais, Receitas Mensais, Saídas por Período, Compromissos Futuros (inclui Contas Fixas), Investimentos, Comparação Mensal, Top Despesas/Receitas, Endividamento, Fluxo de Caixa

### 3️⃣ Aba Comandos
- Criar/editar/excluir comandos (palavra-chave → categoria)
- Criar/editar/excluir categorias (nome, cor, tipo receita/despesa)
- Categorias pré-definidas (Salário, Alimentação, Mercado, etc.)
- Seed inicial de 18 categorias e 16 comandos

### 4️⃣ Aba Cartões
- **Gestão de cartões**: nome, banco, limite, fechamento, vencimento, cor
- **Modal de Fatura**: visualizar mês a mês com parcelas + recorrentes, marcar/desmarcar pagamento
- **Compras Parceladas**: cadastro com cálculo automático do valor da parcela, vínculo com cartão, pagamento individual
- **Contas Fixas**: despesas mensais fixas (aluguel, internet) **sem vínculo com cartão**. Modal com navegação entre meses, pagamento individual por conta, botão pagar/desmarcar todas
- **Compras Recorrentes**: assinaturas mensais com data de início, ativar/pausar
- **Dívidas**: simplificadas (sem status/vencimento/juros), pagamento parcial cria transação de despesa automaticamente

### 5️⃣ Importação / Exportação
- Backup completo em JSON (todas as tabelas)
- Restauração com substituição total dos dados
- Relatório financeiro em Markdown

---

## 📐 Cálculos Importantes

### Média Mensal (`getAvgMonthly`)
```
Média = Soma dos meses com movimento ÷ Quantidade de meses com movimento
```
- Sempre olha os últimos 3 meses
- **Só inclui na média meses que realmente tiveram transações** (meses zerados são ignorados)

### Saldo Projetado (card do dashboard)
```
Projetado = SaldoAtual + ReceitaMédia - DespesaMédia - CompromissoDoPróximoMês
```
- Usa a média dos últimos 3 meses para receita e despesa
- Compromisso do próximo mês = parcelas + recorrentes + contas fixas com vencimento no mês

### Projeção de 12 Meses (modal ao clicar no card)
```
Para cada mês i (1 a 12):
  SaldoFinal[i] = SaldoAnterior + ReceitaMédia - DespesaMédia - Compromisso[i]
```
- Compromisso[i] inclui: parcelas futuras, recorrentes E contas fixas ativas

---

## 🔧 Alterações Realizadas na Sessão

### Bugfix: Desmarcar fatura como paga não funcionava
- **Causa**: `item.installmentId` nunca era populado nos itens da fatura
- **Solução**: Adicionado `installmentId: inst.id` na função `getCardInvoiceMonths`

### Bugfix: Pagar fatura com recorrentes não debitava do saldo
- **Causa**: `toggleInvoiceMonth` tratava todos os itens como `installment`, mas recorrentes têm `recurringId`, não `installmentId`
- **Solução**: Adicionado `if/else` separando `item.type === 'installment'` e `item.type === 'recurring'`

### Melhoria: Pagar dívida cria transação automaticamente
- `payDebt` agora gera `{ type: 'expense', category: 'Dívidas', description: 'Pagamento dívida: Nome' }`
- Saldo é debitado e transação aparece no Chat

### Melhoria: Formulário de dívidas simplificado
- Removidos: juros, status (atrasada/em dia/negociada/quitada), data de vencimento
- Toda dívida é tratada como atrasada por padrão

### Melhoria: Card de Saldo Projetado clicável
- Abre modal com tabela de projeção mês a mês por 12 meses

### Melhoria: Card de Despesas do Mês clicável
- Abre modal com lista detalhada das despesas do mês atual

### Feature: Modal de Compromissos Futuros
- Substitui o antigo "Parcelas Futuras"
- Agrupa parcelas + recorrentes por mês
- Filtros: Todos / Parcelas / Recorrentes
- Mostra total geral e total por mês
- Range: do mês atual até o último compromisso (ou +12 meses)
- **Bug corrigido durante a sessão**: filtro `'installments'` → `'installment'` (singular)

### Melhoria: Média mensal corrigida
- `.filter(v => v > 0)` adicionado — meses sem transações não entram no cálculo

---

## 🔧 Alterações Realizadas na Sessão 3

### Debug: Identificar origem de gastos suspeitos
- Função `debugAlimentacao()` no console (`F12`) que lista todas as transações e parcelas de uma categoria específica
- Útil para rastrear valores inesperados nos gráficos

### Bugfix: Gráfico "Gastos por Categoria" superestimava parcelas
- **Antes**: somava o **total restante** de todas as parcelas (`(installmentCount - paidInstallments) * installmentValue`)
- **Depois**: considera apenas a **parcela do mês atual** de cada compra parcelada
- Ex: uma compra de 10× R$ 300 com 3 pagas antes mostrava R$ 2.100; agora mostra R$ 300 (apenas se vencer no mês corrente)

### Feature: Coluna "Categoria" na tabela de Compras Parceladas
- Nova coluna exibindo a categoria de cada compra parcelada
- Ajuda a identificar rapidamente lançamentos com categoria errada

### Feature: Botão "Editar" nas Compras Parceladas
- Cada compra parcelada agora tem botão "Editar" ao lado de "Pagar" e "Excluir"
- Ao clicar, o formulário é preenchido com os dados da compra
- Botão de envio muda para "Salvar" + botão "Cancelar" aparece
- Ao salvar, mantém o número de parcelas já pagas

---

## 🔧 Alterações Realizadas na Sessão 2

### Feature: Contas Fixas
- Nova seção "📄 Contas Fixas" na aba Cartões (independente de cartão de crédito)
- Cadastro: nome, valor, dia vencimento, categoria, ativo/pausado
- 2 novas tabelas no DB: `fixedExpenses` (definições) e `fixedPayments` (pagamentos por mês)
- Incluído no export/import/clear de dados

### Feature: Modal de Contas Fixas com navegação entre meses
- Navegação ◀ ▶ para meses anteriores e futuros
- Pagamento individual por conta (cada uma com seu botão ✅ Pagar / ✕ Desmarcar)
- Botão global "Pagar Todas do Mês" / "Desmarcar Todas do Mês"
- Cada pagamento individual gera UMA transação no Chat (descrição: `"Aluguel (2026-06)"`)
- Ao desmarcar, a transação é removida e o saldo restituído

### Feature: Card "📄 Contas Fixas" no Dashboard
- Exibe total mensal das contas ativas
- Clicável → abre o modal de Contas Fixas

### Integração nos Gráficos e Projeções
- **`getFutureMonthly`**: agora inclui contas fixas ativas nos 12 meses futuros
- **Saldo Projetado** (card + modal): considera contas fixas nos compromissos
- **Gráfico "Compromissos Futuros"**: nova barra verde "Contas Fixas"
- **Gráfico "Evolução do Saldo"**: linha projetada inclui contas fixas
- **Gráfico "Fluxo de Caixa"**: inclui contas fixas
- **Modal "Compromissos Futuros por Mês"**: filtro "Todos" agora exibe contas fixas

---

## 📂 Funções Principais no script.js

| Função | Linha | Descrição |
|--------|-------|-----------|
| `seedData()` | 42 | Popula categorias e comandos iniciais |
| `processCommand(text)` | 114 | Processa comando do chat (`/comando valor`) |
| `executeCommand(keyword, amount)` | 130 | Executa o comando e cria transação |
| `refreshDashboard()` | 159 | Atualiza todos os cards e gráficos |
| `renderSummaryCards()` | 173 | Renderiza os 8 cards de resumo |
| `getAvgMonthly()` | 206 | Calcula média mensal de receita/despesa (3 meses) |
| `getFutureMonthly()` | 222 | Projeta compromissos futuros por mês (12 meses) |
| `toggleInvoiceMonth()` | 722 | Marcar/desmarcar pagamento de fatura |
| `openProjectedModal()` | 920 | Modal de projeção de saldo |
| `openMonthExpenseModal()` | 948 | Modal de despesas do mês |
| `openFutureInstallmentsModal(filter)` | 975 | Modal de compromissos futuros com filtro |
| `payDebt(id)` | 852 | Pagar dívida (cria transação automaticamente) |
| `clearAllData()` | 1008 | Limpar todos os dados |
| `exportData()` | 1018 | Exportar backup JSON |
| `importData(event)` | 1026 | Importar backup JSON |
| `generateAndSaveReport()` | 1050 | Gerar relatório Markdown |
| `setupFixedForm()` | 940 | Setup do formulário de contas fixas |
| `loadFixedTable()` | 944 | Renderiza tabela de contas fixas |
| `openFixedModal(monthKey)` | 960 | Modal de contas fixas com navegação mensal |
| `toggleFixedExpense(id, monthKey)` | 1031 | Pagar/desmarcar conta fixa individual |
| `toggleAllFixed(monthKey)` | 1071 | Pagar/desmarcar todas as contas do mês |

---

## 🎨 Design

- Tema escuro (`--bg-primary: #12141a`)
- Cards com gradientes e efeito glow nos gráficos
- Notificações animadas no canto inferior direito
- Responsivo (mas recomenda-se desktop)
- Scrollbar customizada

---

## 💡 Melhorias Futuras

### 🏆 Prioritárias
1. **Editar Transações** — botão de edição no chat ao lado do excluir, modal para alterar valor/categoria/data
2. **Orçamento por Categoria (Budget)** — definir limites mensais por categoria com alerta visual no dashboard
3. **Modal de Confirmação** — substituir `confirm()` nativo por modal in-app temático
4. **Loading State no Dashboard** — skeleton loading ao carregar, evitar `destroyAllCharts()` desnecessário

### 📊 Médio Impacto
5. **Metas de Economia** — savings goals com barra de progresso
6. **Calendário Financeiro** — visão mensal com contas a vencer
7. **Filtros na Lista de Transações** — busca por período/categoria no chat ou aba "Extrato"
8. **Relatório em PDF** — substituir Markdown por PDF formatado

### 🔧 Qualidade de Código
9. **Modularização do script.js** — separar em módulos (db, chat, dashboard, cards, modals, utils)
10. **Migrar `onclick=` para `addEventListener`** — remover event handlers inline do HTML

Para retomar, basta ler este arquivo.
