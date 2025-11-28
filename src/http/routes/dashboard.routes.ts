// src/http/routes/dashboard.routes.ts
//
// REST API routes for the Tenant Dashboard and Finance Summary endpoints.
// Provides the "Clerk Cockpit" snapshot and Gateway-style fund summaries.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { TenantIdentity, StateTenantConfig } from '../../core/state';
import { FinanceRepository } from '../../core/finance/finance.repository';
import {
  buildTenantDashboardSnapshot,
  buildTenantDashboardSnapshotWithProviders,
} from '../../core/dashboard/dashboard.service';
import {
  getFinanceConfig,
  getGatewayFundSummaryForTenant,
} from '../../core/tenancy/domain-config.service';
import { buildForecast, getForecastSummary } from '../../core/finance/forecast/forecast.service';
import { SimpleForecastScenario } from '../../core/finance/forecast/forecast.types';
import { Fund, Transaction } from '../../core/finance/finance.types';
import {
  buildTenantContext,
  getTenantIdentityFromRequest,
  getDemoTenant,
} from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Dependencies for the dashboard router.
 */
export interface DashboardRouterDependencies {
  /** Finance repository for data access */
  financeRepo: FinanceRepository;
}

/**
 * Build a StateTenantConfig from request info.
 *
 * This is a helper for demo/development. In production, this would come
 * from a database or configuration service.
 *
 * @param tenantIdentity - Tenant identity from request
 * @param ctx - Tenant context from request
 * @returns StateTenantConfig for domain config resolution
 */
function buildStateTenantConfig(
  tenantIdentity: TenantIdentity,
  ctx: TenantContext
): StateTenantConfig {
  const demoTenant = getDemoTenant(tenantIdentity.tenantId);

  return {
    tenantId: tenantIdentity.tenantId,
    name: tenantIdentity.displayName,
    state: tenantIdentity.state as 'IN',
    jurisdiction: ctx.jurisdiction,
    dataStore: {
      vendor: 'memory',
      databaseName: `${tenantIdentity.tenantId}_db`,
    },
    // Enable all modules for demo purposes
    enabledModules: [
      { moduleId: 'finance', enabled: true },
      { moduleId: 'meetings', enabled: true },
      { moduleId: 'apra', enabled: true },
    ],
  };
}

/**
 * Create dashboard router with all endpoints.
 *
 * Endpoints:
 * - GET /api/dashboard - Full tenant dashboard snapshot
 * - GET /api/dashboard/finance - Finance section only
 * - GET /api/finance/fund-summary - Gateway-style fund summary export
 * - GET /api/finance/forecast - Baseline forecast preview
 *
 * @param deps - Service dependencies
 */
export function createDashboardRouter(deps: DashboardRouterDependencies): Router {
  const { financeRepo } = deps;
  const router = Router();

  // Middleware to attach tenant context to all routes
  router.use((req: Request, _res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // DASHBOARD ENDPOINTS
  // ===========================================================================

  /**
   * GET /
   * Get the full tenant dashboard snapshot.
   *
   * Returns the "Clerk Cockpit" view with Finance, Meetings, and APRA sections.
   *
   * Query params:
   * - asOf: ISO 8601 date for the snapshot (default: now)
   *
   * Headers:
   * - x-tenant-id: Tenant identifier (required for multi-tenant)
   * - x-tenant-state: State code (default: IN)
   * - x-tenant-entity-class: Entity class (default: TOWN)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const tenantIdentity = getTenantIdentityFromRequest(req);
      const tenantConfig = buildStateTenantConfig(tenantIdentity, ctx);

      // Parse asOf date from query or use current date
      let asOf = new Date();
      if (req.query.asOf) {
        const parsed = new Date(String(req.query.asOf));
        if (!isNaN(parsed.getTime())) {
          asOf = parsed;
        }
      }

      const snapshot = await buildTenantDashboardSnapshot(
        tenantConfig,
        tenantIdentity,
        financeRepo,
        { asOf }
      );

      res.json(snapshot);
    } catch (err) {
      handleError(res, err, 'building dashboard snapshot');
    }
  });

  /**
   * GET /finance
   * Get just the finance section of the dashboard.
   *
   * Lighter endpoint if you only need finance data.
   *
   * Query params:
   * - asOf: ISO 8601 date for the snapshot (default: now)
   * - keyFundCodes: Comma-separated list of fund codes to include
   */
  router.get('/finance', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const tenantIdentity = getTenantIdentityFromRequest(req);
      const tenantConfig = buildStateTenantConfig(tenantIdentity, ctx);

      // Parse asOf date
      let asOf = new Date();
      if (req.query.asOf) {
        const parsed = new Date(String(req.query.asOf));
        if (!isNaN(parsed.getTime())) {
          asOf = parsed;
        }
      }

      // Parse key fund codes if provided
      let keyFundCodes: string[] | undefined;
      if (req.query.keyFundCodes) {
        keyFundCodes = String(req.query.keyFundCodes).split(',').map((c) => c.trim());
      }

      // Build full snapshot but only return finance section
      const snapshot = await buildTenantDashboardSnapshot(
        tenantConfig,
        tenantIdentity,
        financeRepo,
        { asOf, keyFundCodes }
      );

      res.json({
        tenantId: snapshot.tenantId,
        tenantName: snapshot.tenantName,
        asOf: snapshot.asOf,
        finance: snapshot.finance,
      });
    } catch (err) {
      handleError(res, err, 'building finance dashboard section');
    }
  });

  return router;
}

/**
 * Create finance summary router with fund summary and forecast endpoints.
 *
 * These endpoints are mounted under /api/finance alongside the existing
 * finance ledger routes.
 *
 * Endpoints:
 * - GET /fund-summary - Gateway-style fund summary export
 * - GET /forecast - Baseline forecast preview
 *
 * @param deps - Service dependencies
 */
export function createFinanceSummaryRouter(deps: DashboardRouterDependencies): Router {
  const { financeRepo } = deps;
  const router = Router();

  // Middleware to attach tenant context
  router.use((req: Request, _res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // FUND SUMMARY ENDPOINT
  // ===========================================================================

  /**
   * GET /fund-summary
   * Get Gateway-style fund summary export.
   *
   * Returns a structured export similar to what would be submitted to
   * Indiana Gateway, with trial balance data for all funds.
   *
   * Query params:
   * - asOf: ISO 8601 date for the report (default: now)
   * - includeInactive: Include inactive funds (default: false)
   * - includeZeroActivity: Include funds with no activity (default: false)
   */
  router.get('/fund-summary', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const tenantIdentity = getTenantIdentityFromRequest(req);
      const tenantConfig = buildStateTenantConfig(tenantIdentity, ctx);

      // Parse asOf date
      let asOf = new Date();
      if (req.query.asOf) {
        const parsed = new Date(String(req.query.asOf));
        if (!isNaN(parsed.getTime())) {
          asOf = parsed;
        }
      }

      // Check if finance is enabled for this tenant
      const financeConfig = getFinanceConfig(tenantConfig, tenantIdentity);
      if (!financeConfig) {
        res.status(404).json({
          error: 'Finance module not enabled for this tenant',
        });
        return;
      }

      // Get Gateway fund summary using the domain config service
      const exportData = await getGatewayFundSummaryForTenant(
        financeRepo,
        tenantConfig,
        tenantIdentity,
        asOf
      );

      if (!exportData) {
        res.status(404).json({
          error: 'Gateway fund summary not available for this tenant/state',
        });
        return;
      }

      res.json(exportData);
    } catch (err) {
      handleError(res, err, 'building fund summary export');
    }
  });

  // ===========================================================================
  // FORECAST ENDPOINT
  // ===========================================================================

  /**
   * GET /forecast
   * Get a baseline forecast preview.
   *
   * Returns a simple 5-year forecast projection based on current fund
   * balances and default growth assumptions.
   *
   * Query params:
   * - asOf: ISO 8601 date for the forecast base (default: now)
   * - horizonYears: Number of years to project (default: 5, max: 10)
   * - revenueGrowth: Annual revenue growth rate (default: 0.02 = 2%)
   * - expenseGrowth: Annual expense growth rate (default: 0.02 = 2%)
   * - granularity: 'annual' or 'quarterly' (default: 'annual')
   */
  router.get('/forecast', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const tenantIdentity = getTenantIdentityFromRequest(req);

      // Parse asOf date
      let asOf = new Date();
      if (req.query.asOf) {
        const parsed = new Date(String(req.query.asOf));
        if (!isNaN(parsed.getTime())) {
          asOf = parsed;
        }
      }

      // Parse horizon years (default: 5, max: 10)
      let horizonYears = 5;
      if (req.query.horizonYears) {
        const parsed = parseInt(String(req.query.horizonYears), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
          horizonYears = parsed;
        }
      }

      // Parse growth rates (default: 2%)
      let revenueGrowth = 0.02;
      if (req.query.revenueGrowth) {
        const parsed = parseFloat(String(req.query.revenueGrowth));
        if (!isNaN(parsed) && parsed >= -0.5 && parsed <= 0.5) {
          revenueGrowth = parsed;
        }
      }

      let expenseGrowth = 0.02;
      if (req.query.expenseGrowth) {
        const parsed = parseFloat(String(req.query.expenseGrowth));
        if (!isNaN(parsed) && parsed >= -0.5 && parsed <= 0.5) {
          expenseGrowth = parsed;
        }
      }

      // Parse granularity
      let granularity: 'annual' | 'quarterly' = 'annual';
      if (req.query.granularity === 'quarterly') {
        granularity = 'quarterly';
      }

      // Load funds and transactions
      const fundsResult = await financeRepo.listFunds({
        tenantId: tenantIdentity.tenantId,
      });
      const funds: Fund[] = Array.isArray(fundsResult)
        ? fundsResult
        : fundsResult.items;

      const transactionsResult = await financeRepo.listTransactions({
        tenantId: tenantIdentity.tenantId,
        toDate: asOf,
      });
      const transactions: Transaction[] = Array.isArray(transactionsResult)
        ? transactionsResult
        : transactionsResult.items;

      // Build forecast scenario
      const scenario: SimpleForecastScenario = {
        id: 'API_BASELINE',
        name: 'API Baseline Forecast',
        description: `${horizonYears}-year baseline projection from ${asOf.toISOString().split('T')[0]}`,
        horizonYears,
        granularity,
        defaultRevenueGrowthRate: revenueGrowth,
        defaultExpenseGrowthRate: expenseGrowth,
      };

      // Build forecast
      const forecast = buildForecast(funds, transactions, asOf, scenario);

      // Get summary for quick overview
      const summary = getForecastSummary(forecast);

      res.json({
        summary,
        forecast,
      });
    } catch (err) {
      handleError(res, err, 'building forecast');
    }
  });

  return router;
}

/**
 * Handle errors and return appropriate HTTP status.
 */
function handleError(res: Response, err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : 'Unknown error';

  // Map known errors to HTTP status codes
  if (message.includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('not enabled')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('Invalid')) {
    res.status(400).json({ error: message });
    return;
  }

  // Log unexpected errors
  console.error(`[Dashboard API Error] Error ${context}:`, err);
  res.status(500).json({ error: `Failed ${context}: ${message}` });
}
