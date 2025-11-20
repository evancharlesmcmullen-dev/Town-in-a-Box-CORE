// src/engines/finance/in-memory-finance.service.ts

import { TenantContext } from '../../core/tenancy/types';
import { FinanceService } from './finance.service';
import {
  Account,
  BudgetLine,
  Fund,
  FundBalanceSummary,
  Transaction,
  TransactionType,
} from './finance.types';

export interface InMemoryFinanceSeedData {
  funds?: Fund[];
  accounts?: Account[];
  budgetLines?: BudgetLine[];
  transactions?: Transaction[];
}

/**
 * Simple in-memory FinanceService useful for tests/demos.
 * All data is stored in process memory and filtered by tenant id.
 */
export class InMemoryFinanceService implements FinanceService {
  private funds: Fund[];
  private accounts: Account[];
  private budgetLines: BudgetLine[];
  private transactions: Transaction[];

  constructor(seed: InMemoryFinanceSeedData = {}) {
    this.funds = seed.funds ? [...seed.funds] : [];
    this.accounts = seed.accounts ? [...seed.accounts] : [];
    this.budgetLines = seed.budgetLines ? [...seed.budgetLines] : [];
    this.transactions = seed.transactions ? [...seed.transactions] : [];
  }

  async listFunds(ctx: TenantContext): Promise<Fund[]> {
    return this.funds.filter((f) => f.tenantId === ctx.tenantId);
  }

  async listAccountsForFund(
    ctx: TenantContext,
    fundId: string
  ): Promise<Account[]> {
    return this.accounts.filter(
      (a) => a.tenantId === ctx.tenantId && a.fundId === fundId
    );
  }

  async listBudgetLinesForYear(
    ctx: TenantContext,
    year: number
  ): Promise<BudgetLine[]> {
    return this.budgetLines.filter(
      (b) => b.tenantId === ctx.tenantId && b.year === year
    );
  }

  async listTransactions(
    ctx: TenantContext,
    options: {
      fromDate?: Date;
      toDate?: Date;
      fundId?: string;
      accountId?: string;
      type?: TransactionType;
      sourceSystem?: string;
    } = {}
  ): Promise<Transaction[]> {
    let results = this.transactions.filter(
      (t) => t.tenantId === ctx.tenantId
    );

    if (options.fromDate) {
      results = results.filter((t) => t.date >= options.fromDate!);
    }

    if (options.toDate) {
      results = results.filter((t) => t.date <= options.toDate!);
    }

    if (options.fundId) {
      results = results.filter((t) => t.fundId === options.fundId);
    }

    if (options.accountId) {
      results = results.filter((t) => t.accountId === options.accountId);
    }

    if (options.type) {
      results = results.filter((t) => t.type === options.type);
    }

    if (options.sourceSystem) {
      results = results.filter(
        (t) => t.sourceSystem === options.sourceSystem
      );
    }

    return results;
  }

  async getFundBalanceSummaries(
    ctx: TenantContext,
    year: number
  ): Promise<FundBalanceSummary[]> {
    const tenantFunds = this.funds.filter((f) => f.tenantId === ctx.tenantId);

    return tenantFunds.map((fund) => {
      const fundBudgetLines = this.budgetLines.filter(
        (b) =>
          b.tenantId === ctx.tenantId &&
          b.fundId === fund.id &&
          b.year === year
      );

      const fundTransactions = this.transactions.filter(
        (t) =>
          t.tenantId === ctx.tenantId &&
          t.fundId === fund.id &&
          t.date.getFullYear() === year
      );

      const adoptedBudgetCents = fundBudgetLines.reduce(
        (sum, line) => sum + line.adoptedAmountCents,
        0
      );

      const currentBudgetCents = fundBudgetLines.reduce(
        (sum, line) => sum + (line.revisedAmountCents ?? line.adoptedAmountCents),
        0
      );

      const { actualRevenueCents, actualExpenseCents } = fundTransactions.reduce(
        (acc, tx) => {
          if (tx.type === 'revenue') {
            acc.actualRevenueCents += tx.amountCents;
          } else if (tx.type === 'expense') {
            acc.actualExpenseCents += tx.amountCents;
          }
          // transfers are ignored for now
          return acc;
        },
        { actualRevenueCents: 0, actualExpenseCents: 0 }
      );

      const estimatedEndingBalanceCents =
        currentBudgetCents + actualRevenueCents - actualExpenseCents;

      const summary: FundBalanceSummary = {
        fundId: fund.id,
        fundCode: fund.code,
        fundName: fund.name,
        year,
        adoptedBudgetCents,
        currentBudgetCents,
        actualRevenueCents,
        actualExpenseCents,
        estimatedEndingBalanceCents,
      };

      return summary;
    });
  }

  async exportFinanceData(
    ctx: TenantContext,
    year: number
  ): Promise<unknown> {
    const tenantId = ctx.tenantId;

    return {
      funds: this.funds.filter((f) => f.tenantId === tenantId),
      accounts: this.accounts.filter((a) => a.tenantId === tenantId),
      budgetLines: this.budgetLines.filter(
        (b) => b.tenantId === tenantId && b.year === year
      ),
      transactions: this.transactions.filter(
        (t) => t.tenantId === tenantId && t.date.getFullYear() === year
      ),
    };
  }
}
