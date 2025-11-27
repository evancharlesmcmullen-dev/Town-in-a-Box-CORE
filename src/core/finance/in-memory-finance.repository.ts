// src/core/finance/in-memory-finance.repository.ts

import {
  Fund,
  Account,
  BudgetLine,
  Transaction,
  TransactionType,
} from './finance.types';
import {
  FinanceRepository,
  FundFilter,
  TransactionFilter,
} from './finance.repository';

/**
 * Optional seed data to bootstrap the in-memory repository.
 */
export interface InMemoryFinanceSeedData {
  funds?: Fund[];
  accounts?: Account[];
  budgetLines?: BudgetLine[];
  transactions?: Transaction[];
}

/**
 * Simple in-memory implementation of FinanceRepository.
 *
 * This is intended for:
 * - exercising the FinanceRulesEngine (fund catalog, reporting),
 * - testing claims/transactions behavior without a DB,
 * - early integration with other engines.
 *
 * It does NOT enforce multi-tenant or fiscalEntity constraints by itself;
 * that is the responsibility of higher-level services using tenantId/fiscalEntityId.
 */
export class InMemoryFinanceRepository implements FinanceRepository {
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

  //
  // FUNDS
  //

  async listFunds(filter?: FundFilter): Promise<Fund[]> {
    let results = [...this.funds];

    if (filter?.fiscalEntityId) {
      results = results.filter(
        (f) => f.fiscalEntityId === filter.fiscalEntityId
      );
    }

    if (filter?.codes && filter.codes.length > 0) {
      const codeSet = new Set(filter.codes);
      results = results.filter((f) => {
        if (!f.code) return false;
        return codeSet.has(f.code);
      });
    }

    if (filter?.activeOnly) {
      // If your Fund type uses a different flag name, adjust this check accordingly.
      results = results.filter((f: any) => f.isActive !== false);
    }

    return results;
  }

  async getFundById(id: string): Promise<Fund | null> {
    return this.funds.find((f) => f.id === id) ?? null;
  }

  async saveFund(fund: Fund): Promise<Fund> {
    const existingIndex = this.funds.findIndex((f) => f.id === fund.id);
    if (existingIndex >= 0) {
      this.funds[existingIndex] = fund;
    } else {
      this.funds.push(fund);
    }
    return fund;
  }

  //
  // ACCOUNTS
  //

  async listAccountsForFund(fundId: string): Promise<Account[]> {
    return this.accounts.filter((a) => a.fundId === fundId);
  }

  async getAccountById(id: string): Promise<Account | null> {
    return this.accounts.find((a) => a.id === id) ?? null;
  }

  async saveAccount(account: Account): Promise<Account> {
    const existingIndex = this.accounts.findIndex((a) => a.id === account.id);
    if (existingIndex >= 0) {
      this.accounts[existingIndex] = account;
    } else {
      this.accounts.push(account);
    }
    return account;
  }

  //
  // BUDGET LINES
  //

  async listBudgetLinesForYear(year: number): Promise<BudgetLine[]> {
    return this.budgetLines.filter((b) => b.year === year);
  }

  async saveBudgetLine(line: BudgetLine): Promise<BudgetLine> {
    const existingIndex = this.budgetLines.findIndex((b) => b.id === line.id);
    if (existingIndex >= 0) {
      this.budgetLines[existingIndex] = line;
    } else {
      this.budgetLines.push(line);
    }
    return line;
  }

  //
  // TRANSACTIONS
  //

  async listTransactions(
    filter?: TransactionFilter
  ): Promise<Transaction[]> {
    let results = [...this.transactions];

    if (filter?.fromDate) {
      const from = filter.fromDate;
      results = results.filter((t) => t.date && t.date >= from);
    }

    if (filter?.toDate) {
      const to = filter.toDate;
      results = results.filter((t) => t.date && t.date <= to);
    }

    if (filter?.fundIds && filter.fundIds.length > 0) {
      const fundSet = new Set(filter.fundIds);
      results = results.filter((t) => t.fundId && fundSet.has(t.fundId));
    }

    if (filter?.accountIds && filter.accountIds.length > 0) {
      const accountSet = new Set(filter.accountIds);
      results = results.filter(
        (t) => t.accountId && accountSet.has(t.accountId)
      );
    }

    if (filter?.types && filter.types.length > 0) {
      const typeSet = new Set<TransactionType>(filter.types);
      results = results.filter((t) => t.type && typeSet.has(t.type));
    }

    return results;
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    return this.transactions.find((t) => t.id === id) ?? null;
  }

  async saveTransaction(tx: Transaction): Promise<Transaction> {
    const existingIndex = this.transactions.findIndex((t) => t.id === tx.id);
    if (existingIndex >= 0) {
      this.transactions[existingIndex] = tx;
    } else {
      this.transactions.push(tx);
    }
    return tx;
  }
}
