// src/http/routes/finance.routes.ts
//
// REST API routes for the Finance Ledger engine.
// Exposes fund accounting operations over HTTP.

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { FinanceService } from '../../engines/finance/finance.service';
import { InMemoryFinanceService } from '../../engines/finance/in-memory-finance.service';
import { PostgresFinanceService } from '../../engines/finance/postgres-finance.service';
import { TenantAwareDb } from '../../db/tenant-aware-db';
import {
  FundType,
  AccountCategory,
  FinanceTransactionType,
} from '../../engines/finance/finance.types';
import { getDefaultIndianaTownFunds } from '../../states/in/finance/in-finance-seed';
import { buildTenantContext } from '../context';

/**
 * Configuration for creating a Postgres-backed finance service.
 */
export interface PostgresFinanceConfig {
  /** Database connection pool */
  pool: Pool;
}

/**
 * Factory function to create a FinanceService based on environment configuration.
 *
 * If TIAB_USE_POSTGRES_FINANCE=true, creates a PostgresFinanceService.
 * Otherwise, creates an InMemoryFinanceService (default for tests).
 *
 * @param config - Optional configuration for Postgres backend
 * @returns A FinanceService instance
 */
export function createFinanceService(config?: PostgresFinanceConfig): FinanceService {
  if (process.env.TIAB_USE_POSTGRES_FINANCE === 'true' && config?.pool) {
    const db = new TenantAwareDb(config.pool);
    return new PostgresFinanceService(db);
  }
  return new InMemoryFinanceService();
}

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Dependencies for the finance router.
 */
export interface FinanceRouterDependencies {
  /** Finance service instance */
  finance: FinanceService;
}

/**
 * Create finance router with all endpoints.
 *
 * @param deps - Service dependencies (finance service, or creates new InMemoryFinanceService)
 */
export function createFinanceRouter(
  deps?: FinanceService | FinanceRouterDependencies
): Router {
  // Support both direct service and dependencies object
  const finance: FinanceService =
    deps === undefined
      ? new InMemoryFinanceService()
      : 'createFund' in deps
        ? (deps as FinanceService)
        : (deps as FinanceRouterDependencies).finance;

  const router = Router();

  // Middleware to attach tenant context to all routes
  router.use((req: Request, _res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // FUND ENDPOINTS
  // ===========================================================================

  /**
   * POST /funds
   * Create a new fund.
   */
  router.post('/funds', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.code) {
        res.status(400).json({ error: 'code is required' });
        return;
      }

      if (!req.body.name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      if (!req.body.type) {
        res.status(400).json({ error: 'type is required' });
        return;
      }

      const validTypes: FundType[] = [
        'GENERAL',
        'MVH',
        'LOCAL_ROAD_AND_STREET',
        'CUMULATIVE_CAPITAL_DEVELOPMENT',
        'DEBT_SERVICE',
        'RAINY_DAY',
        'UTILITY_OPERATING',
        'UTILITY_DEBT',
        'GRANT',
        'FIRE',
        'PARK',
        'CEMETERY',
        'TIF',
        'OTHER',
      ];

      if (!validTypes.includes(req.body.type)) {
        res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const fund = await finance.createFund(ctx, {
        code: req.body.code,
        name: req.body.name,
        type: req.body.type,
        isActive: req.body.isActive,
        sboaCode: req.body.sboaCode,
        dlgfFundNumber: req.body.dlgfFundNumber,
        isMajorFund: req.body.isMajorFund,
        description: req.body.description,
      });

      res.status(201).json(fund);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /funds
   * List all funds for the tenant.
   */
  router.get('/funds', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const funds = await finance.listFunds(ctx);
      res.json(funds);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /funds/:id
   * Get a fund by ID.
   */
  router.get('/funds/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const fund = await finance.getFund(ctx, req.params.id);

      if (!fund) {
        res.status(404).json({ error: 'Fund not found' });
        return;
      }

      res.json(fund);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PATCH /funds/:id
   * Update a fund.
   */
  router.patch('/funds/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      // Validate type if provided
      if (req.body.type !== undefined) {
        const validTypes: FundType[] = [
          'GENERAL',
          'MVH',
          'LOCAL_ROAD_AND_STREET',
          'CUMULATIVE_CAPITAL_DEVELOPMENT',
          'DEBT_SERVICE',
          'RAINY_DAY',
          'UTILITY_OPERATING',
          'UTILITY_DEBT',
          'GRANT',
          'FIRE',
          'PARK',
          'CEMETERY',
          'TIF',
          'OTHER',
        ];

        if (!validTypes.includes(req.body.type)) {
          res.status(400).json({
            error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          });
          return;
        }
      }

      const fund = await finance.updateFund(ctx, req.params.id, {
        name: req.body.name,
        type: req.body.type,
        isActive: req.body.isActive,
        sboaCode: req.body.sboaCode,
        dlgfFundNumber: req.body.dlgfFundNumber,
        isMajorFund: req.body.isMajorFund,
        description: req.body.description,
      });

      res.json(fund);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /funds/:id/summary
   * Get fund balance summary as of a specific date.
   */
  router.get('/funds/:id/summary', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.query.asOfDate) {
        res.status(400).json({ error: 'asOfDate query parameter is required' });
        return;
      }

      const asOfDate = String(req.query.asOfDate);

      // Basic date format validation (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
        res.status(400).json({
          error: 'asOfDate must be in YYYY-MM-DD format',
        });
        return;
      }

      const summary = await finance.getFundBalanceSummary(
        ctx,
        req.params.id,
        asOfDate
      );

      res.json(summary);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // ACCOUNT ENDPOINTS
  // ===========================================================================

  /**
   * POST /accounts
   * Create a new account.
   */
  router.post('/accounts', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.code) {
        res.status(400).json({ error: 'code is required' });
        return;
      }

      if (!req.body.name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      if (!req.body.category) {
        res.status(400).json({ error: 'category is required' });
        return;
      }

      const validCategories: AccountCategory[] = [
        'REVENUE',
        'EXPENDITURE',
        'CASH',
        'RECEIVABLE',
        'PAYABLE',
        'FUND_BALANCE',
        'OTHER',
      ];

      if (!validCategories.includes(req.body.category)) {
        res.status(400).json({
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        });
        return;
      }

      const account = await finance.createAccount(ctx, {
        code: req.body.code,
        name: req.body.name,
        category: req.body.category,
        isActive: req.body.isActive,
        sboaCode: req.body.sboaCode,
        description: req.body.description,
      });

      res.status(201).json(account);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /accounts
   * List accounts with optional category filter.
   */
  router.get('/accounts', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: { category?: AccountCategory; isActive?: boolean } = {};

      if (req.query.category) {
        filter.category = String(req.query.category) as AccountCategory;
      }

      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === 'true';
      }

      const accounts = await finance.listAccounts(ctx, filter);
      res.json(accounts);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /accounts/:id
   * Get an account by ID.
   */
  router.get('/accounts/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const account = await finance.getAccount(ctx, req.params.id);

      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      res.json(account);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // TRANSACTION ENDPOINTS
  // ===========================================================================

  /**
   * POST /transactions
   * Create a new transaction.
   * Transaction must be balanced (total debits = total credits).
   */
  router.post('/transactions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.type) {
        res.status(400).json({ error: 'type is required' });
        return;
      }

      const validTypes: FinanceTransactionType[] = [
        'RECEIPT',
        'DISBURSEMENT',
        'JOURNAL_ENTRY',
        'ADJUSTMENT',
      ];

      if (!validTypes.includes(req.body.type)) {
        res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      if (!req.body.transactionDate) {
        res.status(400).json({ error: 'transactionDate is required' });
        return;
      }

      if (!req.body.description) {
        res.status(400).json({ error: 'description is required' });
        return;
      }

      if (!req.body.lines || !Array.isArray(req.body.lines) || req.body.lines.length === 0) {
        res.status(400).json({ error: 'lines array is required and cannot be empty' });
        return;
      }

      const transaction = await finance.createTransaction(ctx, {
        type: req.body.type,
        transactionDate: req.body.transactionDate,
        reference: req.body.reference,
        description: req.body.description,
        lines: req.body.lines,
      });

      res.status(201).json(transaction);
    } catch (err) {
      // Check for unbalanced transaction error
      if (err instanceof Error && err.message.includes('not balanced')) {
        res.status(400).json({ error: 'Transaction is not balanced' });
        return;
      }
      handleError(res, err);
    }
  });

  /**
   * GET /transactions
   * List transactions with optional filters.
   */
  router.get('/transactions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: {
        fundId?: string;
        accountId?: string;
        fromDate?: string;
        toDate?: string;
        type?: FinanceTransactionType;
      } = {};

      if (req.query.fundId) {
        filter.fundId = String(req.query.fundId);
      }

      if (req.query.accountId) {
        filter.accountId = String(req.query.accountId);
      }

      if (req.query.fromDate) {
        filter.fromDate = String(req.query.fromDate);
      }

      if (req.query.toDate) {
        filter.toDate = String(req.query.toDate);
      }

      if (req.query.type) {
        filter.type = String(req.query.type) as FinanceTransactionType;
      }

      const transactions = await finance.listTransactions(ctx, filter);
      res.json(transactions);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /transactions/:id
   * Get a transaction by ID.
   */
  router.get('/transactions/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const transaction = await finance.getTransaction(ctx, req.params.id);

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.json(transaction);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // APPROPRIATION ENDPOINTS
  // ===========================================================================

  /**
   * POST /appropriations
   * Create a new appropriation.
   */
  router.post('/appropriations', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.fundId) {
        res.status(400).json({ error: 'fundId is required' });
        return;
      }

      if (!req.body.accountId) {
        res.status(400).json({ error: 'accountId is required' });
        return;
      }

      if (req.body.budgetYear === undefined) {
        res.status(400).json({ error: 'budgetYear is required' });
        return;
      }

      if (req.body.adoptedAmountCents === undefined) {
        res.status(400).json({ error: 'adoptedAmountCents is required' });
        return;
      }

      const appropriation = await finance.createAppropriation(ctx, {
        fundId: req.body.fundId,
        accountId: req.body.accountId,
        budgetYear: req.body.budgetYear,
        adoptedAmountCents: req.body.adoptedAmountCents,
        additionalAppropriationCents: req.body.additionalAppropriationCents,
        reductionsCents: req.body.reductionsCents,
        ordinanceNumber: req.body.ordinanceNumber,
        adoptedDate: req.body.adoptedDate,
      });

      res.status(201).json(appropriation);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /appropriations
   * List appropriations with optional filters.
   */
  router.get('/appropriations', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: {
        budgetYear?: number;
        fundId?: string;
        accountId?: string;
      } = {};

      if (req.query.budgetYear) {
        filter.budgetYear = parseInt(String(req.query.budgetYear), 10);
      }

      if (req.query.fundId) {
        filter.fundId = String(req.query.fundId);
      }

      if (req.query.accountId) {
        filter.accountId = String(req.query.accountId);
      }

      const appropriations = await finance.listAppropriations(ctx, filter);
      res.json(appropriations);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /appropriations/:id
   * Get an appropriation by ID.
   */
  router.get('/appropriations/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const appropriation = await finance.getAppropriation(ctx, req.params.id);

      if (!appropriation) {
        res.status(404).json({ error: 'Appropriation not found' });
        return;
      }

      res.json(appropriation);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /appropriations/:id/usage
   * Get appropriation usage summary.
   */
  router.get('/appropriations/:id/usage', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const summary = await finance.getAppropriationUsageSummary(
        ctx,
        req.params.id
      );

      res.json(summary);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // DEV/TEST ONLY - SEEDING ENDPOINT
  // ===========================================================================

  /**
   * POST /seed/default-indiana-town-funds
   *
   * DEV/TEST ONLY - Disable in production.
   *
   * Seeds the tenant with default Indiana town funds.
   * If funds already exist with the same code, they are skipped.
   */
  router.post('/seed/default-indiana-town-funds', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      // Get existing funds
      const existingFunds = await finance.listFunds(ctx);
      const existingCodes = new Set(existingFunds.map((f) => f.code));

      // Get default funds for this tenant
      const defaultFunds = getDefaultIndianaTownFunds(ctx.tenantId);

      // Create funds that don't already exist
      const createdFunds = [];
      for (const fund of defaultFunds) {
        if (!existingCodes.has(fund.code)) {
          const created = await finance.createFund(ctx, {
            code: fund.code,
            name: fund.name,
            type: fund.type,
            isActive: fund.isActive,
            sboaCode: fund.sboaCode,
            dlgfFundNumber: fund.dlgfFundNumber,
            isMajorFund: fund.isMajorFund,
            description: fund.description,
          });
          createdFunds.push(created);
        }
      }

      // Return all funds (existing + newly created)
      const allFunds = await finance.listFunds(ctx);

      res.status(201).json({
        message: `Seeded ${createdFunds.length} funds`,
        fundsCreated: createdFunds.length,
        totalFunds: allFunds.length,
        funds: allFunds,
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}

/**
 * Handle errors and return appropriate HTTP status.
 */
function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unknown error';

  // Map known errors to HTTP status codes
  if (message.includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('not balanced')) {
    res.status(400).json({ error: 'Transaction is not balanced' });
    return;
  }

  // Log unexpected errors
  console.error('API Error:', err);
  res.status(500).json({ error: message });
}
