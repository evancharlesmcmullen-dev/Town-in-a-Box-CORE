-- ===========================================================================
-- File: docs/architecture/20251128_finance_core.sql
--
-- Finance Core Database Schema Design
-- Indiana-style double-entry fund accounting with RLS multi-tenancy
--
-- Created: 2025-11-28
-- ===========================================================================

-- ===========================================================================
-- OVERVIEW
-- ===========================================================================
--
-- This schema supports Indiana-style municipal fund accounting:
-- - Funds (General, MVH, Utilities, etc.)
-- - Accounts (Revenue, Expenditure, Cash, etc.)
-- - Double-entry transactions with balanced lines
-- - Appropriations for budget control
--
-- Multi-tenancy is enforced via Row-Level Security (RLS).
-- All queries must set `app.current_tenant_id` before executing.
--
-- Example:
--   SET LOCAL app.current_tenant_id = '<tenant-uuid>';
--   SELECT * FROM funds;  -- Returns only funds for that tenant
--
-- ===========================================================================

-- ===========================================================================
-- FUNDS TABLE
-- ===========================================================================
--
-- A fund is a self-balancing set of accounts used to track resources
-- for specific purposes (e.g., General Fund, MVH, Water Operating).
--
-- Aligns with SBOA Uniform Chart of Accounts for Indiana municipalities.
--
CREATE TABLE funds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,

  -- Fund identification
  code          TEXT NOT NULL,        -- SBOA fund code (e.g., "0101", "0706")
  name          TEXT NOT NULL,        -- Display name (e.g., "General Fund")
  type          TEXT NOT NULL,        -- Fund type classification

  -- Status
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  -- Indiana SBOA/DLGF metadata
  sboa_code         TEXT,             -- SBOA classification code
  dlgf_fund_number  TEXT,             -- DLGF Gateway fund number
  is_major_fund     BOOLEAN,          -- Major fund for GASB 34 reporting

  -- Description
  description   TEXT,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT funds_tenant_code_unique UNIQUE (tenant_id, code)
);

-- Indexes
CREATE INDEX idx_funds_tenant_id ON funds (tenant_id);
CREATE INDEX idx_funds_type ON funds (type);
CREATE INDEX idx_funds_is_active ON funds (is_active);

-- RLS Policy
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY funds_tenant_isolation ON funds
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Fund type values (for reference, not a constraint):
-- GENERAL, MVH, LOCAL_ROAD_AND_STREET, CUMULATIVE_CAPITAL_DEVELOPMENT,
-- DEBT_SERVICE, RAINY_DAY, UTILITY_OPERATING, UTILITY_DEBT, GRANT,
-- FIRE, PARK, CEMETERY, TIF, OTHER


-- ===========================================================================
-- ACCOUNTS TABLE
-- ===========================================================================
--
-- A chart-of-accounts entry for categorizing revenues, expenditures,
-- and balance sheet items. Compatible with SBOA 100R/AFR forms.
--
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,

  -- Account identification
  code          TEXT NOT NULL,        -- Account code (e.g., "101.000", "432.010")
  name          TEXT NOT NULL,        -- Display name (e.g., "Property Tax Revenue")
  category      TEXT NOT NULL,        -- Account category

  -- Status
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  -- SBOA metadata
  sboa_code     TEXT,                 -- SBOA chart of accounts code

  -- Description
  description   TEXT,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT accounts_tenant_code_unique UNIQUE (tenant_id, code)
);

-- Indexes
CREATE INDEX idx_accounts_tenant_id ON accounts (tenant_id);
CREATE INDEX idx_accounts_category ON accounts (category);
CREATE INDEX idx_accounts_is_active ON accounts (is_active);

-- RLS Policy
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_tenant_isolation ON accounts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Account category values (for reference):
-- REVENUE, EXPENDITURE, CASH, RECEIVABLE, PAYABLE, FUND_BALANCE, OTHER


-- ===========================================================================
-- FINANCE_TRANSACTIONS TABLE
-- ===========================================================================
--
-- A finance transaction header. Each transaction has multiple lines
-- that must balance (total debits = total credits).
--
CREATE TABLE finance_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,

  -- Transaction details
  type             TEXT NOT NULL,           -- RECEIPT, DISBURSEMENT, JOURNAL_ENTRY, ADJUSTMENT
  transaction_date DATE NOT NULL,           -- Posting date
  reference        TEXT,                    -- Reference number (check #, receipt #, JE #)
  description      TEXT NOT NULL,           -- Transaction description

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_finance_transactions_tenant_id ON finance_transactions (tenant_id);
CREATE INDEX idx_finance_transactions_type ON finance_transactions (type);
CREATE INDEX idx_finance_transactions_date ON finance_transactions (transaction_date);
CREATE INDEX idx_finance_transactions_tenant_date ON finance_transactions (tenant_id, transaction_date);

-- RLS Policy
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_transactions_tenant_isolation ON finance_transactions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);


-- ===========================================================================
-- FINANCE_TRANSACTION_LINES TABLE
-- ===========================================================================
--
-- Individual line items within a transaction.
-- Each line is a debit or credit to a specific fund/account.
--
-- For a balanced transaction:
--   SUM(amount_cents WHERE is_debit = true) = SUM(amount_cents WHERE is_debit = false)
--
-- Double-entry conventions:
-- - CASH accounts: debits increase balance (receipts), credits decrease (disbursements)
-- - REVENUE accounts: credits increase (normal entry), debits decrease (reversals)
-- - EXPENDITURE accounts: debits increase (normal entry), credits decrease (reversals)
--
CREATE TABLE finance_transaction_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,

  -- Parent transaction
  transaction_id   UUID NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,

  -- Fund and account
  fund_id          UUID NOT NULL REFERENCES funds(id),
  account_id       UUID NOT NULL REFERENCES accounts(id),

  -- Amount and direction
  amount_cents     BIGINT NOT NULL,         -- Always positive; direction is isDebit
  is_debit         BOOLEAN NOT NULL,        -- True = debit, False = credit

  -- Budget linkage (optional)
  appropriation_id UUID,                    -- Links expenditure to appropriation

  -- Optional memo
  memo             TEXT
);

-- Indexes
CREATE INDEX idx_finance_transaction_lines_tenant_id ON finance_transaction_lines (tenant_id);
CREATE INDEX idx_finance_transaction_lines_transaction_id ON finance_transaction_lines (transaction_id);
CREATE INDEX idx_finance_transaction_lines_fund_id ON finance_transaction_lines (fund_id);
CREATE INDEX idx_finance_transaction_lines_account_id ON finance_transaction_lines (account_id);
CREATE INDEX idx_finance_transaction_lines_appropriation_id ON finance_transaction_lines (appropriation_id);
CREATE INDEX idx_finance_transaction_lines_fund_account ON finance_transaction_lines (fund_id, account_id);

-- RLS Policy
ALTER TABLE finance_transaction_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_transaction_lines_tenant_isolation ON finance_transaction_lines
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);


-- ===========================================================================
-- APPROPRIATIONS TABLE
-- ===========================================================================
--
-- Budget authority for a specific fund/account combination in a fiscal year.
-- Enables budget control - no spending beyond appropriation.
--
CREATE TABLE appropriations (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                      UUID NOT NULL,

  -- Budget location
  fund_id                        UUID NOT NULL REFERENCES funds(id),
  account_id                     UUID NOT NULL REFERENCES accounts(id),

  -- Budget year
  budget_year                    INT NOT NULL,

  -- Amounts (all in cents)
  adopted_amount_cents           BIGINT NOT NULL,          -- Original adopted amount
  additional_appropriation_cents BIGINT NOT NULL DEFAULT 0, -- Later additions
  reductions_cents               BIGINT NOT NULL DEFAULT 0, -- Council/DLGF reductions

  -- Metadata
  ordinance_number               TEXT,                     -- Adopting ordinance
  adopted_date                   DATE,                     -- Adoption date

  -- Timestamps
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT appropriations_unique UNIQUE (tenant_id, fund_id, account_id, budget_year)
);

-- Indexes
CREATE INDEX idx_appropriations_tenant_id ON appropriations (tenant_id);
CREATE INDEX idx_appropriations_budget_year ON appropriations (budget_year);
CREATE INDEX idx_appropriations_fund_id ON appropriations (fund_id);
CREATE INDEX idx_appropriations_account_id ON appropriations (account_id);
CREATE INDEX idx_appropriations_tenant_year ON appropriations (tenant_id, budget_year);

-- RLS Policy
ALTER TABLE appropriations ENABLE ROW LEVEL SECURITY;

CREATE POLICY appropriations_tenant_isolation ON appropriations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);


-- ===========================================================================
-- HELPER VIEWS (OPTIONAL)
-- ===========================================================================

-- Fund balance summary view (for dashboard queries)
-- Note: This is a simplified view. Production may need materialized views
-- or pre-computed balances for performance.
--
-- CREATE VIEW fund_balance_summary AS
-- SELECT
--   l.fund_id,
--   t.transaction_date,
--   SUM(CASE
--     WHEN a.category = 'CASH' AND l.is_debit THEN l.amount_cents
--     WHEN a.category = 'CASH' AND NOT l.is_debit THEN -l.amount_cents
--     ELSE 0
--   END) as cash_balance_cents
-- FROM finance_transaction_lines l
-- JOIN finance_transactions t ON t.id = l.transaction_id
-- JOIN accounts a ON a.id = l.account_id
-- GROUP BY l.fund_id, t.transaction_date;


-- ===========================================================================
-- NOTES & TODOs
-- ===========================================================================
--
-- Current simplifications:
-- 1. Encumbrances are not yet tracked (always 0 in summaries)
-- 2. No SBOA export endpoints yet
-- 3. No year-end closing / fund-balance roll-forward logic yet
-- 4. No fiscal year configuration (assumes calendar year for Indiana)
--
-- Future enhancements:
-- 1. Add encumbrance tracking tables
-- 2. Add fiscal_years configuration table
-- 3. Add year-end closing journal entry automation
-- 4. Add audit trail tables for transaction modifications
-- 5. Consider materialized views for balance calculations at scale
--
-- ===========================================================================
