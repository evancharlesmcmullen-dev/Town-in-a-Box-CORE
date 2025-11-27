// src/http/routes/fence-viewer.routes.ts
//
// REST API routes for the Fence Viewer engine.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FenceViewerService,
  FenceViewerCaseFilter,
} from '../../engines/fence-viewer/fence-viewer.service';
import {
  FenceViewerCaseStatus,
  FenceDisputeType,
} from '../../engines/fence-viewer/fence-viewer.types';
import { buildTenantContext, isTenantTownship } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create fence viewer router with all endpoints.
 *
 * @param fenceViewer - The fence viewer service instance
 */
export function createFenceViewerRouter(
  fenceViewer: FenceViewerService
): Router {
  const router = Router();

  // Middleware to attach tenant context and verify township
  router.use((req: Request, res: Response, next: NextFunction) => {
    const ctx = buildTenantContext(req);
    (req as ApiRequest).ctx = ctx;

    // Verify this is a township tenant
    if (!isTenantTownship(ctx.tenantId)) {
      res.status(403).json({
        error: 'Fence viewer services are only available for township tenants',
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // CASES
  // ===========================================================================

  /**
   * GET /api/township/fence-viewer/cases
   * List fence viewer cases with optional filters.
   */
  router.get('/cases', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: FenceViewerCaseFilter = {};

      if (req.query.status) {
        filter.status = String(req.query.status) as FenceViewerCaseStatus;
      }
      if (req.query.disputeType) {
        filter.disputeType = String(req.query.disputeType) as FenceDisputeType;
      }
      if (req.query.partyName) {
        filter.partyNameContains = String(req.query.partyName);
      }
      if (req.query.from) {
        filter.fromDate = new Date(String(req.query.from));
      }
      if (req.query.to) {
        filter.toDate = new Date(String(req.query.to));
      }

      const cases = await fenceViewer.listCases(ctx, filter);
      res.json(cases);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fence-viewer/cases
   * Create a new fence viewer case.
   */
  router.post('/cases', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.disputeType) {
        res.status(400).json({ error: 'disputeType is required' });
        return;
      }
      if (!req.body.fenceLocationDescription) {
        res.status(400).json({ error: 'fenceLocationDescription is required' });
        return;
      }

      const input = {
        disputeType: req.body.disputeType,
        fenceLocationDescription: req.body.fenceLocationDescription,
        petitionReceivedAt: req.body.petitionReceivedAt
          ? new Date(req.body.petitionReceivedAt)
          : undefined,
        notes: req.body.notes,
      };

      const caseData = await fenceViewer.createCase(ctx, input);
      res.status(201).json(caseData);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/fence-viewer/cases/:id
   * Get a single case by ID.
   */
  router.get('/cases/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const caseData = await fenceViewer.getCase(ctx, req.params.id);

      if (!caseData) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      res.json(caseData);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PATCH /api/township/fence-viewer/cases/:id
   * Update a case.
   */
  router.patch('/cases/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        disputeType: req.body.disputeType,
        status: req.body.status,
        fenceLocationDescription: req.body.fenceLocationDescription,
        scheduledInspectionAt: req.body.scheduledInspectionAt
          ? new Date(req.body.scheduledInspectionAt)
          : undefined,
        notes: req.body.notes,
      };

      const updated = await fenceViewer.updateCase(ctx, req.params.id, input);
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fence-viewer/cases/:id/schedule-inspection
   * Schedule an inspection for a case.
   */
  router.post(
    '/cases/:id/schedule-inspection',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.scheduledAt) {
          res.status(400).json({ error: 'scheduledAt is required' });
          return;
        }

        const updated = await fenceViewer.scheduleInspection(
          ctx,
          req.params.id,
          new Date(req.body.scheduledAt)
        );
        res.json(updated);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/township/fence-viewer/cases/:id/close
   * Close a case.
   */
  router.post('/cases/:id/close', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const updated = await fenceViewer.closeCase(
        ctx,
        req.params.id,
        req.body.reason
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // PARTIES
  // ===========================================================================

  /**
   * GET /api/township/fence-viewer/cases/:id/parties
   * List parties for a case.
   */
  router.get('/cases/:id/parties', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const parties = await fenceViewer.listPartiesForCase(ctx, req.params.id);
      res.json(parties);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fence-viewer/parties
   * Add a party to a case.
   */
  router.post('/parties', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.caseId) {
        res.status(400).json({ error: 'caseId is required' });
        return;
      }
      if (!req.body.name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      if (!req.body.role) {
        res.status(400).json({ error: 'role is required' });
        return;
      }

      const input = {
        caseId: req.body.caseId,
        name: req.body.name,
        role: req.body.role,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        phone: req.body.phone,
        email: req.body.email,
        parcelNumber: req.body.parcelNumber,
        parcelDescription: req.body.parcelDescription,
        notes: req.body.notes,
      };

      const party = await fenceViewer.addParty(ctx, input);
      res.status(201).json(party);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * DELETE /api/township/fence-viewer/parties/:id
   * Remove a party from a case.
   */
  router.delete('/parties/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      await fenceViewer.removeParty(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // INSPECTIONS
  // ===========================================================================

  /**
   * GET /api/township/fence-viewer/cases/:id/inspections
   * List inspections for a case.
   */
  router.get('/cases/:id/inspections', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const inspections = await fenceViewer.listInspectionsForCase(
        ctx,
        req.params.id
      );
      res.json(inspections);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fence-viewer/inspections
   * Record an inspection.
   */
  router.post('/inspections', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.caseId) {
        res.status(400).json({ error: 'caseId is required' });
        return;
      }
      if (!req.body.inspectionDate) {
        res.status(400).json({ error: 'inspectionDate is required' });
        return;
      }
      if (!req.body.inspectorName) {
        res.status(400).json({ error: 'inspectorName is required' });
        return;
      }
      if (!req.body.locationDescription) {
        res.status(400).json({ error: 'locationDescription is required' });
        return;
      }
      if (!req.body.findings) {
        res.status(400).json({ error: 'findings is required' });
        return;
      }

      const input = {
        caseId: req.body.caseId,
        inspectionDate: new Date(req.body.inspectionDate),
        inspectorName: req.body.inspectorName,
        locationDescription: req.body.locationDescription,
        currentFenceCondition: req.body.currentFenceCondition,
        measurements: req.body.measurements,
        photoAttachmentIds: req.body.photoAttachmentIds,
        findings: req.body.findings,
        recommendations: req.body.recommendations,
      };

      const inspection = await fenceViewer.recordInspection(ctx, input);
      res.status(201).json(inspection);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // DECISIONS
  // ===========================================================================

  /**
   * GET /api/township/fence-viewer/cases/:id/decision
   * Get the decision for a case.
   */
  router.get('/cases/:id/decision', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const decision = await fenceViewer.getDecisionForCase(ctx, req.params.id);

      if (!decision) {
        res.status(404).json({ error: 'No decision issued for this case' });
        return;
      }

      res.json(decision);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fence-viewer/decisions
   * Issue a decision for a case.
   */
  router.post('/decisions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.caseId) {
        res.status(400).json({ error: 'caseId is required' });
        return;
      }
      if (!req.body.issuedByName) {
        res.status(400).json({ error: 'issuedByName is required' });
        return;
      }
      if (req.body.petitionerSharePercent === undefined) {
        res.status(400).json({ error: 'petitionerSharePercent is required' });
        return;
      }
      if (req.body.respondentSharePercent === undefined) {
        res.status(400).json({ error: 'respondentSharePercent is required' });
        return;
      }
      if (!req.body.decisionNarrative) {
        res.status(400).json({ error: 'decisionNarrative is required' });
        return;
      }

      const input = {
        caseId: req.body.caseId,
        decisionDate: req.body.decisionDate
          ? new Date(req.body.decisionDate)
          : undefined,
        issuedByName: req.body.issuedByName,
        petitionerSharePercent: req.body.petitionerSharePercent,
        respondentSharePercent: req.body.respondentSharePercent,
        estimatedTotalCostCents: req.body.estimatedTotalCostCents,
        fenceTypeRequired: req.body.fenceTypeRequired,
        fenceLocationDescription: req.body.fenceLocationDescription,
        decisionNarrative: req.body.decisionNarrative,
        statutoryCitation: req.body.statutoryCitation,
        appealDeadlineDays: req.body.appealDeadlineDays,
      };

      const decision = await fenceViewer.issueDecision(ctx, input);
      res.status(201).json(decision);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/fence-viewer/cases/:id/appeal
   * Record that a decision has been appealed.
   */
  router.post('/cases/:id/appeal', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const updated = await fenceViewer.recordAppeal(
        ctx,
        req.params.id,
        req.body.appealOutcome
      );
      res.json(updated);
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
