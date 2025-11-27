// src/http/routes/records.routes.ts
//
// REST API routes for the Records/APRA engine.
// Follows the pattern established by meetings.routes.ts.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  ApraService,
  ApraRequestFilter,
} from '../../engines/records/apra.service';
import { ApraRequestStatus } from '../../engines/records/apra.types';
import { buildTenantContext } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create records router with all APRA endpoints.
 *
 * @param records - The APRA service instance
 */
export function createRecordsRouter(records: ApraService): Router {
  const router = Router();

  // Middleware to attach tenant context to all routes
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // APRA REQUEST ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/records/requests
   * Create a new APRA request.
   *
   * Body:
   * - requesterName: string (required)
   * - requesterEmail: string (optional)
   * - description: string (required) - the records being requested
   * - scopes: array (optional) - scope definitions for the request
   *
   * Returns: Full ApraRequest with computed statutoryDeadlineAt
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
      res.status(201).json(request);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/records/requests
   * List APRA requests with optional filters.
   *
   * Query params:
   * - status: Comma-separated list of statuses (e.g., "RECEIVED,IN_REVIEW")
   * - from: Filter by received date start (ISO 8601)
   * - to: Filter by received date end (ISO 8601)
   * - search: Free text search
   *
   * Returns: Array of ApraRequestSummary
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
   *
   * Returns: Full ApraRequest or 404
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
   * POST /api/records/requests/:id/clarifications
   * Add a clarification request to an APRA request.
   *
   * Body:
   * - messageToRequester: string (required)
   *
   * Returns: ApraClarification
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
   *
   * Body:
   * - requesterResponse: string (required)
   *
   * Returns: Updated ApraClarification
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

      res.json(clarification);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/status
   * Update the status of an APRA request.
   *
   * Body:
   * - newStatus: ApraRequestStatus (required)
   * - note: string (optional)
   *
   * Returns: Updated ApraRequest
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

      const updated = await records.updateStatus(
        ctx,
        req.params.id,
        req.body.newStatus,
        req.body.note
      );

      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/records/requests/:id/exemptions
   * Add an exemption citation to an APRA request.
   *
   * Body:
   * - citation: string (required) - e.g., "IC 5-14-3-4(b)(6)"
   * - description: string (required) - plain English explanation
   * - appliesToScopeId: string (optional)
   *
   * Returns: ApraExemption
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
   *
   * Body:
   * - deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'IN_PERSON' (required)
   * - notes: string (optional)
   * - totalFeesCents: number (optional)
   *
   * Returns: ApraFulfillment
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
   * Get status history for an APRA request.
   *
   * Returns: Array of ApraStatusHistoryEntry (oldest first)
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
   * Get scopes for an APRA request.
   *
   * Returns: Array of ApraRequestScope
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
   * Get clarifications for an APRA request.
   *
   * Returns: Array of ApraClarification
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
   * Get exemptions for an APRA request.
   *
   * Returns: Array of ApraExemption
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
   * Get fulfillments for an APRA request.
   *
   * Returns: Array of ApraFulfillment
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
