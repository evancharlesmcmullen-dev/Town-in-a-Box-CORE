// src/http/routes/cemeteries.routes.ts
//
// REST API routes for the Cemetery engine.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  CemeteryService,
  CemeteryFilter,
} from '../../engines/cemeteries/cemetery.service';
import { CemeteryStatus } from '../../engines/cemeteries/cemetery.types';
import { buildTenantContext, isTenantTownship } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create cemeteries router with all endpoints.
 *
 * @param cemetery - The cemetery service instance
 */
export function createCemeteriesRouter(cemetery: CemeteryService): Router {
  const router = Router();

  // Middleware to attach tenant context and verify township
  router.use((req: Request, res: Response, next: NextFunction) => {
    const ctx = buildTenantContext(req);
    (req as ApiRequest).ctx = ctx;

    // Verify this is a township tenant
    if (!isTenantTownship(ctx.tenantId)) {
      res.status(403).json({
        error: 'Cemetery management is only available for township tenants',
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // CEMETERIES
  // ===========================================================================

  /**
   * GET /api/township/cemeteries
   * List cemeteries with optional filters.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: CemeteryFilter = {};

      if (req.query.status) {
        filter.status = String(req.query.status) as CemeteryStatus;
      }
      if (req.query.name) {
        filter.nameContains = String(req.query.name);
      }

      const cemeteries = await cemetery.listCemeteries(ctx, filter);
      res.json(cemeteries);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/cemeteries/:id
   * Get a single cemetery by ID.
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const cem = await cemetery.getCemetery(ctx, req.params.id);

      if (!cem) {
        res.status(404).json({ error: 'Cemetery not found' });
        return;
      }

      res.json(cem);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/cemeteries
   * Create or update a cemetery.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const cem = await cemetery.upsertCemetery(ctx, {
        id: req.body.id,
        tenantId: ctx.tenantId,
        name: req.body.name,
        status: req.body.status || 'active',
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        notes: req.body.notes,
      });

      res.status(201).json(cem);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/township/cemeteries/:id
   * Update a cemetery.
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      // Get existing to preserve data
      const existing = await cemetery.getCemetery(ctx, req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Cemetery not found' });
        return;
      }

      const cem = await cemetery.upsertCemetery(ctx, {
        ...existing,
        name: req.body.name ?? existing.name,
        status: req.body.status ?? existing.status,
        addressLine1: req.body.addressLine1 ?? existing.addressLine1,
        addressLine2: req.body.addressLine2 ?? existing.addressLine2,
        city: req.body.city ?? existing.city,
        state: req.body.state ?? existing.state,
        postalCode: req.body.postalCode ?? existing.postalCode,
        latitude: req.body.latitude ?? existing.latitude,
        longitude: req.body.longitude ?? existing.longitude,
        notes: req.body.notes ?? existing.notes,
      });

      res.json(cem);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // MAINTENANCE
  // ===========================================================================

  /**
   * GET /api/township/cemeteries/:id/maintenance
   * List maintenance logs for a cemetery.
   */
  router.get('/:id/maintenance', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const logs = await cemetery.listMaintenanceLogsForCemetery(
        ctx,
        req.params.id
      );
      res.json(logs);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/cemeteries/:id/maintenance
   * Add a maintenance log entry.
   */
  router.post('/:id/maintenance', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.description) {
        res.status(400).json({ error: 'description is required' });
        return;
      }

      const log = await cemetery.addMaintenanceLog(ctx, {
        id: req.body.id,
        tenantId: ctx.tenantId,
        cemeteryId: req.params.id,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        description: req.body.description,
        performedBy: req.body.performedBy,
      });

      res.status(201).json(log);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // PLOTS
  // ===========================================================================

  /**
   * GET /api/township/cemeteries/:id/plots
   * List plots for a cemetery.
   */
  router.get('/:id/plots', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const plots = await cemetery.listPlotsForCemetery(ctx, req.params.id);
      res.json(plots);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/cemeteries/:id/plots
   * Create or update a plot.
   */
  router.post('/:id/plots', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const plot = await cemetery.upsertPlot(ctx, {
        id: req.body.id,
        tenantId: ctx.tenantId,
        cemeteryId: req.params.id,
        section: req.body.section,
        lot: req.body.lot,
        grave: req.body.grave,
        deedHolderName: req.body.deedHolderName,
        deedIssuedAt: req.body.deedIssuedAt
          ? new Date(req.body.deedIssuedAt)
          : undefined,
        notes: req.body.notes,
      });

      res.status(201).json(plot);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // BURIALS
  // ===========================================================================

  /**
   * GET /api/township/plots/:plotId/burials
   * List burials for a plot.
   */
  router.get('/plots/:plotId/burials', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const burials = await cemetery.listBurialsForPlot(ctx, req.params.plotId);
      res.json(burials);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/plots/:plotId/burials
   * Record a burial.
   */
  router.post('/plots/:plotId/burials', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.decedentName) {
        res.status(400).json({ error: 'decedentName is required' });
        return;
      }

      const burial = await cemetery.upsertBurial(ctx, {
        id: req.body.id,
        tenantId: ctx.tenantId,
        plotId: req.params.plotId,
        decedentName: req.body.decedentName,
        dateOfBirth: req.body.dateOfBirth
          ? new Date(req.body.dateOfBirth)
          : undefined,
        dateOfDeath: req.body.dateOfDeath
          ? new Date(req.body.dateOfDeath)
          : undefined,
        burialDate: req.body.burialDate
          ? new Date(req.body.burialDate)
          : undefined,
        veteran: req.body.veteran,
        notes: req.body.notes,
      });

      res.status(201).json(burial);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/cemeteries/burials/search
   * Search burials by decedent name.
   */
  router.get('/burials/search', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.query.name) {
        res.status(400).json({ error: 'name query parameter is required' });
        return;
      }

      const burials = await cemetery.searchBurialsByName(
        ctx,
        String(req.query.name)
      );
      res.json(burials);
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

  if (message.includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  console.error('API Error:', err);
  res.status(500).json({ error: message });
}
