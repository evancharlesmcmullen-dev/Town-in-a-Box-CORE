// src/core/finance/finance.repository.ts

import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  TransactionType,
} from './finance.types';

// Simple filter shapes – very permissive for now.
export interface FundFilter {
  tenantId?: string;
  fiscalEntityId?: string;
  codes?: string[];
  activeOnly?: boolean;

  [key: string]: any;
}

export interface TransactionFilter {
  tenantId?: string;
  fundIds?: string[];
  accountIds?: string[];
  fromDate?: Date | string;
  toDate?: Date | string;
  types?: TransactionType[];

  [key: string]: any;
}

// Minimal "open" repository interface so any existing implementation passes.
// We'll tighten this later once we lock the domain model.
export interface FinanceRepository {
  // Allow any methods; InMemoryFinanceRepository will automatically satisfy this.
  [key: string]: any;
}

// Optionally re-export common types so other modules can import from here if desired.
export type { Fund, Account, BudgetLine, Transaction, TransactionType };
