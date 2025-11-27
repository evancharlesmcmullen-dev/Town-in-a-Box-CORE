// src/http/routes/fire-contracts.routes.ts
//
// REST API routes for the Fire Contract engine.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FireContractService,
  FireContractFilter,
} from '../../engines/fire/fire-contract.service';
import { buildTenantContext, isTenantTownship } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create fire contracts router with all endpoints.
 *
 * @param fireContract - The fire contract service instance
 */
export function createFireContractsRouter(
  fireContract: FireContractService
): Router {
  const router = Router();

  // Middleware to attach tenant context and verify township
  router.use((req: Request, res: Response, next: NextFunction) => {
    const ctx = buildTenantContext(req);
    (req as ApiRequest).ctx = ctx;

    // Verify this is a township tenant
    if (!isTenantTownship(ctx.tenantId)) {
      res.status(403).json({
        error: 'Fire contract management is only available for township tenants',
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // CONTRACTS
  // ===========================================================================

  /**
   * GET /api/township/fire/contracts
   * List fire service contracts with optional filters.
   */
  router.get('/contracts', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: FireContractFilter = {};

      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === 'true';
      }
      if (req.query.provider) {
        filter.providerNameContains = String(req.query.provider);
      }

      const contracts = await fireContract.listContracts(ctx, filter);
      res.json(contracts);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/fire/contracts/:id
   * Get a single contract by ID.
   */
  router.get('/contracts/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const contract = await fireContract.getContract(ctx, req.params.id);

      if (!contract) {
        res.status(404).json({ error: 'Contract not found' });
        return;
      }

      res.json(contract);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fire/contracts
   * Create or update a fire service contract.
   */
  router.post('/contracts', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.providerName) {
        res.status(400).json({ error: 'providerName is required' });
        return;
      }
      if (!req.body.coverageDescription) {
        res.status(400).json({ error: 'coverageDescription is required' });
        return;
      }
      if (!req.body.startDate) {
        res.status(400).json({ error: 'startDate is required' });
        return;
      }
      if (req.body.annualCostCents === undefined) {
        res.status(400).json({ error: 'annualCostCents is required' });
        return;
      }
      if (!req.body.fundId) {
        res.status(400).json({ error: 'fundId is required' });
        return;
      }

      const input = {
        id: req.body.id,
        providerName: req.body.providerName,
        coverageDescription: req.body.coverageDescription,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        annualCostCents: req.body.annualCostCents,
        fundId: req.body.fundId,
        renewalNoticeDays: req.body.renewalNoticeDays || 90,
        notes: req.body.notes,
        isActive: req.body.isActive ?? true,
      };

      const contract = await fireContract.upsertContract(ctx, input);
      res.status(req.body.id ? 200 : 201).json(contract);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/township/fire/contracts/:id
   * Update a fire service contract.
   */
  router.put('/contracts/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      // Get existing
      const existing = await fireContract.getContract(ctx, req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Contract not found' });
        return;
      }

      const input = {
        id: req.params.id,
        providerName: req.body.providerName ?? existing.providerName,
        coverageDescription:
          req.body.coverageDescription ?? existing.coverageDescription,
        startDate: req.body.startDate
          ? new Date(req.body.startDate)
          : existing.startDate,
        endDate: req.body.endDate
          ? new Date(req.body.endDate)
          : existing.endDate,
        annualCostCents: req.body.annualCostCents ?? existing.annualCostCents,
        fundId: req.body.fundId ?? existing.fundId,
        renewalNoticeDays:
          req.body.renewalNoticeDays ?? existing.renewalNoticeDays,
        notes: req.body.notes ?? existing.notes,
        isActive: req.body.isActive ?? existing.isActive,
      };

      const contract = await fireContract.upsertContract(ctx, input);
      res.json(contract);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // PERFORMANCE
  // ===========================================================================

  /**
   * GET /api/township/fire/contracts/:id/performance
   * List performance snapshots for a contract.
   */
  router.get('/contracts/:id/performance', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const snapshots = await fireContract.listPerformanceSnapshots(
        ctx,
        req.params.id
      );
      res.json(snapshots);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fire/contracts/:id/performance
   * Record a performance snapshot.
   */
  router.post(
    '/contracts/:id/performance',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.periodStart) {
          res.status(400).json({ error: 'periodStart is required' });
          return;
        }
        if (!req.body.periodEnd) {
          res.status(400).json({ error: 'periodEnd is required' });
          return;
        }

        const snapshot = await fireContract.recordPerformanceSnapshot(ctx, {
          id: req.body.id,
          tenantId: ctx.tenantId,
          contractId: req.params.id,
          periodStart: new Date(req.body.periodStart),
          periodEnd: new Date(req.body.periodEnd),
          runs: req.body.runs || 0,
          averageResponseMinutes: req.body.averageResponseMinutes,
          notes: req.body.notes,
        });

        res.status(201).json(snapshot);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  return router;
}

/**
 * Handle errors and return appropriate HTTP status.
 */
function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unknown error';

  if (message.includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  console.error('API Error:', err);
  res.status(500).json({ error: message });
}
