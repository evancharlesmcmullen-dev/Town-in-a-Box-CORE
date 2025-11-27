// src/http/routes/records.routes.ts
//
// REST API routes for the Records/APRA engine.
// Includes AI, fees, and deadline checking endpoints.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  ApraService,
  ApraRequestFilter,
} from '../../engines/records/apra.service';
import { AiApraService } from '../../engines/records/ai-apra.service';
import { ApraFeeCalculator } from '../../engines/records/apra-fee.calculator';
import { ApraNotificationService } from '../../engines/records/apra-notification.service';
import { ApraRequestStatus } from '../../engines/records/apra.types';
import { buildTenantContext } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Dependencies for the records router.
 */
export interface RecordsRouterDependencies {
  /** Base APRA service (required) */
  records: ApraService;
  /** AI-enhanced APRA service (optional - enables AI endpoints) */
  aiApra?: AiApraService;
  /** Fee calculator (optional - enables fee quote endpoint) */
  feeCalculator?: ApraFeeCalculator;
  /** Notification service (optional - enables deadline check endpoint) */
  apraNotifications?: ApraNotificationService;
}

/**
 * Create records router with all APRA endpoints.
 *
 * @param deps - Service dependencies
 */
export function createRecordsRouter(
  deps: ApraService | RecordsRouterDependencies
): Router {
  // Support both old signature (just ApraService) and new signature (dependencies object)
  const {
    records,
    aiApra,
    feeCalculator,
    apraNotifications,
  }: RecordsRouterDependencies =
    'createRequest' in deps
      ? { records: deps as ApraService }
      : (deps as RecordsRouterDependencies);

  const router = Router();

  // Middleware to attach tenant context to all routes
  router.use((req: Request, _res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // APRA REQUEST ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/records/requests
   * Create a new APRA request.
   */
  router.post('/requests', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.requesterName) {
        res.status(400).json({ error: 'requesterName is required' });
        return;
      }

      if (!req.body.description) {
        res.status(400).json({ error: 'description is required' });
        return;
      }

      const input = {
        requesterName: req.body.requesterName,
        requesterEmail: req.body.requesterEmail,
        description: req.body.description,
        scopes: req.body.scopes,
      };

      const request = await records.createRequest(ctx, input);

      // Optionally notify staff of new request
      if (apraNotifications) {
        try {
          await apraNotifications.notifyNewRequest(ctx, request);
        } catch {
          // Don't fail the request if notification fails
          console.error('Failed to send new request notification');
        }
      }

      res.status(201).json(request);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests
   * List APRA requests with optional filters.
   */
  router.get('/requests', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: ApraRequestFilter = {};

      if (req.query.status) {
        const statusStr = String(req.query.status);
        filter.status = statusStr.split(',') as ApraRequestStatus[];
      }

      if (req.query.from) {
        filter.fromDate = new Date(String(req.query.from));
      }

      if (req.query.to) {
        filter.toDate = new Date(String(req.query.to));
      }

      if (req.query.search) {
        filter.searchText = String(req.query.search);
      }

      const list = await records.listRequests(ctx, filter);
      res.json(list);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests/:id
   * Get a single APRA request by ID.
   */
  router.get('/requests/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const request = await records.getRequest(ctx, req.params.id);

      if (!request) {
        res.status(404).json({ error: 'APRA request not found' });
        return;
      }

      res.json(request);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/status
   * Update the status of an APRA request.
   */
  router.post('/requests/:id/status', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.newStatus) {
        res.status(400).json({ error: 'newStatus is required' });
        return;
      }

      const validStatuses: ApraRequestStatus[] = [
        'RECEIVED',
        'NEEDS_CLARIFICATION',
        'IN_REVIEW',
        'PARTIALLY_FULFILLED',
        'FULFILLED',
        'DENIED',
        'CLOSED',
      ];

      if (!validStatuses.includes(req.body.newStatus)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
        return;
      }

      // Get old status for notification
      const oldRequest = await records.getRequest(ctx, req.params.id);
      const oldStatus = oldRequest?.status;

      const updated = await records.updateStatus(
        ctx,
        req.params.id,
        req.body.newStatus,
        req.body.note
      );

      // Notify of status change
      if (apraNotifications && oldStatus && oldStatus !== updated.status) {
        try {
          await apraNotifications.notifyStatusChange(ctx, updated, oldStatus);
        } catch {
          console.error('Failed to send status change notification');
        }
      }

      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/clarifications
   * Add a clarification request.
   */
  router.post('/requests/:id/clarifications', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.messageToRequester) {
        res.status(400).json({ error: 'messageToRequester is required' });
        return;
      }

      const clarification = await records.addClarification(
        ctx,
        req.params.id,
        req.body.messageToRequester
      );

      res.status(201).json(clarification);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/clarifications/:id/response
   * Record a response to a clarification request.
   */
  router.post('/clarifications/:id/response', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.requesterResponse) {
        res.status(400).json({ error: 'requesterResponse is required' });
        return;
      }

      const clarification = await records.recordClarificationResponse(
        ctx,
        req.params.id,
        req.body.requesterResponse
      );

      // Notify that clarification was received
      if (apraNotifications && clarification.requestId) {
        const request = await records.getRequest(ctx, clarification.requestId);
        if (request) {
          try {
            await apraNotifications.notifyClarificationReceived(
              ctx,
              request,
              req.body.requesterResponse
            );
          } catch {
            console.error('Failed to send clarification received notification');
          }
        }
      }

      res.json(clarification);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/exemptions
   * Add an exemption citation.
   */
  router.post('/requests/:id/exemptions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.citation) {
        res.status(400).json({ error: 'citation is required' });
        return;
      }

      if (!req.body.description) {
        res.status(400).json({ error: 'description is required' });
        return;
      }

      const exemption = await records.addExemption(ctx, req.params.id, {
        citation: req.body.citation,
        description: req.body.description,
        appliesToScopeId: req.body.appliesToScopeId,
      });

      res.status(201).json(exemption);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/fulfill
   * Record fulfillment/delivery of records.
   */
  router.post('/requests/:id/fulfill', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.deliveryMethod) {
        res.status(400).json({ error: 'deliveryMethod is required' });
        return;
      }

      const validMethods = ['EMAIL', 'PORTAL', 'MAIL', 'IN_PERSON'];
      if (!validMethods.includes(req.body.deliveryMethod)) {
        res.status(400).json({
          error: `Invalid deliveryMethod. Must be one of: ${validMethods.join(', ')}`,
        });
        return;
      }

      const fulfillment = await records.recordFulfillment(ctx, req.params.id, {
        deliveryMethod: req.body.deliveryMethod,
        notes: req.body.notes,
        totalFeesCents: req.body.totalFeesCents,
      });

      res.status(201).json(fulfillment);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // RELATED DATA ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/records/requests/:id/history
   */
  router.get('/requests/:id/history', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const history = await records.getStatusHistory(ctx, req.params.id);
      res.json(history);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests/:id/scopes
   */
  router.get('/requests/:id/scopes', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const scopes = await records.getScopes(ctx, req.params.id);
      res.json(scopes);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests/:id/clarifications
   */
  router.get('/requests/:id/clarifications', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const clarifications = await records.getClarifications(ctx, req.params.id);
      res.json(clarifications);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests/:id/exemptions
   */
  router.get('/requests/:id/exemptions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const exemptions = await records.getExemptions(ctx, req.params.id);
      res.json(exemptions);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests/:id/fulfillments
   */
  router.get('/requests/:id/fulfillments', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const fulfillments = await records.getFulfillments(ctx, req.params.id);
      res.json(fulfillments);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // AI ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/records/requests/:id/ai/particularity
   * Analyze whether request meets "reasonably particular" requirement.
   */
  router.post('/requests/:id/ai/particularity', async (req: Request, res: Response) => {
    try {
      if (!aiApra) {
        res.status(501).json({ error: 'AI service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;
      const analysis = await aiApra.analyzeParticularity(ctx, req.params.id);
      res.json(analysis);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/ai/exemptions
   * Suggest potentially applicable exemptions.
   */
  router.post('/requests/:id/ai/exemptions', async (req: Request, res: Response) => {
    try {
      if (!aiApra) {
        res.status(501).json({ error: 'AI service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;
      const suggestions = await aiApra.suggestExemptions(ctx, req.params.id);
      res.json(suggestions);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/ai/scope
   * Analyze the scope of a records request.
   */
  router.post('/requests/:id/ai/scope', async (req: Request, res: Response) => {
    try {
      if (!aiApra) {
        res.status(501).json({ error: 'AI service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;
      const analysis = await aiApra.analyzeScope(ctx, req.params.id);
      res.json(analysis);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/ai/response-letter
   * Draft a response letter.
   */
  router.post('/requests/:id/ai/response-letter', async (req: Request, res: Response) => {
    try {
      if (!aiApra) {
        res.status(501).json({ error: 'AI service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;
      const letter = await aiApra.draftResponseLetter(ctx, req.params.id);
      res.json({
        requestId: req.params.id,
        letter,
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/ai/particularity/review
   * Review and confirm/reject AI particularity assessment.
   */
  router.post('/requests/:id/ai/particularity/review', async (req: Request, res: Response) => {
    try {
      if (!aiApra) {
        res.status(501).json({ error: 'AI service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;

      if (typeof req.body.isParticular !== 'boolean') {
        res.status(400).json({ error: 'isParticular (boolean) is required' });
        return;
      }

      const updated = await aiApra.reviewParticularity(
        ctx,
        req.params.id,
        req.body.isParticular,
        req.body.reason
      );

      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // FEE ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/records/requests/:id/fees/quote
   * Calculate fee quote for copying/media costs.
   */
  router.post('/requests/:id/fees/quote', async (req: Request, res: Response) => {
    try {
      if (!feeCalculator) {
        res.status(501).json({ error: 'Fee calculator not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;

      // Get request for context
      const request = await records.getRequest(ctx, req.params.id);
      if (!request) {
        res.status(404).json({ error: 'APRA request not found' });
        return;
      }

      const result = feeCalculator.calculateFees(ctx, {
        requestId: req.params.id,
        requesterName: request.requesterName,
        bwPages: req.body.bwPages,
        colorPages: req.body.colorPages,
        largeFormatPages: req.body.largeFormatPages,
        cdDvdMedia: req.body.cdDvdMedia,
        usbMedia: req.body.usbMedia,
        requiresMailing: req.body.requiresMailing,
        laborHours: req.body.laborHours,
        certifications: req.body.certifications,
      });

      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // DEADLINE / NOTIFICATION ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/records/deadlines/check
   * Check all open requests for approaching or past deadlines.
   */
  router.post('/deadlines/check', async (req: Request, res: Response) => {
    try {
      if (!apraNotifications) {
        res.status(501).json({ error: 'Notification service not configured' });
        return;
      }

      const ctx = (req as ApiRequest).ctx;
      const result = await apraNotifications.checkDeadlines(ctx);
      res.json(result);
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

  // Log unexpected errors
  console.error('API Error:', err);
  res.status(500).json({ error: message });
}
