-- ===== SCHEMA SUPABASE — FinanceApp v2 =====
-- Todas as colunas em lowercase para evitar problemas com case-sensitive

CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS commands (
  keyword TEXT PRIMARY KEY,
  category TEXT NOT NULL REFERENCES categories(name) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT,
  cardlimit NUMERIC(12,2) DEFAULT 0,
  availablelimit NUMERIC(12,2) DEFAULT 0,
  closingday INTEGER,
  dueday INTEGER,
  color TEXT DEFAULT '#3b82f6',
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  txdate TEXT NOT NULL,
  command TEXT,
  invoicepaymentid INTEGER,
  fixedexpenseid INTEGER,
  fixedmonthkey TEXT,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS installments (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  totalamount NUMERIC(12,2) NOT NULL,
  installmentcount INTEGER NOT NULL,
  installmentvalue NUMERIC(12,2) NOT NULL,
  purchasedate TEXT NOT NULL,
  firstinstallmentdate TEXT NOT NULL,
  cardid INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  notes TEXT,
  paidinstallments INTEGER DEFAULT 0,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creditor TEXT,
  originalamount NUMERIC(12,2) NOT NULL,
  currentamount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS debtpayments (
  id SERIAL PRIMARY KEY,
  debtid INTEGER REFERENCES debts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  txdate TEXT NOT NULL,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS invoicepayments (
  id SERIAL PRIMARY KEY,
  cardid INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  monthkey TEXT NOT NULL,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS recurrings (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  cardid INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  startdate TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS fixedexpenses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  dueday INTEGER,
  category TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS fixedpayments (
  id SERIAL PRIMARY KEY,
  expenseid INTEGER REFERENCES fixedexpenses(id) ON DELETE CASCADE,
  monthkey TEXT NOT NULL,
  createdat TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS budgets (
  category TEXT PRIMARY KEY,
  budgetlimit NUMERIC(12,2) NOT NULL,
  createdat TEXT DEFAULT (now()::text)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(txdate);
CREATE INDEX IF NOT EXISTS idx_transactions_command ON transactions(command);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoicepaymentid);
CREATE INDEX IF NOT EXISTS idx_installments_card ON installments(cardid);
CREATE INDEX IF NOT EXISTS idx_installments_category ON installments(category);
CREATE INDEX IF NOT EXISTS idx_invoicepayments_card ON invoicepayments(cardid);
CREATE INDEX IF NOT EXISTS idx_fixedpayments_month ON fixedpayments(monthkey);
CREATE INDEX IF NOT EXISTS idx_debtpayments_debt ON debtpayments(debtid);
