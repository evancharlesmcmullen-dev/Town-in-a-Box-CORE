// src/core/finance/in-memory-finance.repository.ts

/**
 * Town-in-a-Box Finance Engine - In-Memory Repository
 *
 * Reference implementation of FinanceRepository for development, testing,
 * and demonstration purposes.
 *
 * This implementation:
 * - Stores all data in memory (no persistence)
 * - Supports all repository operations
 * - Provides a foundation for real database implementations
 */

import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  TransactionType,
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
} from './finance.types';

import {
  FinanceRepository,
  FundFilter,
  AccountFilter,
  BudgetLineFilter,
  TransactionFilter,
  DebtInstrumentFilter,
  VendorFilter,
  PaginationOptions,
  PaginatedResult,
} from './finance.repository';

// ============================================================================
// SEED DATA INTERFACE
// ============================================================================

/**
 * Optional seed data to bootstrap the in-memory repository.
 */
export interface InMemoryFinanceSeedData {
  funds?: Fund[];
  accounts?: Account[];
  budgetLines?: BudgetLine[];
  transactions?: Transaction[];
  debtInstruments?: DebtInstrument[];
  debtServiceSchedules?: DebtServiceSchedule[];
  fiscalEntities?: FiscalEntity[];
  vendors?: Vendor[];
  bankAccounts?: BankAccount[];
  reconciliations?: Reconciliation[];
  importBatches?: ImportBatch[];
  fiscalPeriods?: FiscalPeriod[];
  fundBalanceClassifications?: FundBalanceClassification[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize date for comparison.
 */
function normalizeDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  return typeof date === 'string' ? new Date(date) : date;
}

/**
 * Check if a date is within a range.
 */
function isDateInRange(
  date: Date | string | undefined,
  from: Date | string | undefined,
  to: Date | string | undefined
): boolean {
  if (!date) return true;
  const d = normalizeDate(date)!;
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);

  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

/**
 * Simple text search match.
 */
function matchesSearch(text: string | undefined, searchTerm: string): boolean {
  if (!text || !searchTerm) return true;
  return text.toLowerCase().includes(searchTerm.toLowerCase());
}

/**
 * Apply pagination to results.
 */
function paginate<T>(
  items: T[],
  pagination?: PaginationOptions
): T[] | PaginatedResult<T> {
  if (!pagination) return items;

  const { offset = 0, limit, sortBy, sortOrder = 'ASC' } = pagination;

  // Sort if requested
  let sorted = [...items];
  if (sortBy) {
    sorted.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortBy];
      const bVal = (b as Record<string, unknown>)[sortBy];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const cmp = aVal < bVal ? -1 : 1;
      return sortOrder === 'ASC' ? cmp : -cmp;
    });
  }

  // Apply pagination
  if (limit !== undefined) {
    const paginatedItems = sorted.slice(offset, offset + limit);
    return {
      items: paginatedItems,
      total: items.length,
      offset,
      limit,
      hasMore: offset + limit < items.length,
    };
  }

  return sorted.slice(offset);
}

// ============================================================================
// IN-MEMORY REPOSITORY IMPLEMENTATION
// ============================================================================

/**
 * In-memory implementation of FinanceRepository.
 *
 * Suitable for:
 * - Unit testing
 * - Integration testing
 * - Development without a database
 * - Demonstration and prototyping
 */
export class InMemoryFinanceRepository implements FinanceRepository {
  private funds: Fund[];
  private accounts: Account[];
  private budgetLines: BudgetLine[];
  private transactions: Transaction[];
  private debtInstruments: DebtInstrument[];
  private debtServiceSchedules: DebtServiceSchedule[];
  private fiscalEntities: FiscalEntity[];
  private vendors: Vendor[];
  private bankAccounts: BankAccount[];
  private reconciliations: Reconciliation[];
  private importBatches: ImportBatch[];
  private fiscalPeriods: FiscalPeriod[];
  private fundBalanceClassifications: FundBalanceClassification[];

  constructor(seed: InMemoryFinanceSeedData = {}) {
    this.funds = seed.funds ? [...seed.funds] : [];
    this.accounts = seed.accounts ? [...seed.accounts] : [];
    this.budgetLines = seed.budgetLines ? [...seed.budgetLines] : [];
    this.transactions = seed.transactions ? [...seed.transactions] : [];
    this.debtInstruments = seed.debtInstruments ? [...seed.debtInstruments] : [];
    this.debtServiceSchedules = seed.debtServiceSchedules ? [...seed.debtServiceSchedules] : [];
    this.fiscalEntities = seed.fiscalEntities ? [...seed.fiscalEntities] : [];
    this.vendors = seed.vendors ? [...seed.vendors] : [];
    this.bankAccounts = seed.bankAccounts ? [...seed.bankAccounts] : [];
    this.reconciliations = seed.reconciliations ? [...seed.reconciliations] : [];
    this.importBatches = seed.importBatches ? [...seed.importBatches] : [];
    this.fiscalPeriods = seed.fiscalPeriods ? [...seed.fiscalPeriods] : [];
    this.fundBalanceClassifications = seed.fundBalanceClassifications ? [...seed.fundBalanceClassifications] : [];
  }

  // ==========================================================================
  // FUND OPERATIONS
  // ==========================================================================

  async listFunds(
    filter?: FundFilter,
    pagination?: PaginationOptions
  ): Promise<Fund[] | PaginatedResult<Fund>> {
    let results = [...this.funds];

    if (filter) {
      if (filter.tenantId) {
        results = results.filter((f) => f.tenantId === filter.tenantId);
      }
      if (filter.fiscalEntityId) {
        results = results.filter((f) => f.fiscalEntityId === filter.fiscalEntityId);
      }
      if (filter.codes && filter.codes.length > 0) {
        const codeSet = new Set(filter.codes);
        results = results.filter((f) => codeSet.has(f.code));
      }
      if (filter.types && filter.types.length > 0) {
        const typeSet = new Set(filter.types);
        results = results.filter((f) => typeSet.has(f.type));
      }
      if (filter.categories && filter.categories.length > 0) {
        const catSet = new Set(filter.categories);
        results = results.filter((f) => f.category && catSet.has(f.category));
      }
      if (filter.activeOnly) {
        results = results.filter((f) => f.isActive);
      }
      if (filter.restrictedOnly) {
        results = results.filter((f) => f.isRestricted);
      }
      if (filter.searchTerm) {
        results = results.filter(
          (f) =>
            matchesSearch(f.name, filter.searchTerm!) ||
            matchesSearch(f.code, filter.searchTerm!)
        );
      }
    }

    return paginate(results, pagination);
  }

  async getFundById(id: string): Promise<Fund | null> {
    return this.funds.find((f) => f.id === id) ?? null;
  }

  async getFundByCode(tenantId: string, code: string): Promise<Fund | null> {
    return (
      this.funds.find((f) => f.tenantId === tenantId && f.code === code) ?? null
    );
  }

  async saveFund(fund: Fund): Promise<Fund> {
    const existingIndex = this.funds.findIndex((f) => f.id === fund.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.funds[existingIndex] = { ...fund, updatedAt: now };
      return this.funds[existingIndex];
    } else {
      const newFund = { ...fund, createdAt: now, updatedAt: now };
      this.funds.push(newFund);
      return newFund;
    }
  }

  async deleteFund(id: string): Promise<boolean> {
    const index = this.funds.findIndex((f) => f.id === id);
    if (index >= 0) {
      this.funds.splice(index, 1);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // ACCOUNT OPERATIONS
  // ==========================================================================

  async listAccounts(
    filter?: AccountFilter,
    pagination?: PaginationOptions
  ): Promise<Account[] | PaginatedResult<Account>> {
    let results = [...this.accounts];

    if (filter) {
      if (filter.tenantId) {
        results = results.filter((a) => a.tenantId === filter.tenantId);
      }
      if (filter.fundId) {
        results = results.filter((a) => a.fundId === filter.fundId);
      }
      if (filter.fundIds && filter.fundIds.length > 0) {
        const fundSet = new Set(filter.fundIds);
        results = results.filter((a) => fundSet.has(a.fundId));
      }
      if (filter.types && filter.types.length > 0) {
        const typeSet = new Set(filter.types);
        results = results.filter((a) => typeSet.has(a.type));
      }
      if (filter.activeOnly) {
        results = results.filter((a) => a.isActive);
      }
      if (filter.postableOnly) {
        results = results.filter((a) => a.isPostable);
      }
      if (filter.parentAccountId !== undefined) {
        results = results.filter((a) => a.parentAccountId === filter.parentAccountId);
      }
      if (filter.level !== undefined) {
        results = results.filter((a) => a.level === filter.level);
      }
      if (filter.searchTerm) {
        results = results.filter(
          (a) =>
            matchesSearch(a.name, filter.searchTerm!) ||
            matchesSearch(a.code, filter.searchTerm!)
        );
      }
    }

    return paginate(results, pagination);
  }

  async listAccountsForFund(fundId: string): Promise<Account[]> {
    return this.accounts.filter((a) => a.fundId === fundId);
  }

  async getAccountById(id: string): Promise<Account | null> {
    return this.accounts.find((a) => a.id === id) ?? null;
  }

  async getAccountByCode(fundId: string, code: string): Promise<Account | null> {
    return (
      this.accounts.find((a) => a.fundId === fundId && a.code === code) ?? null
    );
  }

  async saveAccount(account: Account): Promise<Account> {
    const existingIndex = this.accounts.findIndex((a) => a.id === account.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.accounts[existingIndex] = { ...account, updatedAt: now };
      return this.accounts[existingIndex];
    } else {
      const newAccount = { ...account, createdAt: now, updatedAt: now };
      this.accounts.push(newAccount);
      return newAccount;
    }
  }

  async deleteAccount(id: string): Promise<boolean> {
    const index = this.accounts.findIndex((a) => a.id === id);
    if (index >= 0) {
      this.accounts.splice(index, 1);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // BUDGET LINE OPERATIONS
  // ==========================================================================

  async listBudgetLines(
    filter?: BudgetLineFilter,
    pagination?: PaginationOptions
  ): Promise<BudgetLine[] | PaginatedResult<BudgetLine>> {
    let results = [...this.budgetLines];

    if (filter) {
      if (filter.tenantId) {
        results = results.filter((b) => b.tenantId === filter.tenantId);
      }
      if (filter.fundId) {
        results = results.filter((b) => b.fundId === filter.fundId);
      }
      if (filter.fundIds && filter.fundIds.length > 0) {
        const fundSet = new Set(filter.fundIds);
        results = results.filter((b) => fundSet.has(b.fundId));
      }
      if (filter.accountId) {
        results = results.filter((b) => b.accountId === filter.accountId);
      }
      if (filter.fiscalYear !== undefined) {
        results = results.filter((b) => b.fiscalYear === filter.fiscalYear);
      }
      if (filter.fiscalYears && filter.fiscalYears.length > 0) {
        const yearSet = new Set(filter.fiscalYears);
        results = results.filter((b) => yearSet.has(b.fiscalYear));
      }
      if (filter.status) {
        results = results.filter((b) => b.status === filter.status);
      }
      if (filter.lineType) {
        results = results.filter((b) => b.lineType === filter.lineType);
      }
    }

    return paginate(results, pagination);
  }

  async listBudgetLinesForYear(
    tenantId: string,
    fiscalYear: number
  ): Promise<BudgetLine[]> {
    return this.budgetLines.filter(
      (b) => b.tenantId === tenantId && b.fiscalYear === fiscalYear
    );
  }

  async getBudgetLineById(id: string): Promise<BudgetLine | null> {
    return this.budgetLines.find((b) => b.id === id) ?? null;
  }

  async saveBudgetLine(budgetLine: BudgetLine): Promise<BudgetLine> {
    const existingIndex = this.budgetLines.findIndex((b) => b.id === budgetLine.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.budgetLines[existingIndex] = { ...budgetLine, updatedAt: now };
      return this.budgetLines[existingIndex];
    } else {
      const newLine = { ...budgetLine, createdAt: now, updatedAt: now };
      this.budgetLines.push(newLine);
      return newLine;
    }
  }

  async saveBudgetLines(budgetLines: BudgetLine[]): Promise<BudgetLine[]> {
    return Promise.all(budgetLines.map((bl) => this.saveBudgetLine(bl)));
  }

  async deleteBudgetLine(id: string): Promise<boolean> {
    const index = this.budgetLines.findIndex((b) => b.id === id);
    if (index >= 0) {
      this.budgetLines.splice(index, 1);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // TRANSACTION OPERATIONS
  // ==========================================================================

  async listTransactions(
    filter?: TransactionFilter,
    pagination?: PaginationOptions
  ): Promise<Transaction[] | PaginatedResult<Transaction>> {
    let results = [...this.transactions];

    if (filter) {
      if (filter.tenantId) {
        results = results.filter((t) => t.tenantId === filter.tenantId);
      }
      if (filter.fundId) {
        results = results.filter((t) => t.fundId === filter.fundId);
      }
      if (filter.fundIds && filter.fundIds.length > 0) {
        const fundSet = new Set(filter.fundIds);
        results = results.filter((t) => fundSet.has(t.fundId));
      }
      if (filter.accountId) {
        results = results.filter((t) => t.accountId === filter.accountId);
      }
      if (filter.accountIds && filter.accountIds.length > 0) {
        const acctSet = new Set(filter.accountIds);
        results = results.filter((t) => t.accountId && acctSet.has(t.accountId));
      }
      if (filter.types && filter.types.length > 0) {
        const typeSet = new Set<TransactionType>(filter.types);
        results = results.filter((t) => typeSet.has(t.type));
      }
      if (filter.statuses && filter.statuses.length > 0) {
        const statusSet = new Set(filter.statuses);
        results = results.filter((t) => statusSet.has(t.status));
      }
      if (filter.fromDate || filter.toDate) {
        results = results.filter((t) =>
          isDateInRange(t.transactionDate, filter.fromDate, filter.toDate)
        );
      }
      if (filter.minAmount !== undefined) {
        results = results.filter((t) => t.amount >= filter.minAmount!);
      }
      if (filter.maxAmount !== undefined) {
        results = results.filter((t) => t.amount <= filter.maxAmount!);
      }
      if (filter.vendorId) {
        results = results.filter((t) => t.vendorId === filter.vendorId);
      }
      if (filter.checkNumber) {
        results = results.filter((t) => t.checkNumber === filter.checkNumber);
      }
      if (filter.importBatchId) {
        results = results.filter((t) => t.importBatchId === filter.importBatchId);
      }
      if (filter.searchTerm) {
        results = results.filter((t) =>
          matchesSearch(t.description, filter.searchTerm!)
        );
      }
      if (!filter.includeVoided) {
        results = results.filter((t) => t.status !== 'VOIDED');
      }
    }

    return paginate(results, pagination);
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    return this.transactions.find((t) => t.id === id) ?? null;
  }

  async saveTransaction(transaction: Transaction): Promise<Transaction> {
    const existingIndex = this.transactions.findIndex((t) => t.id === transaction.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.transactions[existingIndex] = { ...transaction, updatedAt: now };
      return this.transactions[existingIndex];
    } else {
      const newTx = { ...transaction, createdAt: now, updatedAt: now };
      this.transactions.push(newTx);
      return newTx;
    }
  }

  async saveTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    return Promise.all(transactions.map((tx) => this.saveTransaction(tx)));
  }

  async voidTransaction(
    id: string,
    reason: string,
    voidedBy: string
  ): Promise<Transaction | null> {
    const tx = await this.getTransactionById(id);
    if (!tx) return null;

    tx.status = 'VOIDED';
    tx.memo = `${tx.memo ? tx.memo + ' | ' : ''}VOIDED: ${reason} by ${voidedBy}`;
    tx.updatedAt = new Date();

    return tx;
  }

  async getTransactionSummary(
    tenantId: string,
    fundId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<TransactionSummary> {
    const txs = this.transactions.filter(
      (t) =>
        t.tenantId === tenantId &&
        t.fundId === fundId &&
        t.status !== 'VOIDED' &&
        isDateInRange(t.transactionDate, periodStart, periodEnd)
    );

    const summary: TransactionSummary = {
      fundId,
      periodStart,
      periodEnd,
      receiptCount: 0,
      receiptTotal: 0,
      disbursementCount: 0,
      disbursementTotal: 0,
      transferInCount: 0,
      transferInTotal: 0,
      transferOutCount: 0,
      transferOutTotal: 0,
      adjustmentCount: 0,
      adjustmentTotal: 0,
      netChange: 0,
    };

    for (const tx of txs) {
      switch (tx.type) {
        case 'RECEIPT':
          summary.receiptCount++;
          summary.receiptTotal += tx.amount;
          break;
        case 'DISBURSEMENT':
          summary.disbursementCount++;
          summary.disbursementTotal += tx.amount;
          break;
        case 'TRANSFER':
          // Check if this is transfer in or out based on context
          // For simplicity, positive = in, negative = out
          if (tx.amount >= 0) {
            summary.transferInCount++;
            summary.transferInTotal += tx.amount;
          } else {
            summary.transferOutCount++;
            summary.transferOutTotal += Math.abs(tx.amount);
          }
          break;
        case 'ADJUSTMENT':
        case 'ENCUMBRANCE':
        case 'LIQUIDATION':
          summary.adjustmentCount++;
          summary.adjustmentTotal += tx.amount;
          break;
      }
    }

    summary.netChange =
      summary.receiptTotal +
      summary.transferInTotal -
      summary.disbursementTotal -
      summary.transferOutTotal +
      summary.adjustmentTotal;

    return summary;
  }

  // ==========================================================================
  // DEBT INSTRUMENT OPERATIONS
  // ==========================================================================

  async listDebtInstruments(
    filter?: DebtInstrumentFilter,
    pagination?: PaginationOptions
  ): Promise<DebtInstrument[] | PaginatedResult<DebtInstrument>> {
    let results = [...this.debtInstruments];

    if (filter) {
      if (filter.tenantId) {
        results = results.filter((d) => d.tenantId === filter.tenantId);
      }
      if (filter.types && filter.types.length > 0) {
        const typeSet = new Set(filter.types);
        results = results.filter((d) => typeSet.has(d.type));
      }
      if (filter.activeOnly) {
        results = results.filter((d) => d.isActive);
      }
      if (filter.pledgedFundId) {
        results = results.filter(
          (d) => d.pledgedFundIds?.includes(filter.pledgedFundId!)
        );
      }
      if (filter.maturityBefore) {
        results = results.filter((d) => d.maturityDate <= filter.maturityBefore!);
      }
      if (filter.maturityAfter) {
        results = results.filter((d) => d.maturityDate >= filter.maturityAfter!);
      }
    }

    return paginate(results, pagination);
  }

  async getDebtInstrumentById(id: string): Promise<DebtInstrument | null> {
    return this.debtInstruments.find((d) => d.id === id) ?? null;
  }

  async saveDebtInstrument(instrument: DebtInstrument): Promise<DebtInstrument> {
    const existingIndex = this.debtInstruments.findIndex((d) => d.id === instrument.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.debtInstruments[existingIndex] = { ...instrument, updatedAt: now };
      return this.debtInstruments[existingIndex];
    } else {
      const newInst = { ...instrument, createdAt: now, updatedAt: now };
      this.debtInstruments.push(newInst);
      return newInst;
    }
  }

  async deleteDebtInstrument(id: string): Promise<boolean> {
    const index = this.debtInstruments.findIndex((d) => d.id === id);
    if (index >= 0) {
      this.debtInstruments.splice(index, 1);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // DEBT SERVICE SCHEDULE OPERATIONS
  // ==========================================================================

  async getDebtServiceSchedule(instrumentId: string): Promise<DebtServiceSchedule[]> {
    return this.debtServiceSchedules
      .filter((s) => s.instrumentId === instrumentId)
      .sort((a, b) => a.paymentNumber - b.paymentNumber);
  }

  async saveDebtServiceSchedule(
    schedule: DebtServiceSchedule
  ): Promise<DebtServiceSchedule> {
    const existingIndex = this.debtServiceSchedules.findIndex(
      (s) => s.id === schedule.id
    );

    if (existingIndex >= 0) {
      this.debtServiceSchedules[existingIndex] = schedule;
      return this.debtServiceSchedules[existingIndex];
    } else {
      this.debtServiceSchedules.push(schedule);
      return schedule;
    }
  }

  async saveDebtServiceSchedules(
    schedules: DebtServiceSchedule[]
  ): Promise<DebtServiceSchedule[]> {
    return Promise.all(schedules.map((s) => this.saveDebtServiceSchedule(s)));
  }

  async markDebtPaymentPaid(
    scheduleId: string,
    paidDate: Date,
    transactionId: string
  ): Promise<DebtServiceSchedule | null> {
    const schedule = this.debtServiceSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;

    schedule.isPaid = true;
    schedule.paidDate = paidDate;
    schedule.paidTransactionId = transactionId;

    return schedule;
  }

  // ==========================================================================
  // FISCAL ENTITY OPERATIONS
  // ==========================================================================

  async listFiscalEntities(tenantId: string): Promise<FiscalEntity[]> {
    return this.fiscalEntities.filter((e) => e.tenantId === tenantId);
  }

  async getFiscalEntityById(id: string): Promise<FiscalEntity | null> {
    return this.fiscalEntities.find((e) => e.id === id) ?? null;
  }

  async saveFiscalEntity(entity: FiscalEntity): Promise<FiscalEntity> {
    const existingIndex = this.fiscalEntities.findIndex((e) => e.id === entity.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.fiscalEntities[existingIndex] = { ...entity, updatedAt: now };
      return this.fiscalEntities[existingIndex];
    } else {
      const newEntity = { ...entity, createdAt: now, updatedAt: now };
      this.fiscalEntities.push(newEntity);
      return newEntity;
    }
  }

  // ==========================================================================
  // VENDOR OPERATIONS
  // ==========================================================================

  async listVendors(
    filter?: VendorFilter,
    pagination?: PaginationOptions
  ): Promise<Vendor[] | PaginatedResult<Vendor>> {
    let results = [...this.vendors];

    if (filter) {
      if (filter.tenantId) {
        results = results.filter((v) => v.tenantId === filter.tenantId);
      }
      if (filter.activeOnly) {
        results = results.filter((v) => v.isActive);
      }
      if (filter.requires1099 !== undefined) {
        results = results.filter((v) => v.requires1099 === filter.requires1099);
      }
      if (filter.searchTerm) {
        results = results.filter((v) =>
          matchesSearch(v.name, filter.searchTerm!)
        );
      }
    }

    return paginate(results, pagination);
  }

  async getVendorById(id: string): Promise<Vendor | null> {
    return this.vendors.find((v) => v.id === id) ?? null;
  }

  async saveVendor(vendor: Vendor): Promise<Vendor> {
    const existingIndex = this.vendors.findIndex((v) => v.id === vendor.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.vendors[existingIndex] = { ...vendor, updatedAt: now };
      return this.vendors[existingIndex];
    } else {
      const newVendor = { ...vendor, createdAt: now, updatedAt: now };
      this.vendors.push(newVendor);
      return newVendor;
    }
  }

  async deleteVendor(id: string): Promise<boolean> {
    const index = this.vendors.findIndex((v) => v.id === id);
    if (index >= 0) {
      this.vendors.splice(index, 1);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // BANK ACCOUNT & RECONCILIATION OPERATIONS
  // ==========================================================================

  async listBankAccounts(tenantId: string): Promise<BankAccount[]> {
    return this.bankAccounts.filter((b) => b.tenantId === tenantId);
  }

  async getBankAccountById(id: string): Promise<BankAccount | null> {
    return this.bankAccounts.find((b) => b.id === id) ?? null;
  }

  async saveBankAccount(account: BankAccount): Promise<BankAccount> {
    const existingIndex = this.bankAccounts.findIndex((b) => b.id === account.id);
    const now = new Date();

    if (existingIndex >= 0) {
      this.bankAccounts[existingIndex] = { ...account, updatedAt: now };
      return this.bankAccounts[existingIndex];
    } else {
      const newAcct = { ...account, createdAt: now, updatedAt: now };
      this.bankAccounts.push(newAcct);
      return newAcct;
    }
  }

  async listReconciliations(bankAccountId: string): Promise<Reconciliation[]> {
    return this.reconciliations
      .filter((r) => r.bankAccountId === bankAccountId)
      .sort((a, b) => b.statementDate.getTime() - a.statementDate.getTime());
  }

  async getReconciliationById(id: string): Promise<Reconciliation | null> {
    return this.reconciliations.find((r) => r.id === id) ?? null;
  }

  async saveReconciliation(reconciliation: Reconciliation): Promise<Reconciliation> {
    const existingIndex = this.reconciliations.findIndex(
      (r) => r.id === reconciliation.id
    );
    const now = new Date();

    if (existingIndex >= 0) {
      this.reconciliations[existingIndex] = { ...reconciliation, updatedAt: now };
      return this.reconciliations[existingIndex];
    } else {
      const newRecon = { ...reconciliation, createdAt: now, updatedAt: now };
      this.reconciliations.push(newRecon);
      return newRecon;
    }
  }

  // ==========================================================================
  // IMPORT BATCH OPERATIONS
  // ==========================================================================

  async listImportBatches(tenantId: string, limit?: number): Promise<ImportBatch[]> {
    let results = this.importBatches
      .filter((b) => b.tenantId === tenantId)
      .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());

    if (limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  async getImportBatchById(id: string): Promise<ImportBatch | null> {
    return this.importBatches.find((b) => b.id === id) ?? null;
  }

  async saveImportBatch(batch: ImportBatch): Promise<ImportBatch> {
    const existingIndex = this.importBatches.findIndex((b) => b.id === batch.id);

    if (existingIndex >= 0) {
      this.importBatches[existingIndex] = batch;
      return this.importBatches[existingIndex];
    } else {
      this.importBatches.push(batch);
      return batch;
    }
  }

  // ==========================================================================
  // FISCAL PERIOD OPERATIONS
  // ==========================================================================

  async listFiscalPeriods(
    tenantId: string,
    fiscalYear?: number
  ): Promise<FiscalPeriod[]> {
    let results = this.fiscalPeriods.filter(
      (p) => (p as Record<string, unknown>)['tenantId'] === tenantId
    );

    if (fiscalYear !== undefined) {
      results = results.filter((p) => p.fiscalYear === fiscalYear);
    }

    return results.sort((a, b) => {
      if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
      return a.period - b.period;
    });
  }

  async getFiscalPeriod(tenantId: string, date: Date): Promise<FiscalPeriod | null> {
    return (
      this.fiscalPeriods.find(
        (p) =>
          (p as Record<string, unknown>)['tenantId'] === tenantId &&
          p.startDate <= date &&
          p.endDate >= date
      ) ?? null
    );
  }

  async saveFiscalPeriod(period: FiscalPeriod): Promise<FiscalPeriod> {
    const existingIndex = this.fiscalPeriods.findIndex(
      (p) =>
        p.fiscalYear === period.fiscalYear &&
        p.period === period.period &&
        (p as Record<string, unknown>)['tenantId'] ===
          (period as Record<string, unknown>)['tenantId']
    );

    if (existingIndex >= 0) {
      this.fiscalPeriods[existingIndex] = period;
      return this.fiscalPeriods[existingIndex];
    } else {
      this.fiscalPeriods.push(period);
      return period;
    }
  }

  async closeFiscalPeriod(
    tenantId: string,
    fiscalYear: number,
    period: number,
    closedBy: string
  ): Promise<FiscalPeriod | null> {
    const fp = this.fiscalPeriods.find(
      (p) =>
        (p as Record<string, unknown>)['tenantId'] === tenantId &&
        p.fiscalYear === fiscalYear &&
        p.period === period
    );

    if (!fp) return null;

    fp.isClosed = true;
    fp.closedAt = new Date();
    fp.closedBy = closedBy;

    return fp;
  }

  // ==========================================================================
  // FUND BALANCE CLASSIFICATION OPERATIONS
  // ==========================================================================

  async getFundBalanceClassification(
    fundId: string,
    fiscalYear: number
  ): Promise<FundBalanceClassification | null> {
    return (
      this.fundBalanceClassifications.find(
        (c) => c.fundId === fundId && c.fiscalYear === fiscalYear
      ) ?? null
    );
  }

  async saveFundBalanceClassification(
    classification: FundBalanceClassification
  ): Promise<FundBalanceClassification> {
    const existingIndex = this.fundBalanceClassifications.findIndex(
      (c) =>
        c.fundId === classification.fundId &&
        c.fiscalYear === classification.fiscalYear
    );

    if (existingIndex >= 0) {
      this.fundBalanceClassifications[existingIndex] = classification;
      return this.fundBalanceClassifications[existingIndex];
    } else {
      this.fundBalanceClassifications.push(classification);
      return classification;
    }
  }

  // ==========================================================================
  // REPORTING HELPERS
  // ==========================================================================

  async getFundSummary(
    fundId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<FundSummary | null> {
    const fund = await this.getFundById(fundId);
    if (!fund) return null;

    const txSummary = await this.getTransactionSummary(
      fund.tenantId,
      fundId,
      periodStart,
      periodEnd
    );

    // Calculate beginning balance (all transactions before periodStart)
    const priorTxs = this.transactions.filter(
      (t) =>
        t.fundId === fundId &&
        t.status !== 'VOIDED' &&
        normalizeDate(t.transactionDate)! < periodStart
    );

    let beginningBalance = fund.beginningBalance ?? 0;
    for (const tx of priorTxs) {
      if (tx.type === 'RECEIPT' || tx.type === 'TRANSFER') {
        beginningBalance += tx.amount;
      } else if (tx.type === 'DISBURSEMENT') {
        beginningBalance -= tx.amount;
      } else if (tx.type === 'ADJUSTMENT') {
        beginningBalance += tx.amount;
      }
    }

    const endingBalance = beginningBalance + txSummary.netChange;

    return {
      fund,
      beginningBalance,
      totalReceipts: txSummary.receiptTotal,
      totalDisbursements: txSummary.disbursementTotal,
      netChange: txSummary.netChange,
      endingBalance,
      periodStart,
      periodEnd,
    };
  }

  async getAllFundSummaries(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<FundSummary[]> {
    const funds = this.funds.filter((f) => f.tenantId === tenantId && f.isActive);
    const summaries: FundSummary[] = [];

    for (const fund of funds) {
      const summary = await this.getFundSummary(fund.id, periodStart, periodEnd);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  async calculateFundBalance(fundId: string, asOfDate: Date): Promise<number> {
    const fund = await this.getFundById(fundId);
    if (!fund) return 0;

    let balance = fund.beginningBalance ?? 0;

    const txs = this.transactions.filter(
      (t) =>
        t.fundId === fundId &&
        t.status !== 'VOIDED' &&
        normalizeDate(t.transactionDate)! <= asOfDate
    );

    for (const tx of txs) {
      if (tx.type === 'RECEIPT') {
        balance += tx.amount;
      } else if (tx.type === 'DISBURSEMENT') {
        balance -= tx.amount;
      } else if (tx.type === 'TRANSFER') {
        balance += tx.amount; // Sign determines direction
      } else if (tx.type === 'ADJUSTMENT') {
        balance += tx.amount;
      }
    }

    return balance;
  }

  // ==========================================================================
  // UTILITY METHODS FOR TESTING
  // ==========================================================================

  /**
   * Clear all data (useful for testing).
   */
  clear(): void {
    this.funds = [];
    this.accounts = [];
    this.budgetLines = [];
    this.transactions = [];
    this.debtInstruments = [];
    this.debtServiceSchedules = [];
    this.fiscalEntities = [];
    this.vendors = [];
    this.bankAccounts = [];
    this.reconciliations = [];
    this.importBatches = [];
    this.fiscalPeriods = [];
    this.fundBalanceClassifications = [];
  }

  /**
   * Get counts for debugging.
   */
  getCounts(): Record<string, number> {
    return {
      funds: this.funds.length,
      accounts: this.accounts.length,
      budgetLines: this.budgetLines.length,
      transactions: this.transactions.length,
      debtInstruments: this.debtInstruments.length,
      debtServiceSchedules: this.debtServiceSchedules.length,
      fiscalEntities: this.fiscalEntities.length,
      vendors: this.vendors.length,
      bankAccounts: this.bankAccounts.length,
      reconciliations: this.reconciliations.length,
      importBatches: this.importBatches.length,
      fiscalPeriods: this.fiscalPeriods.length,
      fundBalanceClassifications: this.fundBalanceClassifications.length,
    };
  }
}
