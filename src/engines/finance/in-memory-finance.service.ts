// src/engines/finance/in-memory-finance.service.ts
//
// In-memory implementation of FinanceService for testing and development.
// Supports double-entry fund accounting with balanced transaction enforcement.

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FinanceService,
  CreateFundInput,
  UpdateFundInput,
  CreateAccountInput,
  UpdateAccountInput,
  CreateTransactionInput,
  CreateAppropriationInput,
  UpdateAppropriationInput,
  AccountFilter,
  TransactionFilter,
  AppropriationFilter,
} from './finance.service';
import {
  Fund,
  Account,
  FinanceTransaction,
  FinanceTransactionLine,
  Appropriation,
  FundBalanceSummary,
  AppropriationUsageSummary,
} from './finance.types';

// =============================================================================
// SEED DATA TYPE
// =============================================================================

/**
 * Seed data for initializing the in-memory service.
 * Useful for testing with pre-populated data.
 */
export interface InMemoryFinanceSeedData {
  funds?: Fund[];
  accounts?: Account[];
  appropriations?: Appropriation[];
  transactions?: FinanceTransaction[];
}

// =============================================================================
// IN-MEMORY IMPLEMENTATION
// =============================================================================

/**
 * In-memory FinanceService implementation for tests and demos.
 *
 * Data is scoped per tenant and stored only for the lifetime of the process.
 * This implementation:
 * - Enforces balanced transactions (total debits = total credits)
 * - Validates fund/account references on transaction creation
 * - Calculates fund balance summaries by walking transaction lines
 * - Calculates appropriation usage by summing expenditure lines
 */
export class InMemoryFinanceService implements FinanceService {
  private funds: Fund[];
  private accounts: Account[];
  private appropriations: Appropriation[];
  private transactions: FinanceTransaction[];

  constructor(seed: InMemoryFinanceSeedData = {}) {
    this.funds = seed.funds ? [...seed.funds] : [];
    this.accounts = seed.accounts ? [...seed.accounts] : [];
    this.appropriations = seed.appropriations ? [...seed.appropriations] : [];
    this.transactions = seed.transactions ? [...seed.transactions] : [];
  }

  // ===========================================================================
  // FUND OPERATIONS
  // ===========================================================================

  async createFund(ctx: TenantContext, input: CreateFundInput): Promise<Fund> {
    const now = new Date().toISOString();
    const fund: Fund = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      sboaCode: input.sboaCode,
      dlgfFundNumber: input.dlgfFundNumber,
      isMajorFund: input.isMajorFund,
      description: input.description,
    };

    this.funds.push(fund);
    return fund;
  }

  async getFund(ctx: TenantContext, id: string): Promise<Fund | null> {
    return (
      this.funds.find((f) => f.id === id && f.tenantId === ctx.tenantId) ?? null
    );
  }

  async listFunds(ctx: TenantContext): Promise<Fund[]> {
    return this.funds.filter((f) => f.tenantId === ctx.tenantId);
  }

  async updateFund(
    ctx: TenantContext,
    id: string,
    input: UpdateFundInput
  ): Promise<Fund> {
    const fund = this.funds.find(
      (f) => f.id === id && f.tenantId === ctx.tenantId
    );

    if (!fund) {
      throw new Error('Fund not found for tenant');
    }

    const now = new Date().toISOString();

    if (input.name !== undefined) fund.name = input.name;
    if (input.type !== undefined) fund.type = input.type;
    if (input.isActive !== undefined) fund.isActive = input.isActive;
    if (input.sboaCode !== undefined) fund.sboaCode = input.sboaCode;
    if (input.dlgfFundNumber !== undefined) fund.dlgfFundNumber = input.dlgfFundNumber;
    if (input.isMajorFund !== undefined) fund.isMajorFund = input.isMajorFund;
    if (input.description !== undefined) fund.description = input.description;
    fund.updatedAt = now;

    return fund;
  }

  // ===========================================================================
  // ACCOUNT OPERATIONS
  // ===========================================================================

  async createAccount(
    ctx: TenantContext,
    input: CreateAccountInput
  ): Promise<Account> {
    const now = new Date().toISOString();
    const account: Account = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      code: input.code,
      name: input.name,
      category: input.category,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      sboaCode: input.sboaCode,
      description: input.description,
    };

    this.accounts.push(account);
    return account;
  }

  async getAccount(ctx: TenantContext, id: string): Promise<Account | null> {
    return (
      this.accounts.find(
        (a) => a.id === id && a.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listAccounts(
    ctx: TenantContext,
    filter?: AccountFilter
  ): Promise<Account[]> {
    let results = this.accounts.filter((a) => a.tenantId === ctx.tenantId);

    if (filter?.category !== undefined) {
      results = results.filter((a) => a.category === filter.category);
    }

    if (filter?.isActive !== undefined) {
      results = results.filter((a) => a.isActive === filter.isActive);
    }

    return results;
  }

  async updateAccount(
    ctx: TenantContext,
    id: string,
    input: UpdateAccountInput
  ): Promise<Account> {
    const account = this.accounts.find(
      (a) => a.id === id && a.tenantId === ctx.tenantId
    );

    if (!account) {
      throw new Error('Account not found for tenant');
    }

    const now = new Date().toISOString();

    if (input.name !== undefined) account.name = input.name;
    if (input.category !== undefined) account.category = input.category;
    if (input.isActive !== undefined) account.isActive = input.isActive;
    if (input.sboaCode !== undefined) account.sboaCode = input.sboaCode;
    if (input.description !== undefined) account.description = input.description;
    account.updatedAt = now;

    return account;
  }

  // ===========================================================================
  // TRANSACTION OPERATIONS
  // ===========================================================================

  async createTransaction(
    ctx: TenantContext,
    input: CreateTransactionInput
  ): Promise<FinanceTransaction> {
    // Validate: lines is not empty
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Transaction must have at least one line');
    }

    // Validate: all fundIds exist for this tenant
    for (const line of input.lines) {
      const fund = this.funds.find(
        (f) => f.id === line.fundId && f.tenantId === ctx.tenantId
      );
      if (!fund) {
        throw new Error(`Fund not found: ${line.fundId}`);
      }
    }

    // Validate: all accountIds exist for this tenant
    for (const line of input.lines) {
      const account = this.accounts.find(
        (a) => a.id === line.accountId && a.tenantId === ctx.tenantId
      );
      if (!account) {
        throw new Error(`Account not found: ${line.accountId}`);
      }
    }

    // Validate: total debits = total credits (balanced transaction)
    let totalDebits = 0;
    let totalCredits = 0;
    for (const line of input.lines) {
      if (line.isDebit) {
        totalDebits += line.amountCents;
      } else {
        totalCredits += line.amountCents;
      }
    }

    if (totalDebits !== totalCredits) {
      throw new Error(
        `FinanceTransaction is not balanced: debits=${totalDebits}, credits=${totalCredits}`
      );
    }

    // Create transaction
    const now = new Date().toISOString();
    const transactionId = randomUUID();

    const lines: FinanceTransactionLine[] = input.lines.map((lineInput) => ({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      transactionId,
      fundId: lineInput.fundId,
      accountId: lineInput.accountId,
      amountCents: lineInput.amountCents,
      isDebit: lineInput.isDebit,
      appropriationId: lineInput.appropriationId,
      memo: lineInput.memo,
    }));

    const transaction: FinanceTransaction = {
      id: transactionId,
      tenantId: ctx.tenantId,
      type: input.type,
      transactionDate: input.transactionDate,
      reference: input.reference,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      lines,
    };

    this.transactions.push(transaction);
    return transaction;
  }

  async getTransaction(
    ctx: TenantContext,
    id: string
  ): Promise<FinanceTransaction | null> {
    return (
      this.transactions.find(
        (t) => t.id === id && t.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listTransactions(
    ctx: TenantContext,
    filter?: TransactionFilter
  ): Promise<FinanceTransaction[]> {
    let results = this.transactions.filter((t) => t.tenantId === ctx.tenantId);

    if (filter?.type !== undefined) {
      results = results.filter((t) => t.type === filter.type);
    }

    if (filter?.fromDate !== undefined) {
      results = results.filter((t) => t.transactionDate >= filter.fromDate!);
    }

    if (filter?.toDate !== undefined) {
      results = results.filter((t) => t.transactionDate <= filter.toDate!);
    }

    // Filter by fundId - transaction has lines, check if any line matches
    if (filter?.fundId !== undefined) {
      results = results.filter((t) =>
        t.lines.some((line) => line.fundId === filter.fundId)
      );
    }

    // Filter by accountId - transaction has lines, check if any line matches
    if (filter?.accountId !== undefined) {
      results = results.filter((t) =>
        t.lines.some((line) => line.accountId === filter.accountId)
      );
    }

    return results;
  }

  // ===========================================================================
  // APPROPRIATION OPERATIONS
  // ===========================================================================

  async createAppropriation(
    ctx: TenantContext,
    input: CreateAppropriationInput
  ): Promise<Appropriation> {
    // Validate fund exists
    const fund = this.funds.find(
      (f) => f.id === input.fundId && f.tenantId === ctx.tenantId
    );
    if (!fund) {
      throw new Error(`Fund not found: ${input.fundId}`);
    }

    // Validate account exists
    const account = this.accounts.find(
      (a) => a.id === input.accountId && a.tenantId === ctx.tenantId
    );
    if (!account) {
      throw new Error(`Account not found: ${input.accountId}`);
    }

    const now = new Date().toISOString();
    const appropriation: Appropriation = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      fundId: input.fundId,
      accountId: input.accountId,
      budgetYear: input.budgetYear,
      adoptedAmountCents: input.adoptedAmountCents,
      additionalAppropriationCents: input.additionalAppropriationCents,
      reductionsCents: input.reductionsCents,
      createdAt: now,
      updatedAt: now,
      ordinanceNumber: input.ordinanceNumber,
      adoptedDate: input.adoptedDate,
    };

    this.appropriations.push(appropriation);
    return appropriation;
  }

  async getAppropriation(
    ctx: TenantContext,
    id: string
  ): Promise<Appropriation | null> {
    return (
      this.appropriations.find(
        (a) => a.id === id && a.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listAppropriations(
    ctx: TenantContext,
    filter?: AppropriationFilter
  ): Promise<Appropriation[]> {
    let results = this.appropriations.filter(
      (a) => a.tenantId === ctx.tenantId
    );

    if (filter?.budgetYear !== undefined) {
      results = results.filter((a) => a.budgetYear === filter.budgetYear);
    }

    if (filter?.fundId !== undefined) {
      results = results.filter((a) => a.fundId === filter.fundId);
    }

    if (filter?.accountId !== undefined) {
      results = results.filter((a) => a.accountId === filter.accountId);
    }

    return results;
  }

  async updateAppropriation(
    ctx: TenantContext,
    id: string,
    input: UpdateAppropriationInput
  ): Promise<Appropriation> {
    const appropriation = this.appropriations.find(
      (a) => a.id === id && a.tenantId === ctx.tenantId
    );

    if (!appropriation) {
      throw new Error('Appropriation not found for tenant');
    }

    const now = new Date().toISOString();

    if (input.additionalAppropriationCents !== undefined) {
      appropriation.additionalAppropriationCents = input.additionalAppropriationCents;
    }
    if (input.reductionsCents !== undefined) {
      appropriation.reductionsCents = input.reductionsCents;
    }
    if (input.ordinanceNumber !== undefined) {
      appropriation.ordinanceNumber = input.ordinanceNumber;
    }
    appropriation.updatedAt = now;

    return appropriation;
  }

  // ===========================================================================
  // SUMMARY OPERATIONS
  // ===========================================================================

  /**
   * Get fund balance summary as of a specific date.
   *
   * Calculation logic:
   * - Walk all transaction lines for the specified fund up to asOfDate
   * - For CASH accounts: debits increase balance, credits decrease balance
   * - Encumbrances are not yet tracked (placeholder 0)
   *
   * Standard double-entry rules:
   * - Receipts: debit CASH (increase), credit REVENUE
   * - Disbursements: credit CASH (decrease), debit EXPENDITURE
   */
  async getFundBalanceSummary(
    ctx: TenantContext,
    fundId: string,
    asOfDate: string
  ): Promise<FundBalanceSummary> {
    // Validate fund exists
    const fund = this.funds.find(
      (f) => f.id === fundId && f.tenantId === ctx.tenantId
    );
    if (!fund) {
      throw new Error('Fund not found for tenant');
    }

    // Get all transactions up to asOfDate for this fund
    const relevantTransactions = this.transactions.filter(
      (t) =>
        t.tenantId === ctx.tenantId &&
        t.transactionDate <= asOfDate &&
        t.lines.some((line) => line.fundId === fundId)
    );

    // Get all CASH accounts for this tenant
    const cashAccountIds = new Set(
      this.accounts
        .filter((a) => a.tenantId === ctx.tenantId && a.category === 'CASH')
        .map((a) => a.id)
    );

    // Calculate cash balance
    // For CASH accounts: debits increase balance, credits decrease
    let cashBalanceCents = 0;

    for (const transaction of relevantTransactions) {
      for (const line of transaction.lines) {
        if (line.fundId === fundId && cashAccountIds.has(line.accountId)) {
          if (line.isDebit) {
            cashBalanceCents += line.amountCents;
          } else {
            cashBalanceCents -= line.amountCents;
          }
        }
      }
    }

    // Encumbrances are placeholder 0 for now (TODO: implement encumbrance tracking)
    const encumberedCents = 0;
    const availableCents = cashBalanceCents - encumberedCents;

    return {
      fundId,
      asOfDate,
      cashBalanceCents,
      encumberedCents,
      availableCents,
    };
  }

  /**
   * Get appropriation usage summary.
   *
   * Calculation logic:
   * - Find the appropriation
   * - Sum all transaction lines that reference this appropriation
   * - Only count debits to EXPENDITURE accounts as "expended"
   * - Encumbrances are placeholder 0 for now
   * - availableCents = adopted + additional - reductions - expended - encumbered
   */
  async getAppropriationUsageSummary(
    ctx: TenantContext,
    appropriationId: string
  ): Promise<AppropriationUsageSummary> {
    // Find the appropriation
    const appropriation = this.appropriations.find(
      (a) => a.id === appropriationId && a.tenantId === ctx.tenantId
    );

    if (!appropriation) {
      throw new Error('Appropriation not found for tenant');
    }

    // Get all expenditure accounts for this tenant
    const expenditureAccountIds = new Set(
      this.accounts
        .filter(
          (a) => a.tenantId === ctx.tenantId && a.category === 'EXPENDITURE'
        )
        .map((a) => a.id)
    );

    // Sum expenditures for this appropriation
    // Count debits to expenditure accounts that reference this appropriation
    let expendedCents = 0;

    for (const transaction of this.transactions) {
      if (transaction.tenantId !== ctx.tenantId) continue;

      for (const line of transaction.lines) {
        if (
          line.appropriationId === appropriationId &&
          expenditureAccountIds.has(line.accountId) &&
          line.isDebit
        ) {
          expendedCents += line.amountCents;
        }
      }
    }

    // Encumbrances are placeholder 0 for now (TODO: implement encumbrance tracking)
    const encumberedCents = 0;

    const adoptedAmountCents = appropriation.adoptedAmountCents;
    const additionalAppropriationCents =
      appropriation.additionalAppropriationCents ?? 0;
    const reductionsCents = appropriation.reductionsCents ?? 0;

    const availableCents =
      adoptedAmountCents +
      additionalAppropriationCents -
      reductionsCents -
      expendedCents -
      encumberedCents;

    return {
      appropriationId,
      budgetYear: appropriation.budgetYear,
      adoptedAmountCents,
      additionalAppropriationCents,
      reductionsCents,
      expendedCents,
      encumberedCents,
      availableCents,
    };
  }
}
