// src/engines/finance/__tests__/in-memory-finance.service.test.ts
//
// Tests for InMemoryFinanceService

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFinanceService } from '../in-memory-finance.service';
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

// =============================================================================
// FUND CRUD TESTS
// =============================================================================

describe('InMemoryFinanceService - Fund CRUD', () => {
  let service: InMemoryFinanceService;
  let ctx: TenantContext;

  beforeEach(() => {
    service = new InMemoryFinanceService();
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

  it('should update a fund', async () => {
    const fund = await service.createFund(ctx, {
      code: '0101',
      name: 'General Fund',
      type: 'GENERAL',
    });

    const updated = await service.updateFund(ctx, fund.id, {
      name: 'Updated General Fund',
      isActive: false,
    });

    expect(updated.name).toBe('Updated General Fund');
    expect(updated.isActive).toBe(false);
    expect(updated.type).toBe('GENERAL'); // unchanged
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

describe('InMemoryFinanceService - Account CRUD', () => {
  let service: InMemoryFinanceService;
  let ctx: TenantContext;

  beforeEach(() => {
    service = new InMemoryFinanceService();
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

  it('should list accounts with category filter', async () => {
    await service.createAccount(ctx, { code: '101.000', name: 'Cash', category: 'CASH' });
    await service.createAccount(ctx, { code: '401.000', name: 'Property Tax', category: 'REVENUE' });
    await service.createAccount(ctx, { code: '501.000', name: 'Salaries', category: 'EXPENDITURE' });

    const cashAccounts = await service.listAccounts(ctx, { category: 'CASH' });
    expect(cashAccounts).toHaveLength(1);
    expect(cashAccounts[0].code).toBe('101.000');

    const revenueAccounts = await service.listAccounts(ctx, { category: 'REVENUE' });
    expect(revenueAccounts).toHaveLength(1);
    expect(revenueAccounts[0].code).toBe('401.000');
  });

  it('should update an account', async () => {
    const account = await service.createAccount(ctx, {
      code: '101.000',
      name: 'Cash in Bank',
      category: 'CASH',
    });

    const updated = await service.updateAccount(ctx, account.id, {
      name: 'Operating Cash Account',
    });

    expect(updated.name).toBe('Operating Cash Account');
    expect(updated.category).toBe('CASH'); // unchanged
  });
});

// =============================================================================
// BALANCED TRANSACTION TESTS
// =============================================================================

describe('InMemoryFinanceService - Balanced Transactions', () => {
  let service: InMemoryFinanceService;
  let ctx: TenantContext;
  let fundId: string;
  let cashAccountId: string;
  let revenueAccountId: string;
  let expenditureAccountId: string;

  beforeEach(async () => {
    service = new InMemoryFinanceService();
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

describe('InMemoryFinanceService - Fund Balance Summary', () => {
  let service: InMemoryFinanceService;
  let ctx: TenantContext;
  let fundId: string;
  let cashAccountId: string;
  let revenueAccountId: string;
  let expenditureAccountId: string;

  beforeEach(async () => {
    service = new InMemoryFinanceService();
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

  it('should respect asOfDate cutoff', async () => {
    // Receipt in January
    await service.createTransaction(ctx, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'January receipt',
      lines: [
        { fundId, accountId: cashAccountId, amountCents: 100000, isDebit: true },
        { fundId, accountId: revenueAccountId, amountCents: 100000, isDebit: false },
      ],
    });

    // Receipt in March
    await service.createTransaction(ctx, {
      type: 'RECEIPT',
      transactionDate: '2025-03-15',
      description: 'March receipt',
      lines: [
        { fundId, accountId: cashAccountId, amountCents: 50000, isDebit: true },
        { fundId, accountId: revenueAccountId, amountCents: 50000, isDebit: false },
      ],
    });

    // Balance as of February (should only include January)
    const febSummary = await service.getFundBalanceSummary(ctx, fundId, '2025-02-28');
    expect(febSummary.cashBalanceCents).toBe(100000);

    // Balance as of December (should include both)
    const decSummary = await service.getFundBalanceSummary(ctx, fundId, '2025-12-31');
    expect(decSummary.cashBalanceCents).toBe(150000);
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

describe('InMemoryFinanceService - Appropriations', () => {
  let service: InMemoryFinanceService;
  let ctx: TenantContext;
  let fundId: string;
  let cashAccountId: string;
  let expenditureAccountId: string;

  beforeEach(async () => {
    service = new InMemoryFinanceService();
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

  it('should list appropriations with filters', async () => {
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

    const for2025 = await service.listAppropriations(ctx, { budgetYear: 2025 });
    expect(for2025).toHaveLength(1);
    expect(for2025[0].adoptedAmountCents).toBe(500000);
  });

  it('should update an appropriation', async () => {
    const appropriation = await service.createAppropriation(ctx, {
      fundId,
      accountId: expenditureAccountId,
      budgetYear: 2025,
      adoptedAmountCents: 500000,
    });

    const updated = await service.updateAppropriation(ctx, appropriation.id, {
      additionalAppropriationCents: 100000,
      ordinanceNumber: 'ORD-2025-005',
    });

    expect(updated.additionalAppropriationCents).toBe(100000);
    expect(updated.ordinanceNumber).toBe('ORD-2025-005');
  });
});

// =============================================================================
// APPROPRIATION USAGE SUMMARY TESTS
// =============================================================================

describe('InMemoryFinanceService - Appropriation Usage Summary', () => {
  let service: InMemoryFinanceService;
  let ctx: TenantContext;
  let fundId: string;
  let cashAccountId: string;
  let expenditureAccountId: string;
  let appropriationId: string;

  beforeEach(async () => {
    service = new InMemoryFinanceService();
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

  it('should only count expenditure lines linked to this appropriation', async () => {
    // Create another appropriation
    const otherAppropriationId = (
      await service.createAppropriation(ctx, {
        fundId,
        accountId: expenditureAccountId,
        budgetYear: 2025,
        adoptedAmountCents: 200000,
      })
    ).id;

    // Expenditure against our appropriation
    await service.createTransaction(ctx, {
      type: 'DISBURSEMENT',
      transactionDate: '2025-02-15',
      description: 'Our appropriation expense',
      lines: [
        {
          fundId,
          accountId: expenditureAccountId,
          amountCents: 50000,
          isDebit: true,
          appropriationId,
        },
        { fundId, accountId: cashAccountId, amountCents: 50000, isDebit: false },
      ],
    });

    // Expenditure against other appropriation
    await service.createTransaction(ctx, {
      type: 'DISBURSEMENT',
      transactionDate: '2025-02-20',
      description: 'Other appropriation expense',
      lines: [
        {
          fundId,
          accountId: expenditureAccountId,
          amountCents: 30000,
          isDebit: true,
          appropriationId: otherAppropriationId,
        },
        { fundId, accountId: cashAccountId, amountCents: 30000, isDebit: false },
      ],
    });

    const summary = await service.getAppropriationUsageSummary(ctx, appropriationId);

    // Only $500 should be counted for our appropriation
    expect(summary.expendedCents).toBe(50000);
    expect(summary.availableCents).toBe(500000); // 5500 - 500 = $5,000
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

describe('InMemoryFinanceService - Multi-Tenant Isolation', () => {
  let service: InMemoryFinanceService;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(() => {
    service = new InMemoryFinanceService();
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

  it('should isolate transactions between tenants', async () => {
    // Setup for tenant A
    const fundA = await service.createFund(ctxA, { code: '0101', name: 'Fund A', type: 'GENERAL' });
    const cashA = await service.createAccount(ctxA, { code: '101', name: 'Cash A', category: 'CASH' });
    const revA = await service.createAccount(ctxA, { code: '401', name: 'Rev A', category: 'REVENUE' });

    // Setup for tenant B
    const fundB = await service.createFund(ctxB, { code: '0101', name: 'Fund B', type: 'GENERAL' });
    const cashB = await service.createAccount(ctxB, { code: '101', name: 'Cash B', category: 'CASH' });
    const revB = await service.createAccount(ctxB, { code: '401', name: 'Rev B', category: 'REVENUE' });

    // Create transactions for both
    await service.createTransaction(ctxA, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'A Receipt',
      lines: [
        { fundId: fundA.id, accountId: cashA.id, amountCents: 10000, isDebit: true },
        { fundId: fundA.id, accountId: revA.id, amountCents: 10000, isDebit: false },
      ],
    });

    await service.createTransaction(ctxB, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'B Receipt',
      lines: [
        { fundId: fundB.id, accountId: cashB.id, amountCents: 20000, isDebit: true },
        { fundId: fundB.id, accountId: revB.id, amountCents: 20000, isDebit: false },
      ],
    });

    const txA = await service.listTransactions(ctxA);
    const txB = await service.listTransactions(ctxB);

    expect(txA).toHaveLength(1);
    expect(txA[0].description).toBe('A Receipt');

    expect(txB).toHaveLength(1);
    expect(txB[0].description).toBe('B Receipt');
  });

  it('should calculate separate fund balances per tenant', async () => {
    // Setup for tenant A
    const fundA = await service.createFund(ctxA, { code: '0101', name: 'Fund A', type: 'GENERAL' });
    const cashA = await service.createAccount(ctxA, { code: '101', name: 'Cash A', category: 'CASH' });
    const revA = await service.createAccount(ctxA, { code: '401', name: 'Rev A', category: 'REVENUE' });

    // Setup for tenant B
    const fundB = await service.createFund(ctxB, { code: '0101', name: 'Fund B', type: 'GENERAL' });
    const cashB = await service.createAccount(ctxB, { code: '101', name: 'Cash B', category: 'CASH' });
    const revB = await service.createAccount(ctxB, { code: '401', name: 'Rev B', category: 'REVENUE' });

    // Receipt for A: $100
    await service.createTransaction(ctxA, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'A Receipt',
      lines: [
        { fundId: fundA.id, accountId: cashA.id, amountCents: 10000, isDebit: true },
        { fundId: fundA.id, accountId: revA.id, amountCents: 10000, isDebit: false },
      ],
    });

    // Receipt for B: $200
    await service.createTransaction(ctxB, {
      type: 'RECEIPT',
      transactionDate: '2025-01-15',
      description: 'B Receipt',
      lines: [
        { fundId: fundB.id, accountId: cashB.id, amountCents: 20000, isDebit: true },
        { fundId: fundB.id, accountId: revB.id, amountCents: 20000, isDebit: false },
      ],
    });

    const summaryA = await service.getFundBalanceSummary(ctxA, fundA.id, '2025-12-31');
    const summaryB = await service.getFundBalanceSummary(ctxB, fundB.id, '2025-12-31');

    expect(summaryA.cashBalanceCents).toBe(10000);
    expect(summaryB.cashBalanceCents).toBe(20000);
  });
});
