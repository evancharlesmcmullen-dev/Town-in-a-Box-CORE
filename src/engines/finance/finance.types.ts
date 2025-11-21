// src/engines/finance/finance.types.ts

// Basic domain types for municipal fund accounting and budgeting.
// These are intentionally simple; we'll refine as we integrate with real data sources.

/**
 * A fiscal entity, like "Town of Lapel – Civil" or "Lapel Water Utility".
 * For now we just represent it by id and name.
 */
export interface FiscalEntityRef {
  id: string;
  name: string;
}

/**
 * A fund within a fiscal entity (e.g., General Fund, MVH, Water Operating).
 */
export interface Fund {
  id: string;
  tenantId: string;
  fiscalEntityId: string;

  code: string;           // e.g. "101", "201"
  name: string;           // e.g. "General Fund"
  isActive: boolean;
}

/**
 * A chart-of-accounts entry within a fund (object/line).
 */
export interface Account {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;

  code: string;           // e.g. "431.010"
  name: string;           // e.g. "Professional Services"
  isActive: boolean;
}

/**
 * A budgeted appropriation for a fund/account in a given year.
 */
export interface BudgetLine {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;
  accountId: string;

  year: number;
  adoptedAmountCents: number;
  revisedAmountCents?: number; // after additional appropriations, transfers, etc.
}

/**
 * Basic transaction type classification.
 */
export type TransactionType = 'revenue' | 'expense' | 'transfer';

/**
 * A single financial transaction posted against a fund/account.
 * This is NOT meant to replace full accounting, just a structured view.
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
  amountCents: number;   // positive; type controls sign when rolled up

  sourceSystem?: string; // e.g. "Keystone", "Boyce", "Gateway"
  externalRef?: string;  // id from source system
}

/**
 * A simple snapshot of fund status for dashboards.
 */
export interface FundBalanceSummary {
  fundId: string;
  fundCode: string;
  fundName: string;

  year: number;
  adoptedBudgetCents: number;
  currentBudgetCents: number;
  actualRevenueCents: number;
  actualExpenseCents: number;
  estimatedEndingBalanceCents: number;
}

// --- CLAIMS / VOUCHERS ---

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid';

/**
 * A claim/voucher representing a proposed expenditure to be examined by the Trustee
 * and optionally by the Board.
 */
export interface Claim {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;
  accountId: string;

  // For now we keep a simple vendor/payee string; later this can reference a Vendor entity.
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

  // Link to payment/transaction once paid.
  transactionId?: string;
}
// --- FISCAL ENTITY & COST ALLOCATION ---

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

  // Optional link back to source (e.g. payroll record).
  sourceType?: string;
  sourceId?: string;
}