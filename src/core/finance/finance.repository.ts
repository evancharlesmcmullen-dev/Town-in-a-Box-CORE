// src/core/finance/finance.repository.ts

/**
 * Town-in-a-Box Finance Engine - Repository Interface
 *
 * Defines the contract for finance data persistence. Implementations
 * may use various storage backends (in-memory, PostgreSQL, etc.).
 *
 * All methods are tenant-scoped - the repository implementation should
 * ensure proper tenant isolation.
 */

import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  TransactionType,
  TransactionStatus,
  DebtInstrument,
  DebtServiceSchedule,
  FiscalEntity,
  Vendor,
  BankAccount,
  Reconciliation,
  ImportBatch,
  FiscalPeriod,
  FundBalanceClassification,
  FundSummary,
  TransactionSummary,
  BudgetStatus,
} from './finance.types';

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Filter options for querying funds.
 */
export interface FundFilter {
  tenantId?: string;
  fiscalEntityId?: string;
  codes?: string[];
  types?: Fund['type'][];
  categories?: string[];
  activeOnly?: boolean;
  restrictedOnly?: boolean;
  searchTerm?: string;       // Name/code search
}

/**
 * Filter options for querying accounts.
 */
export interface AccountFilter {
  tenantId?: string;
  fundId?: string;
  fundIds?: string[];
  types?: Account['type'][];
  activeOnly?: boolean;
  postableOnly?: boolean;
  searchTerm?: string;
  parentAccountId?: string;
  level?: number;
}

/**
 * Filter options for querying budget lines.
 */
export interface BudgetLineFilter {
  tenantId?: string;
  fundId?: string;
  fundIds?: string[];
  accountId?: string;
  fiscalYear?: number;
  fiscalYears?: number[];
  status?: BudgetStatus;
  lineType?: 'REVENUE' | 'APPROPRIATION' | 'TRANSFER';
}

/**
 * Filter options for querying transactions.
 */
export interface TransactionFilter {
  tenantId?: string;
  fundId?: string;
  fundIds?: string[];
  accountId?: string;
  accountIds?: string[];
  types?: TransactionType[];
  statuses?: TransactionStatus[];
  fromDate?: Date | string;
  toDate?: Date | string;
  minAmount?: number;
  maxAmount?: number;
  vendorId?: string;
  checkNumber?: string;
  importBatchId?: string;
  searchTerm?: string;       // Description search
  includeVoided?: boolean;
}

/**
 * Filter options for querying debt instruments.
 */
export interface DebtInstrumentFilter {
  tenantId?: string;
  types?: DebtInstrument['type'][];
  activeOnly?: boolean;
  pledgedFundId?: string;
  maturityBefore?: Date;
  maturityAfter?: Date;
}

/**
 * Filter options for querying vendors.
 */
export interface VendorFilter {
  tenantId?: string;
  activeOnly?: boolean;
  requires1099?: boolean;
  searchTerm?: string;
}

/**
 * Pagination options.
 */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

/**
 * Finance Repository Interface
 *
 * Provides CRUD operations and queries for all finance entities.
 * All operations are async to support various storage backends.
 */
export interface FinanceRepository {
  // ==========================================================================
  // FUND OPERATIONS
  // ==========================================================================

  /**
   * List funds matching the filter criteria.
   */
  listFunds(filter?: FundFilter, pagination?: PaginationOptions): Promise<Fund[] | PaginatedResult<Fund>>;

  /**
   * Get a single fund by ID.
   */
  getFundById(id: string): Promise<Fund | null>;

  /**
   * Get a fund by code within a tenant.
   */
  getFundByCode(tenantId: string, code: string): Promise<Fund | null>;

  /**
   * Save (create or update) a fund.
   */
  saveFund(fund: Fund): Promise<Fund>;

  /**
   * Delete a fund (soft delete recommended).
   */
  deleteFund(id: string): Promise<boolean>;

  // ==========================================================================
  // ACCOUNT OPERATIONS
  // ==========================================================================

  /**
   * List accounts matching the filter criteria.
   */
  listAccounts(filter?: AccountFilter, pagination?: PaginationOptions): Promise<Account[] | PaginatedResult<Account>>;

  /**
   * Get accounts for a specific fund.
   */
  listAccountsForFund(fundId: string): Promise<Account[]>;

  /**
   * Get a single account by ID.
   */
  getAccountById(id: string): Promise<Account | null>;

  /**
   * Get an account by code within a fund.
   */
  getAccountByCode(fundId: string, code: string): Promise<Account | null>;

  /**
   * Save (create or update) an account.
   */
  saveAccount(account: Account): Promise<Account>;

  /**
   * Delete an account.
   */
  deleteAccount(id: string): Promise<boolean>;

  // ==========================================================================
  // BUDGET LINE OPERATIONS
  // ==========================================================================

  /**
   * List budget lines matching the filter criteria.
   */
  listBudgetLines(filter?: BudgetLineFilter, pagination?: PaginationOptions): Promise<BudgetLine[] | PaginatedResult<BudgetLine>>;

  /**
   * Get budget lines for a specific fiscal year.
   */
  listBudgetLinesForYear(tenantId: string, fiscalYear: number): Promise<BudgetLine[]>;

  /**
   * Get a single budget line by ID.
   */
  getBudgetLineById(id: string): Promise<BudgetLine | null>;

  /**
   * Save (create or update) a budget line.
   */
  saveBudgetLine(budgetLine: BudgetLine): Promise<BudgetLine>;

  /**
   * Batch save budget lines.
   */
  saveBudgetLines(budgetLines: BudgetLine[]): Promise<BudgetLine[]>;

  /**
   * Delete a budget line.
   */
  deleteBudgetLine(id: string): Promise<boolean>;

  // ==========================================================================
  // TRANSACTION OPERATIONS
  // ==========================================================================

  /**
   * List transactions matching the filter criteria.
   */
  listTransactions(filter?: TransactionFilter, pagination?: PaginationOptions): Promise<Transaction[] | PaginatedResult<Transaction>>;

  /**
   * Get a single transaction by ID.
   */
  getTransactionById(id: string): Promise<Transaction | null>;

  /**
   * Save (create or update) a transaction.
   */
  saveTransaction(transaction: Transaction): Promise<Transaction>;

  /**
   * Batch save transactions (for imports).
   */
  saveTransactions(transactions: Transaction[]): Promise<Transaction[]>;

  /**
   * Void a transaction (sets status to VOIDED).
   */
  voidTransaction(id: string, reason: string, voidedBy: string): Promise<Transaction | null>;

  /**
   * Get transaction totals by type for a period.
   */
  getTransactionSummary(
    tenantId: string,
    fundId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<TransactionSummary>;

  // ==========================================================================
  // DEBT INSTRUMENT OPERATIONS
  // ==========================================================================

  /**
   * List debt instruments matching the filter criteria.
   */
  listDebtInstruments(filter?: DebtInstrumentFilter, pagination?: PaginationOptions): Promise<DebtInstrument[] | PaginatedResult<DebtInstrument>>;

  /**
   * Get a single debt instrument by ID.
   */
  getDebtInstrumentById(id: string): Promise<DebtInstrument | null>;

  /**
   * Save (create or update) a debt instrument.
   */
  saveDebtInstrument(instrument: DebtInstrument): Promise<DebtInstrument>;

  /**
   * Delete a debt instrument.
   */
  deleteDebtInstrument(id: string): Promise<boolean>;

  // ==========================================================================
  // DEBT SERVICE SCHEDULE OPERATIONS
  // ==========================================================================

  /**
   * Get the payment schedule for a debt instrument.
   */
  getDebtServiceSchedule(instrumentId: string): Promise<DebtServiceSchedule[]>;

  /**
   * Save a debt service schedule entry.
   */
  saveDebtServiceSchedule(schedule: DebtServiceSchedule): Promise<DebtServiceSchedule>;

  /**
   * Batch save debt service schedule.
   */
  saveDebtServiceSchedules(schedules: DebtServiceSchedule[]): Promise<DebtServiceSchedule[]>;

  /**
   * Mark a payment as paid.
   */
  markDebtPaymentPaid(scheduleId: string, paidDate: Date, transactionId: string): Promise<DebtServiceSchedule | null>;

  // ==========================================================================
  // FISCAL ENTITY OPERATIONS
  // ==========================================================================

  /**
   * List fiscal entities for a tenant.
   */
  listFiscalEntities(tenantId: string): Promise<FiscalEntity[]>;

  /**
   * Get a fiscal entity by ID.
   */
  getFiscalEntityById(id: string): Promise<FiscalEntity | null>;

  /**
   * Save a fiscal entity.
   */
  saveFiscalEntity(entity: FiscalEntity): Promise<FiscalEntity>;

  // ==========================================================================
  // VENDOR OPERATIONS
  // ==========================================================================

  /**
   * List vendors matching the filter criteria.
   */
  listVendors(filter?: VendorFilter, pagination?: PaginationOptions): Promise<Vendor[] | PaginatedResult<Vendor>>;

  /**
   * Get a vendor by ID.
   */
  getVendorById(id: string): Promise<Vendor | null>;

  /**
   * Save a vendor.
   */
  saveVendor(vendor: Vendor): Promise<Vendor>;

  /**
   * Delete a vendor.
   */
  deleteVendor(id: string): Promise<boolean>;

  // ==========================================================================
  // BANK ACCOUNT & RECONCILIATION
  // ==========================================================================

  /**
   * List bank accounts for a tenant.
   */
  listBankAccounts(tenantId: string): Promise<BankAccount[]>;

  /**
   * Get a bank account by ID.
   */
  getBankAccountById(id: string): Promise<BankAccount | null>;

  /**
   * Save a bank account.
   */
  saveBankAccount(account: BankAccount): Promise<BankAccount>;

  /**
   * List reconciliations for a bank account.
   */
  listReconciliations(bankAccountId: string): Promise<Reconciliation[]>;

  /**
   * Get a reconciliation by ID.
   */
  getReconciliationById(id: string): Promise<Reconciliation | null>;

  /**
   * Save a reconciliation.
   */
  saveReconciliation(reconciliation: Reconciliation): Promise<Reconciliation>;

  // ==========================================================================
  // IMPORT BATCH OPERATIONS
  // ==========================================================================

  /**
   * List import batches for a tenant.
   */
  listImportBatches(tenantId: string, limit?: number): Promise<ImportBatch[]>;

  /**
   * Get an import batch by ID.
   */
  getImportBatchById(id: string): Promise<ImportBatch | null>;

  /**
   * Save an import batch.
   */
  saveImportBatch(batch: ImportBatch): Promise<ImportBatch>;

  // ==========================================================================
  // FISCAL PERIOD OPERATIONS
  // ==========================================================================

  /**
   * List fiscal periods for a tenant.
   */
  listFiscalPeriods(tenantId: string, fiscalYear?: number): Promise<FiscalPeriod[]>;

  /**
   * Get a fiscal period by ID or date.
   */
  getFiscalPeriod(tenantId: string, date: Date): Promise<FiscalPeriod | null>;

  /**
   * Save a fiscal period.
   */
  saveFiscalPeriod(period: FiscalPeriod): Promise<FiscalPeriod>;

  /**
   * Close a fiscal period.
   */
  closeFiscalPeriod(tenantId: string, fiscalYear: number, period: number, closedBy: string): Promise<FiscalPeriod | null>;

  // ==========================================================================
  // FUND BALANCE CLASSIFICATION
  // ==========================================================================

  /**
   * Get fund balance classification for a fund and year.
   */
  getFundBalanceClassification(fundId: string, fiscalYear: number): Promise<FundBalanceClassification | null>;

  /**
   * Save fund balance classification.
   */
  saveFundBalanceClassification(classification: FundBalanceClassification): Promise<FundBalanceClassification>;

  // ==========================================================================
  // REPORTING HELPERS
  // ==========================================================================

  /**
   * Get fund summary for reporting.
   */
  getFundSummary(
    fundId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<FundSummary | null>;

  /**
   * Get all fund summaries for a tenant.
   */
  getAllFundSummaries(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<FundSummary[]>;

  /**
   * Calculate fund balances from transactions.
   */
  calculateFundBalance(fundId: string, asOfDate: Date): Promise<number>;

  // Allow additional methods for extensibility
  [key: string]: unknown;
}

// Re-export types for convenience
export type {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  TransactionType,
  TransactionStatus,
  DebtInstrument,
  DebtServiceSchedule,
  FiscalEntity,
  Vendor,
  BankAccount,
  Reconciliation,
  ImportBatch,
  FiscalPeriod,
  FundBalanceClassification,
  FundSummary,
  TransactionSummary,
};
