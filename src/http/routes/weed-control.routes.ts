// src/http/routes/weed-control.routes.ts
//
// REST API routes for the Weed Control engine.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  WeedControlService,
  WeedComplaintFilter,
} from '../../engines/weed-control/weed-control.service';
import {
  WeedControlCaseStatus,
  WeedViolationType,
} from '../../engines/weed-control/weed-control.types';
import { buildTenantContext, isTenantTownship } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create weed control router with all endpoints.
 *
 * @param weedControl - The weed control service instance
 */
export function createWeedControlRouter(
  weedControl: WeedControlService
): Router {
  const router = Router();

  // Middleware to attach tenant context and verify township
  router.use((req: Request, res: Response, next: NextFunction) => {
    const ctx = buildTenantContext(req);
    (req as ApiRequest).ctx = ctx;

    // Verify this is a township tenant
    if (!isTenantTownship(ctx.tenantId)) {
      res.status(403).json({
        error: 'Weed control services are only available for township tenants',
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // COMPLAINTS
  // ===========================================================================

  /**
   * GET /api/township/weed-control/complaints
   * List weed complaints with optional filters.
   */
  router.get('/complaints', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: WeedComplaintFilter = {};

      if (req.query.status) {
        filter.status = String(req.query.status) as WeedControlCaseStatus;
      }
      if (req.query.violationType) {
        filter.violationType = String(req.query.violationType) as WeedViolationType;
      }
      if (req.query.propertyOwner) {
        filter.propertyOwnerNameContains = String(req.query.propertyOwner);
      }
      if (req.query.siteAddress) {
        filter.siteAddressContains = String(req.query.siteAddress);
      }
      if (req.query.from) {
        filter.fromDate = new Date(String(req.query.from));
      }
      if (req.query.to) {
        filter.toDate = new Date(String(req.query.to));
      }
      if (req.query.overdue === 'true') {
        filter.hasOverdueDeadline = true;
      }

      const complaints = await weedControl.listComplaints(ctx, filter);
      res.json(complaints);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/complaints
   * Create a new weed complaint.
   */
  router.post('/complaints', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.violationType) {
        res.status(400).json({ error: 'violationType is required' });
        return;
      }
      if (!req.body.violationDescription) {
        res.status(400).json({ error: 'violationDescription is required' });
        return;
      }

      const input = {
        violationType: req.body.violationType,
        violationDescription: req.body.violationDescription,
        complainantName: req.body.complainantName,
        complainantPhone: req.body.complainantPhone,
        complainantEmail: req.body.complainantEmail,
        isAnonymous: req.body.isAnonymous,
        propertyOwnerName: req.body.propertyOwnerName,
        propertyOwnerAddressLine1: req.body.propertyOwnerAddressLine1,
        propertyOwnerAddressLine2: req.body.propertyOwnerAddressLine2,
        propertyOwnerCity: req.body.propertyOwnerCity,
        propertyOwnerState: req.body.propertyOwnerState,
        propertyOwnerPostalCode: req.body.propertyOwnerPostalCode,
        siteAddressLine1: req.body.siteAddressLine1,
        siteAddressLine2: req.body.siteAddressLine2,
        siteCity: req.body.siteCity,
        siteState: req.body.siteState,
        sitePostalCode: req.body.sitePostalCode,
        parcelNumber: req.body.parcelNumber,
        notes: req.body.notes,
      };

      const complaint = await weedControl.createComplaint(ctx, input);
      res.status(201).json(complaint);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/weed-control/complaints/:id
   * Get a single complaint by ID.
   */
  router.get('/complaints/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const complaint = await weedControl.getComplaint(ctx, req.params.id);

      if (!complaint) {
        res.status(404).json({ error: 'Complaint not found' });
        return;
      }

      res.json(complaint);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PATCH /api/township/weed-control/complaints/:id
   * Update a complaint.
   */
  router.patch('/complaints/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        violationType: req.body.violationType,
        status: req.body.status,
        violationDescription: req.body.violationDescription,
        propertyOwnerName: req.body.propertyOwnerName,
        propertyOwnerAddressLine1: req.body.propertyOwnerAddressLine1,
        propertyOwnerAddressLine2: req.body.propertyOwnerAddressLine2,
        propertyOwnerCity: req.body.propertyOwnerCity,
        propertyOwnerState: req.body.propertyOwnerState,
        propertyOwnerPostalCode: req.body.propertyOwnerPostalCode,
        abatementDeadlineAt: req.body.abatementDeadlineAt
          ? new Date(req.body.abatementDeadlineAt)
          : undefined,
        notes: req.body.notes,
      };

      const updated = await weedControl.updateComplaint(ctx, req.params.id, input);
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/complaints/:id/comply
   * Mark a complaint as complied.
   */
  router.post('/complaints/:id/comply', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const updated = await weedControl.markComplied(
        ctx,
        req.params.id,
        req.body.notes
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/complaints/:id/close
   * Close a complaint.
   */
  router.post('/complaints/:id/close', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const updated = await weedControl.closeComplaint(
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
  // NOTICES
  // ===========================================================================

  /**
   * GET /api/township/weed-control/complaints/:id/notices
   * List notices for a complaint.
   */
  router.get('/complaints/:id/notices', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const notices = await weedControl.listNoticesForComplaint(
        ctx,
        req.params.id
      );
      res.json(notices);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/notices
   * Send a notice to the property owner.
   */
  router.post('/notices', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.complaintId) {
        res.status(400).json({ error: 'complaintId is required' });
        return;
      }
      if (!req.body.noticeType) {
        res.status(400).json({ error: 'noticeType is required' });
        return;
      }
      if (!req.body.deliveryMethod) {
        res.status(400).json({ error: 'deliveryMethod is required' });
        return;
      }
      if (!req.body.sentToName) {
        res.status(400).json({ error: 'sentToName is required' });
        return;
      }
      if (!req.body.sentToAddress) {
        res.status(400).json({ error: 'sentToAddress is required' });
        return;
      }
      if (!req.body.complianceDeadlineDays) {
        res.status(400).json({ error: 'complianceDeadlineDays is required' });
        return;
      }

      const input = {
        complaintId: req.body.complaintId,
        noticeType: req.body.noticeType,
        deliveryMethod: req.body.deliveryMethod,
        sentToName: req.body.sentToName,
        sentToAddress: req.body.sentToAddress,
        complianceDeadlineDays: req.body.complianceDeadlineDays,
        noticeContent: req.body.noticeContent,
        statutoryCitation: req.body.statutoryCitation,
        trackingNumber: req.body.trackingNumber,
      };

      const notice = await weedControl.sendNotice(ctx, input);
      res.status(201).json(notice);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/notices/:id/delivered
   * Record that a notice was delivered.
   */
  router.post('/notices/:id/delivered', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.deliveredAt) {
        res.status(400).json({ error: 'deliveredAt is required' });
        return;
      }

      const updated = await weedControl.recordNoticeDelivery(
        ctx,
        req.params.id,
        new Date(req.body.deliveredAt)
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/notices/:id/returned
   * Record that a notice was returned undeliverable.
   */
  router.post('/notices/:id/returned', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const updated = await weedControl.recordNoticeReturned(ctx, req.params.id);
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // INSPECTIONS
  // ===========================================================================

  /**
   * GET /api/township/weed-control/complaints/:id/inspections
   * List inspections for a complaint.
   */
  router.get(
    '/complaints/:id/inspections',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const inspections = await weedControl.listInspectionsForComplaint(
          ctx,
          req.params.id
        );
        res.json(inspections);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/township/weed-control/inspections
   * Record an inspection.
   */
  router.post('/inspections', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.complaintId) {
        res.status(400).json({ error: 'complaintId is required' });
        return;
      }
      if (!req.body.inspectorName) {
        res.status(400).json({ error: 'inspectorName is required' });
        return;
      }
      if (req.body.isCompliant === undefined) {
        res.status(400).json({ error: 'isCompliant is required' });
        return;
      }
      if (!req.body.findingsDescription) {
        res.status(400).json({ error: 'findingsDescription is required' });
        return;
      }

      const input = {
        complaintId: req.body.complaintId,
        inspectionDate: req.body.inspectionDate
          ? new Date(req.body.inspectionDate)
          : undefined,
        inspectorName: req.body.inspectorName,
        isCompliant: req.body.isCompliant,
        findingsDescription: req.body.findingsDescription,
        photoAttachmentIds: req.body.photoAttachmentIds,
      };

      const inspection = await weedControl.recordInspection(ctx, input);
      res.status(201).json(inspection);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // ABATEMENT
  // ===========================================================================

  /**
   * GET /api/township/weed-control/complaints/:id/abatement
   * Get abatement record for a complaint.
   */
  router.get(
    '/complaints/:id/abatement',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const abatement = await weedControl.getAbatementForComplaint(
          ctx,
          req.params.id
        );

        if (!abatement) {
          res.status(404).json({ error: 'No abatement record for this complaint' });
          return;
        }

        res.json(abatement);
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/township/weed-control/abatements
   * Record abatement performed by the township.
   */
  router.post('/abatements', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.complaintId) {
        res.status(400).json({ error: 'complaintId is required' });
        return;
      }
      if (!req.body.performedBy) {
        res.status(400).json({ error: 'performedBy is required' });
        return;
      }
      if (!req.body.workDescription) {
        res.status(400).json({ error: 'workDescription is required' });
        return;
      }

      const input = {
        complaintId: req.body.complaintId,
        abatementDate: req.body.abatementDate
          ? new Date(req.body.abatementDate)
          : undefined,
        performedBy: req.body.performedBy,
        workDescription: req.body.workDescription,
        laborCostCents: req.body.laborCostCents || 0,
        equipmentCostCents: req.body.equipmentCostCents || 0,
        materialsCostCents: req.body.materialsCostCents || 0,
        administrativeCostCents: req.body.administrativeCostCents || 0,
        notes: req.body.notes,
      };

      const abatement = await weedControl.recordAbatement(ctx, input);
      res.status(201).json(abatement);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/abatements/:id/certify
   * Certify costs to the county auditor.
   */
  router.post('/abatements/:id/certify', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        abatementId: req.params.id,
        certificationDate: req.body.certificationDate
          ? new Date(req.body.certificationDate)
          : undefined,
        countyRecordingReference: req.body.countyRecordingReference,
      };

      const updated = await weedControl.certifyCostsToCounty(ctx, input);
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/weed-control/abatements/:id/recover
   * Record cost recovery.
   */
  router.post('/abatements/:id/recover', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.recoveryAmountCents) {
        res.status(400).json({ error: 'recoveryAmountCents is required' });
        return;
      }

      const updated = await weedControl.recordCostRecovery(
        ctx,
        req.params.id,
        req.body.recoveryAmountCents,
        req.body.recoveredAt ? new Date(req.body.recoveredAt) : undefined
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // REPORTING
  // ===========================================================================

  /**
   * GET /api/township/weed-control/overdue
   * Get complaints with overdue compliance deadlines.
   */
  router.get('/overdue', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const overdue = await weedControl.getOverdueComplaints(ctx);
      res.json(overdue);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/weed-control/stats
   * Get case statistics.
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const year = req.query.year ? Number(req.query.year) : undefined;
      const stats = await weedControl.getCaseStatistics(ctx, year);
      res.json(stats);
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
