-- ===== SCHEMA SUPABASE — FinanceApp v2 =====
-- Execute este script no SQL Editor do seu projeto Supabase

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT NOT NULL DEFAULT '#3b82f6'
);

-- Commands
CREATE TABLE IF NOT EXISTS commands (
  keyword TEXT PRIMARY KEY,
  category TEXT NOT NULL REFERENCES categories(name) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense'))
);

-- Cards
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT,
  limit NUMERIC(12,2) DEFAULT 0,
  availableLimit NUMERIC(12,2) DEFAULT 0,
  closingDay INTEGER,
  dueDay INTEGER,
  color TEXT DEFAULT '#3b82f6'
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  date TEXT NOT NULL,
  command TEXT,
  invoicePaymentId INTEGER,
  fixedExpenseId INTEGER,
  fixedMonthKey TEXT,
  createdAt TEXT DEFAULT (now()::text)
);

-- Installments
CREATE TABLE IF NOT EXISTS installments (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  totalAmount NUMERIC(12,2) NOT NULL,
  installmentCount INTEGER NOT NULL,
  installmentValue NUMERIC(12,2) NOT NULL,
  purchaseDate TEXT NOT NULL,
  firstInstallmentDate TEXT NOT NULL,
  cardId INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  notes TEXT,
  paidInstallments INTEGER DEFAULT 0
);

-- Debts
CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creditor TEXT,
  originalAmount NUMERIC(12,2) NOT NULL,
  currentAmount NUMERIC(12,2) NOT NULL,
  notes TEXT
);

-- Debt Payments
CREATE TABLE IF NOT EXISTS debtPayments (
  id SERIAL PRIMARY KEY,
  debtId INTEGER REFERENCES debts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  date TEXT NOT NULL,
  createdAt TEXT DEFAULT (now()::text)
);

-- Invoice Payments
CREATE TABLE IF NOT EXISTS invoicePayments (
  id SERIAL PRIMARY KEY,
  cardId INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  monthKey TEXT NOT NULL,
  createdAt TEXT DEFAULT (now()::text)
);

-- Recurrings
CREATE TABLE IF NOT EXISTS recurrings (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  cardId INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  startDate TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  createdAt TEXT DEFAULT (now()::text)
);

-- Fixed Expenses
CREATE TABLE IF NOT EXISTS fixedExpenses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  dueDay INTEGER,
  category TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  createdAt TEXT DEFAULT (now()::text)
);

-- Fixed Payments
CREATE TABLE IF NOT EXISTS fixedPayments (
  id SERIAL PRIMARY KEY,
  expenseId INTEGER REFERENCES fixedExpenses(id) ON DELETE CASCADE,
  monthKey TEXT NOT NULL,
  createdAt TEXT DEFAULT (now()::text)
);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
  category TEXT PRIMARY KEY,
  limit NUMERIC(12,2) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_command ON transactions(command);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoicePaymentId);
CREATE INDEX IF NOT EXISTS idx_installments_card ON installments(cardId);
CREATE INDEX IF NOT EXISTS idx_installments_category ON installments(category);
CREATE INDEX IF NOT EXISTS idx_invoicePayments_card ON invoicePayments(cardId);
CREATE INDEX IF NOT EXISTS idx_fixedPayments_month ON fixedPayments(monthKey);
CREATE INDEX IF NOT EXISTS idx_debtPayments_debt ON debtPayments(debtId);
