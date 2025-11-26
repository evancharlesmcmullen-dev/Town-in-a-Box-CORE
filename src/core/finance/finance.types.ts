// src/core/finance/finance.types.ts

export type TransactionType = 'revenue' | 'expense' | 'transfer';

/**
 * A fiscal entity (civil, utility, district, etc.).
 */
export interface FiscalEntity {
  id: string;
  tenantId: string;

  name: string;
  type: 'civil' | 'utility' | 'district' | 'other';
}

/**
 * A fund within a fiscal entity (Township Fund, Fire Fund, etc.).
 */
export interface Fund {
  id: string;
  tenantId: string;
  fiscalEntityId: string;

  code: string;            // e.g. "101"
  name: string;            // e.g. "General Fund"
  isActive: boolean;
}

/**
 * Account in the chart of accounts within a fund.
 */
export interface Account {
  id: string;
  tenantId: string;
  fiscalEntityId: string;
  fundId: string;

  code: string;            // e.g. "431.010"
  name: string;
  isActive: boolean;
}

/**
 * A budget line for a fund/account in a given year.
 */
export interface BudgetLine {
  id: string;
  tenantId: string;
  fiscalEntityId: string;

  year: number;
  fundId: string;
  accountId: string;

  adoptedAmountCents: number;
  revisedAmountCents?: number;
}

/**
 * A simple transaction posting (for now; we can later introduce JournalEntry header+lines).
 */
export interface Transaction {
  id: string;
  tenantId: string;
  fiscalEntityId: string;

  date: Date;
  fundId: string;
  accountId: string;

  type: TransactionType;
  amountCents: number;
  description?: string;
}
