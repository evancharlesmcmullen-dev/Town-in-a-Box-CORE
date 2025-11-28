// src/engines/finance/finance.types.ts
//
// Core domain types for Indiana-style municipal fund accounting.
// Designed for SBOA / DLGF alignment while remaining generic enough for reuse.

// =============================================================================
// FUND TYPES
// =============================================================================

/**
 * Indiana fund type classification.
 * Supports standard Indiana municipal fund categories per SBOA Uniform Chart of Accounts.
 */
export type FundType =
  | 'GENERAL'
  | 'MVH'
  | 'LOCAL_ROAD_AND_STREET'
  | 'CUMULATIVE_CAPITAL_DEVELOPMENT'
  | 'DEBT_SERVICE'
  | 'RAINY_DAY'
  | 'UTILITY_OPERATING'
  | 'UTILITY_DEBT'
  | 'GRANT'
  | 'FIRE'
  | 'PARK'
  | 'CEMETERY'
  | 'TIF'
  | 'OTHER';

/**
 * A fund within a fiscal entity (e.g., General Fund, MVH, Water Operating).
 *
 * Funds are self-balancing sets of accounts used to track resources
 * for specific purposes or restrictions.
 */
export interface Fund {
  id: string;
  tenantId: string;

  /** Fund code per SBOA chart (e.g., "0101", "0706") */
  code: string;
  /** Display name (e.g., "General Fund") */
  name: string;
  /** Fund type classification */
  type: FundType;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  // Optional: SBOA/DLGF metadata hooks
  /** SBOA classification code */
  sboaCode?: string;
  /** DLGF fund number for Gateway filing */
  dlgfFundNumber?: string;

  // Display + reporting flags
  /** Whether this is a major fund for GASB 34 reporting */
  isMajorFund?: boolean;

  /** Description of the fund's purpose */
  description?: string;
}

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

/**
 * Account category classification for chart of accounts.
 * Supports both balance sheet and operating statement accounts.
 */
export type AccountCategory =
  | 'REVENUE'
  | 'EXPENDITURE'
  | 'CASH'
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'FUND_BALANCE'
  | 'OTHER';

/**
 * A chart-of-accounts entry within a fund.
 *
 * Accounts are used to categorize revenues, expenditures, and balance
 * sheet items within a fund. Compatible with SBOA 100R/AFR forms.
 */
export interface Account {
  id: string;
  tenantId: string;

  /** Account code (e.g., "101.000" or "432.010") */
  code: string;
  /** Display name (e.g., "Property Tax Revenue") */
  name: string;
  /** Account category */
  category: AccountCategory;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  /** SBOA chart of accounts code for mapping */
  sboaCode?: string;

  /** Description of the account's purpose */
  description?: string;
}

// =============================================================================
// TRANSACTION TYPES (DOUBLE-ENTRY LEDGER)
// =============================================================================

/**
 * Finance transaction type classification.
 */
export type FinanceTransactionType =
  | 'RECEIPT'
  | 'DISBURSEMENT'
  | 'JOURNAL_ENTRY'
  | 'ADJUSTMENT';

/**
 * A line item within a finance transaction.
 *
 * Each line represents a debit or credit to a specific fund/account.
 * For a balanced transaction, total debits must equal total credits.
 */
export interface FinanceTransactionLine {
  id: string;
  tenantId: string;
  transactionId: string;

  fundId: string;
  accountId: string;

  /**
   * Amount in cents (always positive).
   * Direction is captured by isDebit.
   */
  amountCents: number;

  /**
   * True if this is a debit, false for credit.
   *
   * For CASH accounts:
   * - Debit increases the balance (receipt)
   * - Credit decreases the balance (disbursement)
   *
   * For REVENUE accounts:
   * - Credit increases revenue (normal entry)
   * - Debit decreases revenue (reversal)
   *
   * For EXPENDITURE accounts:
   * - Debit increases expenditure (normal entry)
   * - Credit decreases expenditure (reversal)
   */
  isDebit: boolean;

  /** Optional link to appropriation for budget control */
  appropriationId?: string;

  /** Optional memo for this line item */
  memo?: string;
}

/**
 * A finance transaction with double-entry-style lines.
 *
 * Every transaction must balance: sum of debits = sum of credits.
 */
export interface FinanceTransaction {
  id: string;
  tenantId: string;

  type: FinanceTransactionType;

  /** Transaction/posting date (ISO 8601) */
  transactionDate: string;

  /** Reference number (e.g., check #, receipt #, JE #) */
  reference?: string;

  /** Description of the transaction */
  description: string;

  createdAt: string;
  updatedAt: string;

  /** Transaction line items (debits and credits) */
  lines: FinanceTransactionLine[];
}

// =============================================================================
// APPROPRIATION / BUDGET TYPES
// =============================================================================

/**
 * An appropriation line representing budget authority for a specific
 * fund/account combination in a fiscal year.
 *
 * Appropriations enable budget control - no spending beyond appropriation.
 */
export interface Appropriation {
  id: string;
  tenantId: string;

  fundId: string;
  /** Expenditure account this appropriation covers */
  accountId: string;

  /** Budget year (calendar year for Indiana) */
  budgetYear: number;

  /** Original adopted appropriation amount in cents */
  adoptedAmountCents: number;

  /** Additional appropriations from later ordinances in cents */
  additionalAppropriationCents?: number;

  /** Reductions by council or DLGF in cents */
  reductionsCents?: number;

  createdAt: string;
  updatedAt: string;

  /** Ordinance number that adopted this appropriation */
  ordinanceNumber?: string;

  /** Date the appropriation was adopted */
  adoptedDate?: string;
}

// =============================================================================
// SUMMARY TYPES FOR REPORTING
// =============================================================================

/**
 * Summary of a fund's cash balance as of a specific date.
 *
 * Used for dashboards, reports, and quick balance checks.
 */
export interface FundBalanceSummary {
  fundId: string;

  /** As-of date for the balance (ISO 8601) */
  asOfDate: string;

  /** Cash balance in cents */
  cashBalanceCents: number;

  /** Encumbered amount in cents (committed but not yet spent) */
  encumberedCents?: number;

  /** Available balance in cents (cash - encumbered) */
  availableCents?: number;
}

/**
 * Summary of appropriation usage for budget tracking.
 *
 * Shows how much of an appropriation has been used and what remains.
 */
export interface AppropriationUsageSummary {
  appropriationId: string;
  budgetYear: number;

  /** Original adopted amount in cents */
  adoptedAmountCents: number;

  /** Additional appropriations in cents */
  additionalAppropriationCents: number;

  /** Reductions in cents */
  reductionsCents: number;

  /** Amount actually spent (expenditure transactions) in cents */
  expendedCents: number;

  /** Amount encumbered (committed) in cents */
  encumberedCents: number;

  /** Remaining available to spend in cents */
  availableCents: number;
}

// =============================================================================
// LEGACY TYPES (for backward compatibility with existing code)
// =============================================================================

/**
 * A fiscal entity, like "Town of Lapel – Civil" or "Lapel Water Utility".
 * @deprecated Use core/finance/finance.types.ts FiscalEntity instead
 */
export interface FiscalEntityRef {
  id: string;
  name: string;
}

/**
 * Basic transaction type classification.
 * @deprecated Use FinanceTransactionType instead
 */
export type TransactionType = 'revenue' | 'expense' | 'transfer';

/**
 * A budgeted appropriation for a fund/account in a given year.
 * @deprecated Use Appropriation instead
 */
export interface BudgetLine {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;
  accountId: string;

  year: number;
  adoptedAmountCents: number;
  revisedAmountCents?: number;
}

/**
 * A single financial transaction posted against a fund/account.
 * @deprecated Use FinanceTransaction with FinanceTransactionLine instead
 */
export interface Transaction {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;
  accountId: string;

  type: TransactionType;
  date: Date;
  description: string;
  amountCents: number;

  sourceSystem?: string;
  externalRef?: string;
}

// =============================================================================
// CLAIMS / VOUCHERS
// =============================================================================

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid';

/**
 * A claim/voucher representing a proposed expenditure to be examined
 * by the Trustee and optionally by the Board.
 */
export interface Claim {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;
  accountId: string;

  payeeName: string;
  description: string;
  amountCents: number;

  status: ClaimStatus;

  createdAt: Date;
  createdByUserId?: string;

  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  paidAt?: Date;

  transactionId?: string;
}

// =============================================================================
// FISCAL ENTITY & COST ALLOCATION
// =============================================================================

/**
 * A fiscal entity (civil, utility, special district, etc.).
 */
export interface FiscalEntity {
  id: string;
  tenantId: string;

  name: string;
  type: 'civil' | 'utility' | 'district' | 'other';
}

/**
 * Simple cost allocation record for shared costs (e.g., staff time).
 */
export interface CostAllocation {
  id: string;
  tenantId: string;

  fiscalEntityId: string;
  fundId: string;

  description?: string;
  amountCents: number;

  sourceType?: string;
  sourceId?: string;
}
