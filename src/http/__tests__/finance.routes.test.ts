// src/http/__tests__/finance.routes.test.ts
// Integration tests for the Finance Ledger HTTP API.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createServer } from '../server';

// Use mock AI provider for tests
beforeAll(() => {
  process.env.AI_PROVIDER = 'mock';
});

describe('Finance API', () => {
  let app: Express;

  beforeEach(async () => {
    const server = await createServer();
    app = server.app;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FUND CRUD
  // ─────────────────────────────────────────────────────────────────────────

  describe('Fund CRUD', () => {
    describe('POST /api/finance/funds', () => {
      it('creates a fund with valid input', async () => {
        const res = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            name: 'General Fund',
            type: 'GENERAL',
          });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
          code: '0101',
          name: 'General Fund',
          type: 'GENERAL',
          isActive: true,
        });
        expect(res.body.id).toBeDefined();
      });

      it('creates a fund with all optional fields', async () => {
        const res = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0706',
            name: 'MVH Fund',
            type: 'MVH',
            isActive: true,
            sboaCode: 'MVH-001',
            dlgfFundNumber: '0706',
            isMajorFund: true,
            description: 'Motor Vehicle Highway fund',
          });

        expect(res.status).toBe(201);
        expect(res.body.sboaCode).toBe('MVH-001');
        expect(res.body.dlgfFundNumber).toBe('0706');
        expect(res.body.isMajorFund).toBe(true);
        expect(res.body.description).toBe('Motor Vehicle Highway fund');
      });

      it('returns 400 when code is missing', async () => {
        const res = await request(app)
          .post('/api/finance/funds')
          .send({
            name: 'General Fund',
            type: 'GENERAL',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('code');
      });

      it('returns 400 when name is missing', async () => {
        const res = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            type: 'GENERAL',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('name');
      });

      it('returns 400 when type is invalid', async () => {
        const res = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            name: 'General Fund',
            type: 'INVALID_TYPE',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid type');
      });
    });

    describe('GET /api/finance/funds', () => {
      it('returns empty array when no funds exist', async () => {
        const res = await request(app).get('/api/finance/funds');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });

      it('returns all funds for tenant', async () => {
        // Create two funds
        await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            name: 'General Fund',
            type: 'GENERAL',
          });

        await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0706',
            name: 'MVH Fund',
            type: 'MVH',
          });

        const res = await request(app).get('/api/finance/funds');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
      });
    });

    describe('GET /api/finance/funds/:id', () => {
      it('returns a fund by ID', async () => {
        const createRes = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            name: 'General Fund',
            type: 'GENERAL',
          });

        const fundId = createRes.body.id;

        const res = await request(app).get(`/api/finance/funds/${fundId}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(fundId);
        expect(res.body.name).toBe('General Fund');
      });

      it('returns 404 for non-existent fund', async () => {
        const res = await request(app).get('/api/finance/funds/non-existent-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('not found');
      });
    });

    describe('PATCH /api/finance/funds/:id', () => {
      it('updates fund name', async () => {
        const createRes = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            name: 'General Fund',
            type: 'GENERAL',
          });

        const fundId = createRes.body.id;

        const res = await request(app)
          .patch(`/api/finance/funds/${fundId}`)
          .send({
            name: 'Updated General Fund',
          });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated General Fund');
      });

      it('updates isActive status', async () => {
        const createRes = await request(app)
          .post('/api/finance/funds')
          .send({
            code: '0101',
            name: 'General Fund',
            type: 'GENERAL',
          });

        const fundId = createRes.body.id;

        const res = await request(app)
          .patch(`/api/finance/funds/${fundId}`)
          .send({
            isActive: false,
          });

        expect(res.status).toBe(200);
        expect(res.body.isActive).toBe(false);
      });

      it('returns 404 for non-existent fund', async () => {
        const res = await request(app)
          .patch('/api/finance/funds/non-existent-id')
          .send({
            name: 'Updated Name',
          });

        expect(res.status).toBe(404);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ACCOUNT CRUD
  // ─────────────────────────────────────────────────────────────────────────

  describe('Account CRUD', () => {
    describe('POST /api/finance/accounts', () => {
      it('creates an account with valid input', async () => {
        const res = await request(app)
          .post('/api/finance/accounts')
          .send({
            code: '101.000',
            name: 'Cash Account',
            category: 'CASH',
          });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
          code: '101.000',
          name: 'Cash Account',
          category: 'CASH',
          isActive: true,
        });
        expect(res.body.id).toBeDefined();
      });

      it('returns 400 when category is invalid', async () => {
        const res = await request(app)
          .post('/api/finance/accounts')
          .send({
            code: '101.000',
            name: 'Cash Account',
            category: 'INVALID_CATEGORY',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid category');
      });
    });

    describe('GET /api/finance/accounts', () => {
      it('returns accounts filtered by category', async () => {
        // Create multiple accounts
        await request(app)
          .post('/api/finance/accounts')
          .send({
            code: '101.000',
            name: 'Cash Account',
            category: 'CASH',
          });

        await request(app)
          .post('/api/finance/accounts')
          .send({
            code: '401.000',
            name: 'Revenue Account',
            category: 'REVENUE',
          });

        // Filter by CASH
        const res = await request(app)
          .get('/api/finance/accounts')
          .query({ category: 'CASH' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].category).toBe('CASH');
      });
    });

    describe('GET /api/finance/accounts/:id', () => {
      it('returns an account by ID', async () => {
        const createRes = await request(app)
          .post('/api/finance/accounts')
          .send({
            code: '101.000',
            name: 'Cash Account',
            category: 'CASH',
          });

        const accountId = createRes.body.id;

        const res = await request(app).get(`/api/finance/accounts/${accountId}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(accountId);
      });

      it('returns 404 for non-existent account', async () => {
        const res = await request(app).get('/api/finance/accounts/non-existent-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('not found');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSACTION CRUD + BALANCED ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────

  describe('Transaction CRUD', () => {
    let fundId: string;
    let cashAccountId: string;
    let revenueAccountId: string;
    let expenditureAccountId: string;

    beforeEach(async () => {
      // Create a fund
      const fundRes = await request(app)
        .post('/api/finance/funds')
        .send({
          code: '0101',
          name: 'General Fund',
          type: 'GENERAL',
        });
      fundId = fundRes.body.id;

      // Create accounts
      const cashRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '101.000',
          name: 'Cash Account',
          category: 'CASH',
        });
      cashAccountId = cashRes.body.id;

      const revenueRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '401.000',
          name: 'Revenue Account',
          category: 'REVENUE',
        });
      revenueAccountId = revenueRes.body.id;

      const expenditureRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '501.000',
          name: 'Expenditure Account',
          category: 'EXPENDITURE',
        });
      expenditureAccountId = expenditureRes.body.id;
    });

    describe('POST /api/finance/transactions', () => {
      it('creates a balanced transaction', async () => {
        const res = await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'RECEIPT',
            transactionDate: '2025-01-15',
            reference: 'REC-001',
            description: 'Property tax receipt',
            lines: [
              {
                fundId,
                accountId: cashAccountId,
                amountCents: 10000,
                isDebit: true,
              },
              {
                fundId,
                accountId: revenueAccountId,
                amountCents: 10000,
                isDebit: false,
              },
            ],
          });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.type).toBe('RECEIPT');
        expect(res.body.lines).toHaveLength(2);
      });

      it('returns 400 for unbalanced transaction', async () => {
        const res = await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'RECEIPT',
            transactionDate: '2025-01-15',
            description: 'Unbalanced transaction',
            lines: [
              {
                fundId,
                accountId: cashAccountId,
                amountCents: 10000,
                isDebit: true,
              },
              {
                fundId,
                accountId: revenueAccountId,
                amountCents: 5000, // Different amount - unbalanced!
                isDebit: false,
              },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('not balanced');
      });

      it('returns 400 when lines is empty', async () => {
        const res = await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'RECEIPT',
            transactionDate: '2025-01-15',
            description: 'Empty lines',
            lines: [],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('lines');
      });

      it('returns 400 when type is invalid', async () => {
        const res = await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'INVALID_TYPE',
            transactionDate: '2025-01-15',
            description: 'Test',
            lines: [
              {
                fundId,
                accountId: cashAccountId,
                amountCents: 1000,
                isDebit: true,
              },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid type');
      });
    });

    describe('GET /api/finance/transactions', () => {
      it('returns transactions filtered by fundId', async () => {
        // Create a transaction
        await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'RECEIPT',
            transactionDate: '2025-01-15',
            description: 'Test receipt',
            lines: [
              {
                fundId,
                accountId: cashAccountId,
                amountCents: 1000,
                isDebit: true,
              },
              {
                fundId,
                accountId: revenueAccountId,
                amountCents: 1000,
                isDebit: false,
              },
            ],
          });

        const res = await request(app)
          .get('/api/finance/transactions')
          .query({ fundId });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
      });

      it('returns transactions filtered by type', async () => {
        // Create receipt
        await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'RECEIPT',
            transactionDate: '2025-01-15',
            description: 'Receipt',
            lines: [
              { fundId, accountId: cashAccountId, amountCents: 1000, isDebit: true },
              { fundId, accountId: revenueAccountId, amountCents: 1000, isDebit: false },
            ],
          });

        // Create disbursement
        await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'DISBURSEMENT',
            transactionDate: '2025-01-16',
            description: 'Disbursement',
            lines: [
              { fundId, accountId: expenditureAccountId, amountCents: 500, isDebit: true },
              { fundId, accountId: cashAccountId, amountCents: 500, isDebit: false },
            ],
          });

        const res = await request(app)
          .get('/api/finance/transactions')
          .query({ type: 'RECEIPT' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].type).toBe('RECEIPT');
      });
    });

    describe('GET /api/finance/transactions/:id', () => {
      it('returns a transaction by ID', async () => {
        const createRes = await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'RECEIPT',
            transactionDate: '2025-01-15',
            description: 'Test receipt',
            lines: [
              { fundId, accountId: cashAccountId, amountCents: 1000, isDebit: true },
              { fundId, accountId: revenueAccountId, amountCents: 1000, isDebit: false },
            ],
          });

        const transactionId = createRes.body.id;

        const res = await request(app).get(`/api/finance/transactions/${transactionId}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(transactionId);
        expect(res.body.lines).toHaveLength(2);
      });

      it('returns 404 for non-existent transaction', async () => {
        const res = await request(app).get('/api/finance/transactions/non-existent-id');

        expect(res.status).toBe(404);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FUND BALANCE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  describe('Fund Balance Summary', () => {
    it('calculates cash balance from transactions', async () => {
      // Create fund
      const fundRes = await request(app)
        .post('/api/finance/funds')
        .send({
          code: '0101',
          name: 'General Fund',
          type: 'GENERAL',
        });
      const fundId = fundRes.body.id;

      // Create accounts
      const cashRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '101.000',
          name: 'Cash',
          category: 'CASH',
        });
      const cashAccountId = cashRes.body.id;

      const revenueRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '401.000',
          name: 'Revenue',
          category: 'REVENUE',
        });
      const revenueAccountId = revenueRes.body.id;

      // Create receipt transaction: debit CASH $100.00
      await request(app)
        .post('/api/finance/transactions')
        .send({
          type: 'RECEIPT',
          transactionDate: '2025-01-15',
          description: 'Receipt',
          lines: [
            { fundId, accountId: cashAccountId, amountCents: 10000, isDebit: true },
            { fundId, accountId: revenueAccountId, amountCents: 10000, isDebit: false },
          ],
        });

      // Get fund balance summary
      const res = await request(app)
        .get(`/api/finance/funds/${fundId}/summary`)
        .query({ asOfDate: '2025-01-31' });

      expect(res.status).toBe(200);
      expect(res.body.fundId).toBe(fundId);
      expect(res.body.asOfDate).toBe('2025-01-31');
      expect(res.body.cashBalanceCents).toBe(10000);
    });

    it('returns 400 when asOfDate is missing', async () => {
      const fundRes = await request(app)
        .post('/api/finance/funds')
        .send({
          code: '0101',
          name: 'General Fund',
          type: 'GENERAL',
        });

      const res = await request(app)
        .get(`/api/finance/funds/${fundRes.body.id}/summary`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('asOfDate');
    });

    it('returns 400 for invalid date format', async () => {
      const fundRes = await request(app)
        .post('/api/finance/funds')
        .send({
          code: '0101',
          name: 'General Fund',
          type: 'GENERAL',
        });

      const res = await request(app)
        .get(`/api/finance/funds/${fundRes.body.id}/summary`)
        .query({ asOfDate: 'invalid-date' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('YYYY-MM-DD');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // APPROPRIATION CRUD + USAGE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Appropriation CRUD and Usage', () => {
    let fundId: string;
    let expenditureAccountId: string;
    let cashAccountId: string;

    beforeEach(async () => {
      // Create fund and accounts
      const fundRes = await request(app)
        .post('/api/finance/funds')
        .send({
          code: '0101',
          name: 'General Fund',
          type: 'GENERAL',
        });
      fundId = fundRes.body.id;

      const expenditureRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '501.000',
          name: 'Expenditure',
          category: 'EXPENDITURE',
        });
      expenditureAccountId = expenditureRes.body.id;

      const cashRes = await request(app)
        .post('/api/finance/accounts')
        .send({
          code: '101.000',
          name: 'Cash',
          category: 'CASH',
        });
      cashAccountId = cashRes.body.id;
    });

    describe('POST /api/finance/appropriations', () => {
      it('creates an appropriation', async () => {
        const res = await request(app)
          .post('/api/finance/appropriations')
          .send({
            fundId,
            accountId: expenditureAccountId,
            budgetYear: 2025,
            adoptedAmountCents: 500000,
          });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.budgetYear).toBe(2025);
        expect(res.body.adoptedAmountCents).toBe(500000);
      });

      it('returns 400 when fundId is missing', async () => {
        const res = await request(app)
          .post('/api/finance/appropriations')
          .send({
            accountId: expenditureAccountId,
            budgetYear: 2025,
            adoptedAmountCents: 500000,
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('fundId');
      });
    });

    describe('GET /api/finance/appropriations', () => {
      it('filters by budgetYear', async () => {
        // Create appropriations for different years
        await request(app)
          .post('/api/finance/appropriations')
          .send({
            fundId,
            accountId: expenditureAccountId,
            budgetYear: 2025,
            adoptedAmountCents: 500000,
          });

        await request(app)
          .post('/api/finance/appropriations')
          .send({
            fundId,
            accountId: expenditureAccountId,
            budgetYear: 2024,
            adoptedAmountCents: 400000,
          });

        const res = await request(app)
          .get('/api/finance/appropriations')
          .query({ budgetYear: 2025 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].budgetYear).toBe(2025);
      });
    });

    describe('GET /api/finance/appropriations/:id/usage', () => {
      it('calculates appropriation usage from transactions', async () => {
        // Create appropriation
        const appRes = await request(app)
          .post('/api/finance/appropriations')
          .send({
            fundId,
            accountId: expenditureAccountId,
            budgetYear: 2025,
            adoptedAmountCents: 500000,
          });
        const appropriationId = appRes.body.id;

        // Create a disbursement transaction using this appropriation
        await request(app)
          .post('/api/finance/transactions')
          .send({
            type: 'DISBURSEMENT',
            transactionDate: '2025-01-15',
            description: 'Office supplies',
            lines: [
              {
                fundId,
                accountId: expenditureAccountId,
                amountCents: 10000,
                isDebit: true,
                appropriationId,
              },
              {
                fundId,
                accountId: cashAccountId,
                amountCents: 10000,
                isDebit: false,
              },
            ],
          });

        // Get usage summary
        const res = await request(app)
          .get(`/api/finance/appropriations/${appropriationId}/usage`);

        expect(res.status).toBe(200);
        expect(res.body.appropriationId).toBe(appropriationId);
        expect(res.body.adoptedAmountCents).toBe(500000);
        expect(res.body.expendedCents).toBe(10000);
        expect(res.body.availableCents).toBe(490000); // 500000 - 10000
      });

      it('returns 404 for non-existent appropriation', async () => {
        const res = await request(app)
          .get('/api/finance/appropriations/non-existent-id/usage');

        expect(res.status).toBe(404);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEV SEED ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────

  describe('Seed Endpoint', () => {
    it('seeds default Indiana town funds', async () => {
      const res = await request(app)
        .post('/api/finance/seed/default-indiana-town-funds');

      expect(res.status).toBe(201);
      expect(res.body.fundsCreated).toBeGreaterThan(0);
      expect(res.body.funds).toBeDefined();
      expect(res.body.funds.length).toBeGreaterThan(0);

      // Verify we have expected funds
      const funds = res.body.funds;
      const codes = funds.map((f: { code: string }) => f.code);
      expect(codes).toContain('0101'); // General Fund
      expect(codes).toContain('0706'); // MVH
    });

    it('does not duplicate funds on multiple calls', async () => {
      // Seed once
      const first = await request(app)
        .post('/api/finance/seed/default-indiana-town-funds');

      // Seed again
      const second = await request(app)
        .post('/api/finance/seed/default-indiana-town-funds');

      expect(second.status).toBe(201);
      expect(second.body.fundsCreated).toBe(0); // No new funds created
      expect(second.body.totalFunds).toBe(first.body.totalFunds);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MULTI-TENANT ISOLATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Multi-tenant isolation', () => {
    it('isolates funds between tenants', async () => {
      // Create fund as tenant A
      const fundA = await request(app)
        .post('/api/finance/funds')
        .set('x-tenant-id', 'tenant-a')
        .send({
          code: '0101',
          name: 'General Fund A',
          type: 'GENERAL',
        });

      // Create fund as tenant B
      await request(app)
        .post('/api/finance/funds')
        .set('x-tenant-id', 'tenant-b')
        .send({
          code: '0101',
          name: 'General Fund B',
          type: 'GENERAL',
        });

      // List as tenant A
      const listA = await request(app)
        .get('/api/finance/funds')
        .set('x-tenant-id', 'tenant-a');

      expect(listA.body).toHaveLength(1);
      expect(listA.body[0].name).toBe('General Fund A');

      // Tenant B cannot access tenant A's fund
      const getB = await request(app)
        .get(`/api/finance/funds/${fundA.body.id}`)
        .set('x-tenant-id', 'tenant-b');

      expect(getB.status).toBe(404);
    });

    it('isolates accounts between tenants', async () => {
      // Create account as tenant A
      const accountA = await request(app)
        .post('/api/finance/accounts')
        .set('x-tenant-id', 'tenant-a')
        .send({
          code: '101.000',
          name: 'Cash A',
          category: 'CASH',
        });

      // Create account as tenant B
      await request(app)
        .post('/api/finance/accounts')
        .set('x-tenant-id', 'tenant-b')
        .send({
          code: '101.000',
          name: 'Cash B',
          category: 'CASH',
        });

      // List as tenant A
      const listA = await request(app)
        .get('/api/finance/accounts')
        .set('x-tenant-id', 'tenant-a');

      expect(listA.body).toHaveLength(1);
      expect(listA.body[0].name).toBe('Cash A');

      // Tenant B cannot access tenant A's account
      const getB = await request(app)
        .get(`/api/finance/accounts/${accountA.body.id}`)
        .set('x-tenant-id', 'tenant-b');

      expect(getB.status).toBe(404);
    });

    it('isolates transactions between tenants', async () => {
      // Setup tenant A with fund, accounts, and transaction
      const fundA = await request(app)
        .post('/api/finance/funds')
        .set('x-tenant-id', 'tenant-a')
        .send({
          code: '0101',
          name: 'General Fund A',
          type: 'GENERAL',
        });

      const cashA = await request(app)
        .post('/api/finance/accounts')
        .set('x-tenant-id', 'tenant-a')
        .send({
          code: '101.000',
          name: 'Cash A',
          category: 'CASH',
        });

      const revenueA = await request(app)
        .post('/api/finance/accounts')
        .set('x-tenant-id', 'tenant-a')
        .send({
          code: '401.000',
          name: 'Revenue A',
          category: 'REVENUE',
        });

      const txA = await request(app)
        .post('/api/finance/transactions')
        .set('x-tenant-id', 'tenant-a')
        .send({
          type: 'RECEIPT',
          transactionDate: '2025-01-15',
          description: 'Tenant A transaction',
          lines: [
            { fundId: fundA.body.id, accountId: cashA.body.id, amountCents: 1000, isDebit: true },
            { fundId: fundA.body.id, accountId: revenueA.body.id, amountCents: 1000, isDebit: false },
          ],
        });

      // List transactions as tenant A
      const listA = await request(app)
        .get('/api/finance/transactions')
        .set('x-tenant-id', 'tenant-a');

      expect(listA.body).toHaveLength(1);

      // List transactions as tenant B - should be empty
      const listB = await request(app)
        .get('/api/finance/transactions')
        .set('x-tenant-id', 'tenant-b');

      expect(listB.body).toHaveLength(0);

      // Tenant B cannot access tenant A's transaction
      const getB = await request(app)
        .get(`/api/finance/transactions/${txA.body.id}`)
        .set('x-tenant-id', 'tenant-b');

      expect(getB.status).toBe(404);
    });
  });
});
