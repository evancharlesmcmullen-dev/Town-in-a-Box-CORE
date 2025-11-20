// src/engines/finance/finance.service.ts

import { TenantContext } from '../../core/tenancy/types';
import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  FundBalanceSummary,
  TransactionType,
} from './finance.types';

/**
 * Public service interface for the Finance engine.
 *
 * Implementations will:
 * - Pull data from external systems (Keystone, Boyce, SBOA Gateway, etc.) OR
 *   store native Town-in-a-Box finance data.
 * - Provide read APIs for dashboards, budgets, and exports.
 * - Eventually support "what-if" scenario modeling.
 *
 * For now, this is just an interface (no persistence or behavior).
 */
export interface FinanceService {
  //
  // FUND & ACCOUNT READS
  //

  listFunds(ctx: TenantContext): Promise<Fund[]>;

  listAccountsForFund(
    ctx: TenantContext,
    fundId: string
  ): Promise<Account[]>;

  //
  // BUDGET LINES
  //

  listBudgetLinesForYear(
    ctx: TenantContext,
    year: number
  ): Promise<BudgetLine[]>;

  //
  // TRANSACTIONS
  //

  /**
   * Fetch transactions matching basic filters.
   */
  listTransactions(
    ctx: TenantContext,
    options: {
      fromDate?: Date;
      toDate?: Date;
      fundId?: string;
      accountId?: string;
      type?: TransactionType;
      sourceSystem?: string;
    }
  ): Promise<Transaction[]>;

  //
  // FUND BALANCE SUMMARY
  //

  /**
   * Compute fund balance summaries for a given fiscal year.
   * Implementations may pre-aggregate for performance.
   */
  getFundBalanceSummaries(
    ctx: TenantContext,
    year: number
  ): Promise<FundBalanceSummary[]>;

  //
  // EXPORTS
  //

  /**
   * Export finance data (funds, accounts, budgets, transactions) in a
   * format suitable for SBOA / Keystone / Boyce / CSV.
   * For now we just return a generic object; later this can be shaped
   * into specific export profiles.
   */
  exportFinanceData(
    ctx: TenantContext,
    year: number
  ): Promise<unknown>;
}