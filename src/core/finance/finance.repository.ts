// src/core/finance/finance.repository.ts

import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  TransactionType,
} from './finance.types';


export interface FundFilter {
  fiscalEntityId?: string;
  codes?: string[];
  activeOnly?: boolean;
}

export interface TransactionFilter {
  fromDate?: Date;
  toDate?: Date;
  fundIds?: string[];
  accountIds?: string[];
  types?: TransactionType[];
}

/**
 * FinanceRepository abstracts persistence for the finance domain.
 * Implementations may be in-memory, Prisma, HTTP-based, etc.
 */
export interface FinanceRepository {
  //
  // FUNDS & ACCOUNTS
  //

  listFunds(filter?: FundFilter): Promise<Fund[]>;
  getFundById(id: string): Promise<Fund | null>;
  saveFund(fund: Fund): Promise<Fund>;

  listAccountsForFund(fundId: string): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  saveAccount(account: Account): Promise<Account>;

  //
  // BUDGET LINES
  //

  listBudgetLinesForYear(year: number): Promise<BudgetLine[]>;
  saveBudgetLine(line: BudgetLine): Promise<BudgetLine>;

  //
  // TRANSACTIONS
  //

  listTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | null>;
  saveTransaction(tx: Transaction): Promise<Transaction>;
}


