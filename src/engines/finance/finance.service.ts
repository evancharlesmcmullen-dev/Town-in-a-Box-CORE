// src/engines/finance/finance.service.ts
//
// Public service interface for the Finance Ledger engine.
//
// Implementations will:
// - Support Indiana-style double-entry fund accounting
// - Enforce balanced transactions (debits = credits)
// - Track appropriations and budget control
// - Provide fund balance and appropriation usage summaries

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  Fund,
  FundType,
  Account,
  AccountCategory,
  FinanceTransaction,
  FinanceTransactionType,
  Appropriation,
  FundBalanceSummary,
  AppropriationUsageSummary,
} from './finance.types';

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new fund.
 */
export interface CreateFundInput {
  code: string;
  name: string;
  type: FundType;
  isActive?: boolean;
  sboaCode?: string;
  dlgfFundNumber?: string;
  isMajorFund?: boolean;
  description?: string;
}

/**
 * Input for updating an existing fund.
 */
export interface UpdateFundInput {
  name?: string;
  type?: FundType;
  isActive?: boolean;
  sboaCode?: string;
  dlgfFundNumber?: string;
  isMajorFund?: boolean;
  description?: string;
}

/**
 * Input for creating a new account.
 */
export interface CreateAccountInput {
  code: string;
  name: string;
  category: AccountCategory;
  isActive?: boolean;
  sboaCode?: string;
  description?: string;
}

/**
 * Input for updating an existing account.
 */
export interface UpdateAccountInput {
  name?: string;
  category?: AccountCategory;
  isActive?: boolean;
  sboaCode?: string;
  description?: string;
}

/**
 * Input for a transaction line item.
 */
export interface TransactionLineInput {
  fundId: string;
  accountId: string;
  amountCents: number;
  isDebit: boolean;
  appropriationId?: string;
  memo?: string;
}

/**
 * Input for creating a new transaction.
 */
export interface CreateTransactionInput {
  type: FinanceTransactionType;
  transactionDate: string;
  reference?: string;
  description: string;
  lines: TransactionLineInput[];
}

/**
 * Input for creating a new appropriation.
 */
export interface CreateAppropriationInput {
  fundId: string;
  accountId: string;
  budgetYear: number;
  adoptedAmountCents: number;
  additionalAppropriationCents?: number;
  reductionsCents?: number;
  ordinanceNumber?: string;
  adoptedDate?: string;
}

/**
 * Input for updating an existing appropriation.
 */
export interface UpdateAppropriationInput {
  additionalAppropriationCents?: number;
  reductionsCents?: number;
  ordinanceNumber?: string;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

/**
 * Filter options for listing accounts.
 */
export interface AccountFilter {
  category?: AccountCategory;
  isActive?: boolean;
}

/**
 * Filter options for listing transactions.
 */
export interface TransactionFilter {
  fundId?: string;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  type?: FinanceTransactionType;
}

/**
 * Filter options for listing appropriations.
 */
export interface AppropriationFilter {
  budgetYear?: number;
  fundId?: string;
  accountId?: string;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Finance Ledger Service interface.
 *
 * Provides CRUD operations for funds, accounts, transactions, and appropriations.
 * Supports double-entry accounting with balanced transaction enforcement.
 * Designed for Indiana-style municipal fund accounting.
 */
export interface FinanceService {
  // ===========================================================================
  // FUND OPERATIONS
  // ===========================================================================

  /**
   * Create a new fund.
   *
   * @param ctx - Tenant context
   * @param input - Fund creation input
   * @returns The created fund
   */
  createFund(ctx: TenantContext, input: CreateFundInput): Promise<Fund>;

  /**
   * Get a fund by ID.
   *
   * @param ctx - Tenant context
   * @param id - Fund ID
   * @returns The fund, or null if not found
   */
  getFund(ctx: TenantContext, id: string): Promise<Fund | null>;

  /**
   * List all funds for the tenant.
   *
   * @param ctx - Tenant context
   * @returns Array of funds
   */
  listFunds(ctx: TenantContext): Promise<Fund[]>;

  /**
   * Update an existing fund.
   *
   * @param ctx - Tenant context
   * @param id - Fund ID
   * @param input - Update input
   * @returns The updated fund
   * @throws If fund not found
   */
  updateFund(ctx: TenantContext, id: string, input: UpdateFundInput): Promise<Fund>;

  // ===========================================================================
  // ACCOUNT OPERATIONS
  // ===========================================================================

  /**
   * Create a new account.
   *
   * @param ctx - Tenant context
   * @param input - Account creation input
   * @returns The created account
   */
  createAccount(ctx: TenantContext, input: CreateAccountInput): Promise<Account>;

  /**
   * Get an account by ID.
   *
   * @param ctx - Tenant context
   * @param id - Account ID
   * @returns The account, or null if not found
   */
  getAccount(ctx: TenantContext, id: string): Promise<Account | null>;

  /**
   * List accounts for the tenant with optional filtering.
   *
   * @param ctx - Tenant context
   * @param filter - Optional filter criteria
   * @returns Array of accounts
   */
  listAccounts(ctx: TenantContext, filter?: AccountFilter): Promise<Account[]>;

  /**
   * Update an existing account.
   *
   * @param ctx - Tenant context
   * @param id - Account ID
   * @param input - Update input
   * @returns The updated account
   * @throws If account not found
   */
  updateAccount(ctx: TenantContext, id: string, input: UpdateAccountInput): Promise<Account>;

  // ===========================================================================
  // TRANSACTION OPERATIONS
  // ===========================================================================

  /**
   * Create a new transaction.
   *
   * Validates that:
   * - All fundId and accountId references exist for the tenant
   * - Lines is not empty
   * - Total debits equal total credits (transaction is balanced)
   *
   * @param ctx - Tenant context
   * @param input - Transaction creation input
   * @returns The created transaction
   * @throws If validation fails (unbalanced, invalid references, etc.)
   */
  createTransaction(ctx: TenantContext, input: CreateTransactionInput): Promise<FinanceTransaction>;

  /**
   * Get a transaction by ID.
   *
   * @param ctx - Tenant context
   * @param id - Transaction ID
   * @returns The transaction with lines, or null if not found
   */
  getTransaction(ctx: TenantContext, id: string): Promise<FinanceTransaction | null>;

  /**
   * List transactions for the tenant with optional filtering.
   *
   * @param ctx - Tenant context
   * @param filter - Optional filter criteria
   * @returns Array of transactions with lines
   */
  listTransactions(ctx: TenantContext, filter?: TransactionFilter): Promise<FinanceTransaction[]>;

  // ===========================================================================
  // APPROPRIATION OPERATIONS
  // ===========================================================================

  /**
   * Create a new appropriation.
   *
   * @param ctx - Tenant context
   * @param input - Appropriation creation input
   * @returns The created appropriation
   */
  createAppropriation(ctx: TenantContext, input: CreateAppropriationInput): Promise<Appropriation>;

  /**
   * Get an appropriation by ID.
   *
   * @param ctx - Tenant context
   * @param id - Appropriation ID
   * @returns The appropriation, or null if not found
   */
  getAppropriation(ctx: TenantContext, id: string): Promise<Appropriation | null>;

  /**
   * List appropriations for the tenant with optional filtering.
   *
   * @param ctx - Tenant context
   * @param filter - Optional filter criteria
   * @returns Array of appropriations
   */
  listAppropriations(ctx: TenantContext, filter?: AppropriationFilter): Promise<Appropriation[]>;

  /**
   * Update an existing appropriation.
   *
   * @param ctx - Tenant context
   * @param id - Appropriation ID
   * @param input - Update input
   * @returns The updated appropriation
   * @throws If appropriation not found
   */
  updateAppropriation(
    ctx: TenantContext,
    id: string,
    input: UpdateAppropriationInput
  ): Promise<Appropriation>;

  // ===========================================================================
  // SUMMARY OPERATIONS
  // ===========================================================================

  /**
   * Get fund balance summary as of a specific date.
   *
   * Calculates the cash balance by walking all transactions up to asOfDate.
   *
   * For cash balance calculation:
   * - For CASH accounts: debits increase balance, credits decrease balance
   * - Receipts: debit CASH (increase), credit REVENUE
   * - Disbursements: credit CASH (decrease), debit EXPENDITURE
   *
   * @param ctx - Tenant context
   * @param fundId - Fund ID
   * @param asOfDate - As-of date (ISO 8601)
   * @returns Fund balance summary
   * @throws If fund not found
   */
  getFundBalanceSummary(
    ctx: TenantContext,
    fundId: string,
    asOfDate: string
  ): Promise<FundBalanceSummary>;

  /**
   * Get appropriation usage summary.
   *
   * Calculates:
   * - expendedCents: sum of expenditure lines referencing this appropriation
   * - encumberedCents: (placeholder, currently 0)
   * - availableCents: adopted + additional - reductions - expended - encumbered
   *
   * @param ctx - Tenant context
   * @param appropriationId - Appropriation ID
   * @returns Appropriation usage summary
   * @throws If appropriation not found
   */
  getAppropriationUsageSummary(
    ctx: TenantContext,
    appropriationId: string
  ): Promise<AppropriationUsageSummary>;
}
