// src/engines/finance/finance.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  FundBalanceSummary,
  TransactionType,
  Claim,
  ClaimStatus,
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
  // CLAIMS
  //

  /**
   * Create a new claim/voucher for an expenditure to be examined by the Trustee.
   */
  createClaim(
    ctx: TenantContext,
    claim: Omit<Claim, 'id' | 'tenantId' | 'status' | 'createdAt'>
  ): Promise<Claim>;

  /**
   * List claims, optionally filtered by status, fund, or account.
   */
  listClaims(
    ctx: TenantContext,
    options?: {
      status?: ClaimStatus;
      fundId?: string;
      accountId?: string;
    }
  ): Promise<Claim[]>;

  /**
   * Update the status of a claim (e.g., submit, approve, reject, mark paid).
   * Implementations will set the appropriate timestamps.
   */
  updateClaimStatus(
    ctx: TenantContext,
    id: string,
    newStatus: ClaimStatus
  ): Promise<Claim>;

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

