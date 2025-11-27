// src/core/finance/finance.types.ts

// Very lightweight + flexible types so we don't block development.
// We can tighten these later once the finance module spec is final.

export type TransactionType =
  | 'RECEIPT'
  | 'DISBURSEMENT'
  | 'TRANSFER'
  | 'ADJUSTMENT';

export interface Fund {
  id: string;
  tenantId?: string;
  fiscalEntityId?: string; // <- fixes the 'fiscalEntityId' error
  code?: string;
  name?: string;
  isActive?: boolean;

  // Allow other properties used elsewhere without TS yelling
  [key: string]: any;
}

export interface Account {
  id: string;
  fundId?: string;
  code?: string;
  name?: string;

  [key: string]: any;
}

export interface BudgetLine {
  id: string;
  fundId?: string;
  accountId?: string;
  year?: number;
  adoptedAmount?: number;

  [key: string]: any;
}

export interface Transaction {
  id: string;
  fundId?: string;
  accountId?: string;
  date?: Date | string;
  amount?: number;
  type?: TransactionType;
  description?: string;

  [key: string]: any;
}
