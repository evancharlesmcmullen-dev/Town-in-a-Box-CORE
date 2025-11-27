// src/http/routes/policies.routes.ts
//
// REST API routes for the Policies & Resolutions engine.
// This engine is shared across all municipality types.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  PolicyService,
  PolicyDocumentFilter,
} from '../../engines/policies/policy.service';
import {
  PolicyDocumentType,
  PolicyCategory,
  PolicyStatus,
} from '../../engines/policies/policy.types';
import { buildTenantContext } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create policies router with all endpoints.
 * Note: This router does NOT require township tenant - policies are shared across all types.
 *
 * @param policy - The policy service instance
 */
export function createPoliciesRouter(policy: PolicyService): Router {
  const router = Router();

  // Middleware to attach tenant context
  router.use((req: Request, _res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // POLICY DOCUMENTS
  // ===========================================================================

  /**
   * GET /api/policies
   * List policy documents with optional filters.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: PolicyDocumentFilter = {};

      if (req.query.documentType) {
        filter.documentType = String(req.query.documentType) as PolicyDocumentType;
      }
      if (req.query.category) {
        filter.category = String(req.query.category) as PolicyCategory;
      }
      if (req.query.status) {
        filter.status = String(req.query.status) as PolicyStatus;
      }
      if (req.query.title) {
        filter.titleContains = String(req.query.title);
      }
      if (req.query.keyword) {
        filter.keywordContains = String(req.query.keyword);
      }
      if (req.query.effectiveBefore) {
        filter.effectiveBefore = new Date(String(req.query.effectiveBefore));
      }
      if (req.query.effectiveAfter) {
        filter.effectiveAfter = new Date(String(req.query.effectiveAfter));
      }
      if (req.query.requiresReviewBefore) {
        filter.requiresReviewBefore = new Date(String(req.query.requiresReviewBefore));
      }

      const documents = await policy.listDocuments(ctx, filter);
      res.json(documents);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/search
   * Search policies by keyword or text.
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.query.q) {
        res.status(400).json({ error: 'q query parameter is required' });
        return;
      }

      const documents = await policy.searchPolicies(ctx, String(req.query.q));
      res.json(documents);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/:id
   * Get a single policy document by ID.
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const document = await policy.getDocument(ctx, req.params.id);

      if (!document) {
        res.status(404).json({ error: 'Policy document not found' });
        return;
      }

      res.json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies
   * Create a policy document.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.documentType) {
        res.status(400).json({ error: 'documentType is required' });
        return;
      }
      if (!req.body.category) {
        res.status(400).json({ error: 'category is required' });
        return;
      }
      if (!req.body.title) {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      if (!req.body.effectiveDate) {
        res.status(400).json({ error: 'effectiveDate is required' });
        return;
      }

      const input = {
        documentType: req.body.documentType,
        category: req.body.category,
        title: req.body.title,
        description: req.body.description,
        documentNumber: req.body.documentNumber,
        version: req.body.version,
        effectiveDate: new Date(req.body.effectiveDate),
        expirationDate: req.body.expirationDate
          ? new Date(req.body.expirationDate)
          : undefined,
        adoptedAt: req.body.adoptedAt
          ? new Date(req.body.adoptedAt)
          : undefined,
        adoptedByBodyName: req.body.adoptedByBodyName,
        adoptedByResolutionId: req.body.adoptedByResolutionId,
        meetingId: req.body.meetingId,
        summaryText: req.body.summaryText,
        fullText: req.body.fullText,
        attachmentIds: req.body.attachmentIds,
        keywords: req.body.keywords,
        statutoryCitations: req.body.statutoryCitations,
        notes: req.body.notes,
      };

      const document = await policy.createDocument(ctx, input);
      res.status(201).json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/policies/:id
   * Update a policy document.
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        documentType: req.body.documentType,
        category: req.body.category,
        status: req.body.status,
        title: req.body.title,
        description: req.body.description,
        documentNumber: req.body.documentNumber,
        effectiveDate: req.body.effectiveDate
          ? new Date(req.body.effectiveDate)
          : undefined,
        expirationDate: req.body.expirationDate
          ? new Date(req.body.expirationDate)
          : undefined,
        lastReviewedAt: req.body.lastReviewedAt
          ? new Date(req.body.lastReviewedAt)
          : undefined,
        adoptedAt: req.body.adoptedAt
          ? new Date(req.body.adoptedAt)
          : undefined,
        adoptedByBodyName: req.body.adoptedByBodyName,
        adoptedByResolutionId: req.body.adoptedByResolutionId,
        meetingId: req.body.meetingId,
        summaryText: req.body.summaryText,
        fullText: req.body.fullText,
        attachmentIds: req.body.attachmentIds,
        keywords: req.body.keywords,
        statutoryCitations: req.body.statutoryCitations,
        notes: req.body.notes,
      };

      const document = await policy.updateDocument(ctx, req.params.id, input);
      res.json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies/:id/version
   * Create a new version of a policy.
   */
  router.post('/:id/version', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.effectiveDate) {
        res.status(400).json({ error: 'effectiveDate is required' });
        return;
      }

      const input = {
        previousPolicyId: req.params.id,
        title: req.body.title,
        description: req.body.description,
        effectiveDate: new Date(req.body.effectiveDate),
        summaryText: req.body.summaryText,
        fullText: req.body.fullText,
        attachmentIds: req.body.attachmentIds,
        changeNotes: req.body.changeNotes,
      };

      const document = await policy.createNewVersion(ctx, input);
      res.status(201).json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies/:id/activate
   * Activate a draft policy.
   */
  router.post('/:id/activate', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const document = await policy.activateDocument(ctx, req.params.id);
      res.json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies/:id/archive
   * Archive a policy.
   */
  router.post('/:id/archive', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const document = await policy.archiveDocument(ctx, req.params.id);
      res.json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/:id/history
   * Get version history for a policy.
   */
  router.get('/:id/history', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const history = await policy.getVersionHistory(ctx, req.params.id);
      res.json(history);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/by-number/:number
   * Get current version of a policy by document number.
   */
  router.get('/by-number/:number', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const document = await policy.getCurrentVersionByNumber(
        ctx,
        req.params.number
      );

      if (!document) {
        res.status(404).json({ error: 'Policy not found by document number' });
        return;
      }

      res.json(document);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/category/:category
   * Get all active policies in a category.
   */
  router.get('/category/:category', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const documents = await policy.getActivePoliciesInCategory(
        ctx,
        req.params.category as PolicyCategory
      );
      res.json(documents);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // REVIEWS
  // ===========================================================================

  /**
   * GET /api/policies/:id/reviews
   * List reviews for a policy.
   */
  router.get('/:id/reviews', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const reviews = await policy.listReviewsForPolicy(ctx, req.params.id);
      res.json(reviews);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies/:id/reviews
   * Schedule a review for a policy.
   */
  router.post('/:id/reviews', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.scheduledDate) {
        res.status(400).json({ error: 'scheduledDate is required' });
        return;
      }

      const input = {
        policyId: req.params.id,
        scheduledDate: new Date(req.body.scheduledDate),
        reviewerName: req.body.reviewerName,
      };

      const review = await policy.scheduleReview(ctx, input);
      res.status(201).json(review);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies/reviews/:reviewId/complete
   * Complete a scheduled review.
   */
  router.post('/reviews/:reviewId/complete', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (req.body.changesRequired === undefined) {
        res.status(400).json({ error: 'changesRequired is required' });
        return;
      }

      const input = {
        reviewId: req.params.reviewId,
        reviewNotes: req.body.reviewNotes,
        changesRequired: req.body.changesRequired,
        newVersionId: req.body.newVersionId,
      };

      const review = await policy.completeReview(ctx, input);
      res.json(review);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/reviews/upcoming
   * Get upcoming reviews.
   */
  router.get('/reviews/upcoming', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const withinDays = req.query.days ? Number(req.query.days) : 90;
      const reviews = await policy.getUpcomingReviews(ctx, withinDays);
      res.json(reviews);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // ACKNOWLEDGMENTS
  // ===========================================================================

  /**
   * GET /api/policies/:id/acknowledgments
   * List acknowledgments for a policy.
   */
  router.get('/:id/acknowledgments', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const acks = await policy.listAcknowledgmentsForPolicy(ctx, req.params.id);
      res.json(acks);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/policies/:id/acknowledgments
   * Record an acknowledgment for a policy.
   */
  router.post('/:id/acknowledgments', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.acknowledgedByName) {
        res.status(400).json({ error: 'acknowledgedByName is required' });
        return;
      }

      const input = {
        policyId: req.params.id,
        acknowledgedByName: req.body.acknowledgedByName,
        acknowledgedByUserId: req.body.acknowledgedByUserId,
        certificationText: req.body.certificationText,
        signatureReference: req.body.signatureReference,
      };

      const ack = await policy.recordAcknowledgment(ctx, input);
      res.status(201).json(ack);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/policies/:id/acknowledgments/check
   * Check if a person has acknowledged a policy.
   */
  router.get('/:id/acknowledgments/check', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.query.name) {
        res.status(400).json({ error: 'name query parameter is required' });
        return;
      }

      const hasAcknowledged = await policy.hasAcknowledged(
        ctx,
        req.params.id,
        String(req.query.name)
      );

      res.json({ hasAcknowledged });
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
