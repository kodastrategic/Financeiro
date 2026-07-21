-- Adiciona coluna createdAt nas tabelas existentes
ALTER TABLE categories ADD COLUMN IF NOT EXISTS createdAt TEXT DEFAULT (now()::text);
ALTER TABLE commands ADD COLUMN IF NOT EXISTS createdAt TEXT DEFAULT (now()::text);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS createdAt TEXT DEFAULT (now()::text);
ALTER TABLE installments ADD COLUMN IF NOT EXISTS createdAt TEXT DEFAULT (now()::text);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS createdAt TEXT DEFAULT (now()::text);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS createdAt TEXT DEFAULT (now()::text);
