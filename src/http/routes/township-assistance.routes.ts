// src/http/routes/township-assistance.routes.ts
//
// REST API routes for the Township Assistance engine.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  TownshipAssistanceService,
  AssistanceCaseFilter,
} from '../../engines/township-assistance/assistance.service';
import { TownshipAssistanceReportingService } from '../../engines/township-assistance/assistance.reporting.service';
import { AssistanceCaseStatus } from '../../engines/township-assistance/assistance.types';
import { buildTenantContext, isTenantTownship } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Dependencies for the township assistance router.
 */
export interface TownshipAssistanceRouterDependencies {
  assistance: TownshipAssistanceService;
  reporting?: TownshipAssistanceReportingService;
}

/**
 * Create township assistance router with all endpoints.
 *
 * @param deps - Service dependencies
 */
export function createTownshipAssistanceRouter(
  deps: TownshipAssistanceService | TownshipAssistanceRouterDependencies
): Router {
  const { assistance, reporting }: TownshipAssistanceRouterDependencies =
    'createApplication' in deps
      ? { assistance: deps as TownshipAssistanceService }
      : (deps as TownshipAssistanceRouterDependencies);

  const router = Router();

  // Middleware to attach tenant context and verify township
  router.use((req: Request, res: Response, next: NextFunction) => {
    const ctx = buildTenantContext(req);
    (req as ApiRequest).ctx = ctx;

    // Verify this is a township tenant
    if (!isTenantTownship(ctx.tenantId)) {
      res.status(403).json({
        error: 'Township assistance is only available for township tenants',
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // PROGRAM POLICIES
  // ===========================================================================

  /**
   * GET /api/township/assistance/policies
   * List program policies.
   */
  router.get('/policies', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const policies = await assistance.listProgramPolicies(ctx);
      res.json(policies);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/assistance/policies/:id
   * Get a program policy.
   */
  router.get('/policies/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const policy = await assistance.getProgramPolicy(ctx, req.params.id);

      if (!policy) {
        res.status(404).json({ error: 'Program policy not found' });
        return;
      }

      res.json(policy);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // APPLICATIONS
  // ===========================================================================

  /**
   * POST /api/township/assistance/applications
   * Create a new assistance application.
   */
  router.post('/applications', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.applicantName) {
        res.status(400).json({ error: 'applicantName is required' });
        return;
      }

      const input = {
        applicantName: req.body.applicantName,
        applicantEmail: req.body.applicantEmail,
        applicantPhone: req.body.applicantPhone,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        household: req.body.household || [],
        monthlyIncomeCents: req.body.monthlyIncomeCents,
        monthlyExpensesCents: req.body.monthlyExpensesCents,
        requestedBenefitTypes: req.body.requestedBenefitTypes || [],
        requestedAmountCents: req.body.requestedAmountCents,
      };

      const application = await assistance.createApplication(ctx, input);
      res.status(201).json(application);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/assistance/applications/:id
   * Get an application by ID.
   */
  router.get('/applications/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const application = await assistance.getApplication(ctx, req.params.id);

      if (!application) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }

      res.json(application);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // CASES
  // ===========================================================================

  /**
   * GET /api/township/assistance/cases
   * List cases with optional filters.
   */
  router.get('/cases', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: AssistanceCaseFilter = {};

      if (req.query.status) {
        filter.status = String(req.query.status) as AssistanceCaseStatus;
      }
      if (req.query.applicantName) {
        filter.applicantNameContains = String(req.query.applicantName);
      }
      if (req.query.from) {
        filter.fromDate = new Date(String(req.query.from));
      }
      if (req.query.to) {
        filter.toDate = new Date(String(req.query.to));
      }

      const cases = await assistance.listCases(ctx, filter);
      res.json(cases);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/assistance/cases/:id
   * Get a case by ID.
   */
  router.get('/cases/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const caseData = await assistance.getCase(ctx, req.params.id);

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
   * POST /api/township/assistance/applications/:id/case
   * Create a case for an application.
   */
  router.post('/applications/:id/case', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const caseData = await assistance.createCaseForApplication(
        ctx,
        req.params.id,
        req.body.programPolicyId
      );
      res.status(201).json(caseData);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/assistance/cases/:id/status
   * Update case status.
   */
  router.post('/cases/:id/status', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.status) {
        res.status(400).json({ error: 'status is required' });
        return;
      }

      const validStatuses: AssistanceCaseStatus[] = [
        'open',
        'pendingDocumentation',
        'underReview',
        'approved',
        'denied',
        'paid',
        'closed',
      ];

      if (!validStatuses.includes(req.body.status)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
        return;
      }

      const updated = await assistance.updateCaseStatus(
        ctx,
        req.params.id,
        req.body.status
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // BENEFITS
  // ===========================================================================

  /**
   * POST /api/township/assistance/benefits
   * Create a benefit payment.
   */
  router.post('/benefits', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.caseId) {
        res.status(400).json({ error: 'caseId is required' });
        return;
      }
      if (!req.body.type) {
        res.status(400).json({ error: 'type is required' });
        return;
      }
      if (!req.body.amountCents) {
        res.status(400).json({ error: 'amountCents is required' });
        return;
      }
      if (!req.body.payeeName) {
        res.status(400).json({ error: 'payeeName is required' });
        return;
      }

      const input = {
        caseId: req.body.caseId,
        type: req.body.type,
        amountCents: req.body.amountCents,
        payeeName: req.body.payeeName,
        payeeAddressLine1: req.body.payeeAddressLine1,
        payeeAddressLine2: req.body.payeeAddressLine2,
        payeeCity: req.body.payeeCity,
        payeeState: req.body.payeeState,
        payeePostalCode: req.body.payeePostalCode,
      };

      const benefit = await assistance.createBenefit(ctx, input);
      res.status(201).json(benefit);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/assistance/cases/:id/benefits
   * List benefits for a case.
   */
  router.get('/cases/:id/benefits', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const benefits = await assistance.listBenefitsForCase(ctx, req.params.id);
      res.json(benefits);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // REPORTING (optional)
  // ===========================================================================

  /**
   * GET /api/township/assistance/stats
   * Get assistance statistics summary.
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      if (!reporting) {
        res.status(501).json({ error: 'Reporting service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;

      // Build date range based on query param
      const now = new Date();
      let fromDate: Date;
      let toDate: Date = now;

      const rangeParam = String(req.query.range || 'ytd');
      switch (rangeParam) {
        case 'last30days':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last12months':
          fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case 'all':
          fromDate = new Date(2000, 0, 1);
          break;
        case 'ytd':
        default:
          fromDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const stats = await reporting.getStatsForRange(ctx, { fromDate, toDate });
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
