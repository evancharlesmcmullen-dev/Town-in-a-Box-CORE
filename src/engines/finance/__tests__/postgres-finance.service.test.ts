// src/engines/finance/__tests__/postgres-finance.service.test.ts
//
// Tests for PostgresFinanceService using mocked TenantAwareDb.
//
// These tests verify the service logic and SQL query construction.
// For integration tests with a real database, use a test database setup.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { PostgresFinanceService } from '../postgres-finance.service';
import { TenantAwareDb } from '../../../db/tenant-aware-db';
import { TenantContext, JurisdictionProfile } from '../../../core/tenancy/tenancy.types';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTestContext(tenantId: string): TenantContext {
  const jurisdiction: JurisdictionProfile = {
    tenantId,
    state: 'IN',
    kind: 'town',
    name: `Test Town ${tenantId}`,
    authorityTags: [],
  };

  return {
    tenantId,
    jurisdiction,
    userId: 'test-user',
    roles: ['admin'],
  };
}

/**
 * Creates a mock TenantAwareDb that tracks queries.
 * The mock stores data in memory and simulates Postgres behavior.
 */
function createMockDb() {
  // In-memory storage for each table
  const storage: {
    funds: Map<string, any>;
    accounts: Map<string, any>;
    finance_transactions: Map<string, any>;
    finance_transaction_lines: Map<string, any>;
    appropriations: Map<string, any>;
  } = {
    funds: new Map(),
    accounts: new Map(),
    finance_transactions: new Map(),
    finance_transaction_lines: new Map(),
    appropriations: new Map(),
  };

  let idCounter = 0;
  const generateId = () => `test-id-${++idCounter}`;

  // Mock client that simulates query behavior
  const mockClient = {
    release: vi.fn(),
    query: vi.fn(async (sql: string, params?: any[]) => {
      const sqlLower = sql.toLowerCase().trim();
      const now = new Date();

      // INSERT INTO funds
      if (sqlLower.startsWith('insert into funds')) {
        const id = generateId();
        const fund = {
          id,
          tenant_id: params![0],
          code: params![1],
          name: params![2],
          type: params![3],
          is_active: params![4],
          sboa_code: params![5],
          dlgf_fund_number: params![6],
          is_major_fund: params![7],
          description: params![8],
          created_at: now,
          updated_at: now,
        };
        storage.funds.set(id, fund);
        return { rows: [fund] };
      }

      // SELECT * FROM funds WHERE tenant_id = $1 AND id = $2
      if (sqlLower.includes('from funds') && sqlLower.includes('where') && params!.length === 2) {
        const fund = storage.funds.get(params![1]);
        if (fund && fund.tenant_id === params![0]) {
          return { rows: [fund] };
        }
        return { rows: [] };
      }

      // SELECT * FROM funds WHERE tenant_id = $1 ORDER BY code
      if (sqlLower.includes('from funds') && sqlLower.includes('order by code')) {
        const tenantFunds = Array.from(storage.funds.values())
          .filter((f) => f.tenant_id === params![0])
          .sort((a, b) => a.code.localeCompare(b.code));
        return { rows: tenantFunds };
      }

      // SELECT id FROM funds WHERE tenant_id = $1 AND id = $2 (existence check)
      if (sqlLower.includes('select id from funds')) {
        const fund = storage.funds.get(params![1]);
        if (fund && fund.tenant_id === params![0]) {
          return { rows: [{ id: fund.id }] };
        }
        return { rows: [] };
      }

      // UPDATE funds
      if (sqlLower.startsWith('update funds')) {
        const fund = storage.funds.get(params![1]);
        if (fund && fund.tenant_id === params![0]) {
          // Parse the update fields from SQL and params
          fund.updated_at = now;
          // Simple: just return the fund (actual updates would parse the SET clause)
          for (let i = 2; i < params!.length; i++) {
            const val = params![i];
            if (typeof val === 'string' && sqlLower.includes('name =')) {
              fund.name = val;
            }
            if (typeof val === 'boolean' && sqlLower.includes('is_active =')) {
              fund.is_active = val;
            }
          }
          return { rows: [fund] };
        }
        return { rows: [] };
      }

      // INSERT INTO accounts
      if (sqlLower.startsWith('insert into accounts')) {
        const id = generateId();
        const account = {
          id,
          tenant_id: params![0],
          code: params![1],
          name: params![2],
          category: params![3],
          is_active: params![4],
          sboa_code: params![5],
          description: params![6],
          created_at: now,
          updated_at: now,
        };
        storage.accounts.set(id, account);
        return { rows: [account] };
      }

      // SELECT * FROM accounts WHERE tenant_id = $1 AND id = $2
      if (sqlLower.includes('from accounts') && sqlLower.includes('where') && params!.length === 2 && !sqlLower.includes('order by')) {
        const account = storage.accounts.get(params![1]);
        if (account && account.tenant_id === params![0]) {
          return { rows: [account] };
        }
        return { rows: [] };
      }

      // SELECT id FROM accounts (existence check)
      if (sqlLower.includes('select id from accounts')) {
        const account = storage.accounts.get(params![1]);
        if (account && account.tenant_id === params![0]) {
          return { rows: [{ id: account.id }] };
        }
        return { rows: [] };
      }

      // SELECT * FROM accounts WHERE tenant_id = $1 ORDER BY code
      if (sqlLower.includes('from accounts') && sqlLower.includes('order by code')) {
        let tenantAccounts = Array.from(storage.accounts.values())
          .filter((a) => a.tenant_id === params![0]);

        // Apply category filter if present
        if (params!.length > 1 && sqlLower.includes('category =')) {
          tenantAccounts = tenantAccounts.filter((a) => a.category === params![1]);
        }

        tenantAccounts.sort((a, b) => a.code.localeCompare(b.code));
        return { rows: tenantAccounts };
      }

      // UPDATE accounts
      if (sqlLower.startsWith('update accounts')) {
        const account = storage.accounts.get(params![1]);
        if (account && account.tenant_id === params![0]) {
          account.updated_at = now;
          return { rows: [account] };
        }
        return { rows: [] };
      }

      // INSERT INTO finance_transactions
      if (sqlLower.startsWith('insert into finance_transactions')) {
        const id = generateId();
        const transaction = {
          id,
          tenant_id: params![0],
          type: params![1],
          transaction_date: new Date(params![2]),
          reference: params![3],
          description: params![4],
          created_at: now,
          updated_at: now,
        };
        storage.finance_transactions.set(id, transaction);
        return { rows: [transaction] };
      }

      // INSERT INTO finance_transaction_lines
      if (sqlLower.startsWith('insert into finance_transaction_lines')) {
        const id = generateId();
        const line = {
          id,
          tenant_id: params![0],
          transaction_id: params![1],
          fund_id: params![2],
          account_id: params![3],
          amount_cents: params![4],
          is_debit: params![5],
          appropriation_id: params![6],
          memo: params![7],
        };
        storage.finance_transaction_lines.set(id, line);
        return { rows: [line] };
      }

      // SELECT * FROM finance_transactions WHERE tenant_id = $1 AND id = $2
      if (sqlLower.includes('from finance_transactions') && sqlLower.includes('where') && params!.length === 2) {
        const tx = storage.finance_transactions.get(params![1]);
        if (tx && tx.tenant_id === params![0]) {
          return { rows: [tx] };
        }
        return { rows: [] };
      }

      // Fund balance summary query (check this BEFORE generic transaction_lines query)
      if (sqlLower.includes('cash_balance_cents') && sqlLower.includes('finance_transaction_lines')) {
        const tenantId = params![0];
        const fundId = params![1];
        const asOfDate = new Date(params![2]);

        let balance = 0;
        for (const line of storage.finance_transaction_lines.values()) {
          if (line.tenant_id !== tenantId || line.fund_id !== fundId) continue;

          const tx = storage.finance_transactions.get(line.transaction_id);
          if (!tx || tx.transaction_date > asOfDate) continue;

          const account = storage.accounts.get(line.account_id);
          if (!account || account.category !== 'CASH') continue;

          if (line.is_debit) {
            balance += Number(line.amount_cents);
          } else {
            balance -= Number(line.amount_cents);
          }
        }
        return { rows: [{ cash_balance_cents: String(balance) }] };
      }

      // Appropriation usage summary query (check this BEFORE generic transaction_lines query)
      if (sqlLower.includes('expended_cents') && sqlLower.includes('finance_transaction_lines')) {
        const tenantId = params![0];
        const appropriationId = params![1];

        let expended = 0;
        for (const line of storage.finance_transaction_lines.values()) {
          if (line.tenant_id !== tenantId || line.appropriation_id !== appropriationId) continue;

          const account = storage.accounts.get(line.account_id);
          if (!account || account.category !== 'EXPENDITURE') continue;

          if (line.is_debit) {
            expended += Number(line.amount_cents);
          }
        }
        return { rows: [{ expended_cents: String(expended) }] };
      }

      // SELECT * FROM finance_transaction_lines WHERE transaction_id = $1
      if (sqlLower.includes('from finance_transaction_lines') && sqlLower.includes('where') && sqlLower.includes('transaction_id')) {
        const lines = Array.from(storage.finance_transaction_lines.values())
          .filter((l) => l.transaction_id === params![0]);
        return { rows: lines };
      }

      // SELECT DISTINCT t.* FROM finance_transactions (list with filters)
      if (sqlLower.includes('select distinct t.*') && sqlLower.includes('finance_transactions')) {
        let txs = Array.from(storage.finance_transactions.values())
          .filter((t) => t.tenant_id === params![0]);
        // Sort by date desc
        txs.sort((a, b) => b.transaction_date.getTime() - a.transaction_date.getTime());
        return { rows: txs };
      }

      // INSERT INTO appropriations
      if (sqlLower.startsWith('insert into appropriations')) {
        const id = generateId();
        const appropriation = {
          id,
          tenant_id: params![0],
          fund_id: params![1],
          account_id: params![2],
          budget_year: params![3],
          adopted_amount_cents: params![4],
          additional_appropriation_cents: params![5],
          reductions_cents: params![6],
          ordinance_number: params![7],
          adopted_date: params![8] ? new Date(params![8]) : null,
          created_at: now,
          updated_at: now,
        };
        storage.appropriations.set(id, appropriation);
        return { rows: [appropriation] };
      }

      // SELECT * FROM appropriations WHERE tenant_id = $1 AND id = $2
      if (sqlLower.includes('from appropriations') && sqlLower.includes('where') && params!.length === 2 && !sqlLower.includes('order by')) {
        const app = storage.appropriations.get(params![1]);
        if (app && app.tenant_id === params![0]) {
          return { rows: [app] };
        }
        return { rows: [] };
      }

      // SELECT * FROM appropriations WHERE tenant_id = $1 ORDER BY
      if (sqlLower.includes('from appropriations') && sqlLower.includes('order by')) {
        let apps = Array.from(storage.appropriations.values())
          .filter((a) => a.tenant_id === params![0]);
        apps.sort((a, b) => b.budget_year - a.budget_year);
        return { rows: apps };
      }

      // UPDATE appropriations
      if (sqlLower.startsWith('update appropriations')) {
        const app = storage.appropriations.get(params![1]);
        if (app && app.tenant_id === params![0]) {
          app.updated_at = now;
          // Parse additional params
          for (let i = 2; i < params!.length; i++) {
            const val = params![i];
            if (typeof val === 'number' && sqlLower.includes('additional_appropriation_cents')) {
              app.additional_appropriation_cents = val;
            }
            if (typeof val === 'string' && sqlLower.includes('ordinance_number')) {
              app.ordinance_number = val;
            }
          }
          return { rows: [app] };
        }
        return { rows: [] };
      }

      // Default: return empty rows
      return { rows: [] };
    }),
  } as unknown as PoolClient;

  // Mock pool
  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
  } as unknown as Pool;

  // Create TenantAwareDb with mock pool
  const db = new TenantAwareDb(mockPool);

  return { db, storage, mockClient };
}

// =============================================================================
// FUND CRUD TESTS
// =============================================================================

describe('PostgresFinanceService - Fund CRUD', () => {
  let service: PostgresFinanceService;
  let ctx: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctx = createTestContext('lapel');
  });

  it('should create a fund', async () => {
    const fund = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });

    expect(fund.id).toBeDefined();
    expect(fund.tenantId).toBe('lapel');
    expect(fund.code).toBe('0101');
    expect(fund.name).toBe('General Fund');
    expect(fund.type).toBe('GENERAL');
    expect(fund.isActive).toBe(true);
  });

  it('should get a fund by id', async () => {
    const created = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });

    const found = await service.getFund(ctx, created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe('General Fund');
  });

  it('should return null for non-existent fund', async () => {
    const found = await service.getFund(ctx, 'non-existent-id');
    expect(found).toBeNull();
  });

  it('should list all funds for tenant', async () => {
    await service.createFund(ctx, { code: '0101', name: 'General Fund', type: 'GENERAL' });
    await service.createFund(ctx, { code: '0706', name: 'MVH', type: 'MVH' });
    await service.createFund(ctx, { code: '6001', name: 'Water Operating', type: 'UTILITY_OPERATING' });

    const funds = await service.listFunds(ctx);

    expect(funds).toHaveLength(3);
    expect(funds.map((f) => f.code)).toContain('0101');
    expect(funds.map((f) => f.code)).toContain('0706');
    expect(funds.map((f) => f.code)).toContain('6001');
  });

  it('should throw when updating non-existent fund', async () => {
    await expect(
      service.updateFund(ctx, 'non-existent', { name: 'Test' })
    ).rejects.toThrow('Fund not found for tenant');
  });
});

// =============================================================================
// ACCOUNT CRUD TESTS
// =============================================================================

describe('PostgresFinanceService - Account CRUD', () => {
  let service: PostgresFinanceService;
  let ctx: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctx = createTestContext('lapel');
  });

  it('should create an account', async () => {
    const account = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash in Bank',
      category: 'CASH',
    });

    expect(account.id).toBeDefined();
    expect(account.tenantId).toBe('lapel');
    expect(account.code).toBe('101.000');
    expect(account.name).toBe('Cash in Bank');
    expect(account.category).toBe('CASH');
    expect(account.isActive).toBe(true);
  });

  it('should get an account by id', async () => {
    const created = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash in Bank',
      category: 'CASH',
    });

    const found = await service.getAccount(ctx, created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('should throw when updating non-existent account', async () => {
    await expect(
      service.updateAccount(ctx, 'non-existent', { name: 'Test' })
    ).rejects.toThrow('Account not found for tenant');
  });
});

// =============================================================================
// BALANCED TRANSACTION TESTS
// =============================================================================

describe('PostgresFinanceService - Balanced Transactions', () => {
  let service: PostgresFinanceService;
  let ctx: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;
  let fundId: string;
  let cashAccountId: string;
  let revenueAccountId: string;
  let expenditureAccountId: string;

  beforeEach(async () => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctx = createTestContext('lapel');

    // Create fund and accounts
    const fund = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });
    fundId = fund.id;

    const cash = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash',
      category: 'CASH',
    });
    cashAccountId = cash.id;

    const revenue = await service.createAccount(ctx, {
      code: '401.000',
      name: 'Property Tax Revenue',
      category: 'REVENUE',
    });
    revenueAccountId = revenue.id;

    const expenditure = await service.createAccount(ctx, {
      code: '501.000',
      name: 'Professional Services',
      category: 'EXPENDITURE',
    });
    expenditureAccountId = expenditure.id;
  });

  it('should throw when transaction is not balanced', async () => {
    await expect(
      service.createTransaction(ctx, {
        type: 'RECEIPT',
        transactionDate: '2025-01-15',
        description: 'Unbalanced transaction',
        lines: [
          { fundId, accountId: cashAccountId, amountCents: 10000, isDebit: true },
          { fundId, accountId: revenueAccountId, amountCents: 5000, isDebit: false }, // Only 5000 credit
        ],
      })
    ).rejects.toThrow('FinanceTransaction is not balanced');
  });

  it('should accept a balanced receipt transaction', async () => {
    const transaction = await service.createTransaction(ctx, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      reference: 'REC-001',
      description: 'Property tax received',
      lines: [
        { fundId, accountId: cashAccountId, amountCents: 10000, isDebit: true },
        { fundId, accountId: revenueAccountId, amountCents: 10000, isDebit: false },
      ],
    });

    expect(transaction.id).toBeDefined();
    expect(transaction.type).toBe('RECEIPT');
    expect(transaction.lines).toHaveLength(2);
    expect(transaction.reference).toBe('REC-001');
  });

  it('should accept a balanced disbursement transaction', async () => {
    const transaction = await service.createTransaction(ctx, {
      type: 'DISBURSEMENT',
      transactionDate: '2025-01-20',
      reference: 'CHK-001',
      description: 'Legal services payment',
      lines: [
        { fundId, accountId: expenditureAccountId, amountCents: 5000, isDebit: true },
        { fundId, accountId: cashAccountId, amountCents: 5000, isDebit: false },
      ],
    });

    expect(transaction.id).toBeDefined();
    expect(transaction.type).toBe('DISBURSEMENT');
    expect(transaction.lines).toHaveLength(2);
  });

  it('should throw when lines array is empty', async () => {
    await expect(
      service.createTransaction(ctx, {
        type: 'RECEIPT',
        transactionDate: '2025-01-15',
        description: 'Empty transaction',
        lines: [],
      })
    ).rejects.toThrow('Transaction must have at least one line');
  });

  it('should throw when fund does not exist', async () => {
    await expect(
      service.createTransaction(ctx, {
        type: 'RECEIPT',
        transactionDate: '2025-01-15',
        description: 'Bad fund transaction',
        lines: [
          { fundId: 'non-existent-fund', accountId: cashAccountId, amountCents: 1000, isDebit: true },
          { fundId, accountId: revenueAccountId, amountCents: 1000, isDebit: false },
        ],
      })
    ).rejects.toThrow('Fund not found');
  });

  it('should throw when account does not exist', async () => {
    await expect(
      service.createTransaction(ctx, {
        type: 'RECEIPT',
        transactionDate: '2025-01-15',
        description: 'Bad account transaction',
        lines: [
          { fundId, accountId: 'non-existent-account', amountCents: 1000, isDebit: true },
          { fundId, accountId: revenueAccountId, amountCents: 1000, isDebit: false },
        ],
      })
    ).rejects.toThrow('Account not found');
  });
});

// =============================================================================
// FUND BALANCE SUMMARY TESTS
// =============================================================================

describe('PostgresFinanceService - Fund Balance Summary', () => {
  let service: PostgresFinanceService;
  let ctx: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;
  let fundId: string;
  let cashAccountId: string;
  let revenueAccountId: string;
  let expenditureAccountId: string;

  beforeEach(async () => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctx = createTestContext('lapel');

    // Create fund and accounts
    const fund = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });
    fundId = fund.id;

    const cash = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash',
      category: 'CASH',
    });
    cashAccountId = cash.id;

    const revenue = await service.createAccount(ctx, {
      code: '401.000',
      name: 'Property Tax Revenue',
      category: 'REVENUE',
    });
    revenueAccountId = revenue.id;

    const expenditure = await service.createAccount(ctx, {
      code: '501.000',
      name: 'Professional Services',
      category: 'EXPENDITURE',
    });
    expenditureAccountId = expenditure.id;
  });

  it('should return zero balance with no transactions', async () => {
    const summary = await service.getFundBalanceSummary(ctx, fundId, '2025-12-31');

    expect(summary.fundId).toBe(fundId);
    expect(summary.cashBalanceCents).toBe(0);
    expect(summary.encumberedCents).toBe(0);
    expect(summary.availableCents).toBe(0);
  });

  it('should calculate cash balance after receipt', async () => {
    // Record a receipt: debit CASH, credit REVENUE
    await service.createTransaction(ctx, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'Property tax received',
      lines: [
        { fundId, accountId: cashAccountId, amountCents: 100000, isDebit: true },
        { fundId, accountId: revenueAccountId, amountCents: 100000, isDebit: false },
      ],
    });

    const summary = await service.getFundBalanceSummary(ctx, fundId, '2025-12-31');

    expect(summary.cashBalanceCents).toBe(100000);
    expect(summary.availableCents).toBe(100000);
  });

  it('should calculate cash balance after receipt and disbursement', async () => {
    // Receipt: $1000
    await service.createTransaction(ctx, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'Property tax received',
      lines: [
        { fundId, accountId: cashAccountId, amountCents: 100000, isDebit: true },
        { fundId, accountId: revenueAccountId, amountCents: 100000, isDebit: false },
      ],
    });

    // Disbursement: $250
    await service.createTransaction(ctx, {
      type: 'DISBURSEMENT',
      transactionDate: '2025-01-20',
      description: 'Legal services',
      lines: [
        { fundId, accountId: expenditureAccountId, amountCents: 25000, isDebit: true },
        { fundId, accountId: cashAccountId, amountCents: 25000, isDebit: false },
      ],
    });

    const summary = await service.getFundBalanceSummary(ctx, fundId, '2025-12-31');

    expect(summary.cashBalanceCents).toBe(75000); // 1000 - 250 = $750
    expect(summary.availableCents).toBe(75000);
  });

  it('should throw when fund does not exist', async () => {
    await expect(
      service.getFundBalanceSummary(ctx, 'non-existent', '2025-12-31')
    ).rejects.toThrow('Fund not found for tenant');
  });
});

// =============================================================================
// APPROPRIATION TESTS
// =============================================================================

describe('PostgresFinanceService - Appropriations', () => {
  let service: PostgresFinanceService;
  let ctx: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;
  let fundId: string;
  let cashAccountId: string;
  let expenditureAccountId: string;

  beforeEach(async () => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctx = createTestContext('lapel');

    const fund = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });
    fundId = fund.id;

    const cash = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash',
      category: 'CASH',
    });
    cashAccountId = cash.id;

    const expenditure = await service.createAccount(ctx, {
      code: '501.000',
      name: 'Professional Services',
      category: 'EXPENDITURE',
    });
    expenditureAccountId = expenditure.id;
  });

  it('should create an appropriation', async () => {
    const appropriation = await service.createAppropriation(ctx, {
      fundId,
      accountId: expenditureAccountId,
      budgetYear: 2025,
      adoptedAmountCents: 500000,
    });

    expect(appropriation.id).toBeDefined();
    expect(appropriation.tenantId).toBe('lapel');
    expect(appropriation.fundId).toBe(fundId);
    expect(appropriation.accountId).toBe(expenditureAccountId);
    expect(appropriation.budgetYear).toBe(2025);
    expect(appropriation.adoptedAmountCents).toBe(500000);
  });

  it('should get an appropriation by id', async () => {
    const created = await service.createAppropriation(ctx, {
      fundId,
      accountId: expenditureAccountId,
      budgetYear: 2025,
      adoptedAmountCents: 500000,
    });

    const found = await service.getAppropriation(ctx, created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('should list appropriations', async () => {
    await service.createAppropriation(ctx, {
      fundId,
      accountId: expenditureAccountId,
      budgetYear: 2024,
      adoptedAmountCents: 400000,
    });

    await service.createAppropriation(ctx, {
      fundId,
      accountId: expenditureAccountId,
      budgetYear: 2025,
      adoptedAmountCents: 500000,
    });

    const all = await service.listAppropriations(ctx);
    expect(all).toHaveLength(2);
  });

  it('should throw when creating appropriation with non-existent fund', async () => {
    await expect(
      service.createAppropriation(ctx, {
        fundId: 'non-existent',
        accountId: expenditureAccountId,
        budgetYear: 2025,
        adoptedAmountCents: 500000,
      })
    ).rejects.toThrow('Fund not found');
  });

  it('should throw when creating appropriation with non-existent account', async () => {
    await expect(
      service.createAppropriation(ctx, {
        fundId,
        accountId: 'non-existent',
        budgetYear: 2025,
        adoptedAmountCents: 500000,
      })
    ).rejects.toThrow('Account not found');
  });

  it('should throw when updating non-existent appropriation', async () => {
    await expect(
      service.updateAppropriation(ctx, 'non-existent', { additionalAppropriationCents: 100000 })
    ).rejects.toThrow('Appropriation not found for tenant');
  });
});

// =============================================================================
// APPROPRIATION USAGE SUMMARY TESTS
// =============================================================================

describe('PostgresFinanceService - Appropriation Usage Summary', () => {
  let service: PostgresFinanceService;
  let ctx: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;
  let fundId: string;
  let cashAccountId: string;
  let expenditureAccountId: string;
  let appropriationId: string;

  beforeEach(async () => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctx = createTestContext('lapel');

    const fund = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });
    fundId = fund.id;

    const cash = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash',
      category: 'CASH',
    });
    cashAccountId = cash.id;

    const expenditure = await service.createAccount(ctx, {
      code: '501.000',
      name: 'Professional Services',
      category: 'EXPENDITURE',
    });
    expenditureAccountId = expenditure.id;

    const appropriation = await service.createAppropriation(ctx, {
      fundId,
      accountId: expenditureAccountId,
      budgetYear: 2025,
      adoptedAmountCents: 500000, // $5,000
      additionalAppropriationCents: 50000, // $500 additional
    });
    appropriationId = appropriation.id;
  });

  it('should calculate usage summary with no expenditures', async () => {
    const summary = await service.getAppropriationUsageSummary(ctx, appropriationId);

    expect(summary.appropriationId).toBe(appropriationId);
    expect(summary.budgetYear).toBe(2025);
    expect(summary.adoptedAmountCents).toBe(500000);
    expect(summary.additionalAppropriationCents).toBe(50000);
    expect(summary.reductionsCents).toBe(0);
    expect(summary.expendedCents).toBe(0);
    expect(summary.encumberedCents).toBe(0);
    expect(summary.availableCents).toBe(550000); // 5000 + 500 = $5,500
  });

  it('should calculate usage summary with expenditures', async () => {
    // Expenditure of $1,000 referencing the appropriation
    await service.createTransaction(ctx, {
      type: 'DISBURSEMENT',
      transactionDate: '2025-02-15',
      description: 'Legal services',
      lines: [
        {
          fundId,
          accountId: expenditureAccountId,
          amountCents: 100000,
          isDebit: true,
          appropriationId,
        },
        {
          fundId,
          accountId: cashAccountId,
          amountCents: 100000,
          isDebit: false,
        },
      ],
    });

    const summary = await service.getAppropriationUsageSummary(ctx, appropriationId);

    expect(summary.expendedCents).toBe(100000);
    expect(summary.availableCents).toBe(450000); // 5500 - 1000 = $4,500
  });

  it('should throw when appropriation does not exist', async () => {
    await expect(
      service.getAppropriationUsageSummary(ctx, 'non-existent')
    ).rejects.toThrow('Appropriation not found for tenant');
  });
});

// =============================================================================
// MULTI-TENANT ISOLATION TESTS
// =============================================================================

describe('PostgresFinanceService - Multi-Tenant Isolation', () => {
  let service: PostgresFinanceService;
  let ctxA: TenantContext;
  let ctxB: TenantContext;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new PostgresFinanceService(mockDb.db);
    ctxA = createTestContext('tenant-a');
    ctxB = createTestContext('tenant-b');
  });

  it('should isolate funds between tenants', async () => {
    await service.createFund(ctxA, { code: '0101', name: 'A General Fund', type: 'GENERAL' });
    await service.createFund(ctxB, { code: '0101', name: 'B General Fund', type: 'GENERAL' });

    const fundsA = await service.listFunds(ctxA);
    const fundsB = await service.listFunds(ctxB);

    expect(fundsA).toHaveLength(1);
    expect(fundsA[0].name).toBe('A General Fund');
    expect(fundsA[0].tenantId).toBe('tenant-a');

    expect(fundsB).toHaveLength(1);
    expect(fundsB[0].name).toBe('B General Fund');
    expect(fundsB[0].tenantId).toBe('tenant-b');
  });

  it('should not allow tenant A to access tenant B funds', async () => {
    const fundB = await service.createFund(ctxB, {
      code: '0101',
      name: 'B General Fund',
      type: 'GENERAL',
    });

    // Tenant A tries to get tenant B's fund
    const result = await service.getFund(ctxA, fundB.id);
    expect(result).toBeNull();
  });
});
