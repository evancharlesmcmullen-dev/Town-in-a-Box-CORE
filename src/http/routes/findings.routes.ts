// src/http/routes/findings.routes.ts
//
// REST API routes for the Findings of Fact Engine.
// Provides endpoints for managing BZA/Plan Commission findings.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { buildTenantContext } from '../context';
import {
  FindingsTemplateService,
  InMemoryFindingsStore,
} from '../../engines/meetings/domain/services/findings-template.service';
import {
  FindingsService,
  InMemoryFindingsDataStore,
} from '../../engines/meetings/domain/services/findings.service';
import {
  FindingsCaseType,
  FindingsDetermination,
} from '../../engines/meetings/domain/types';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Services container for dependency injection.
 */
export interface FindingsServices {
  templateService: FindingsTemplateService;
  findingsService: FindingsService;
}

/**
 * Create in-memory services for development/testing.
 */
export function createInMemoryFindingsServices(): FindingsServices {
  const findingsStore = new InMemoryFindingsStore();
  const findingsDataStore = new InMemoryFindingsDataStore();

  const templateService = new FindingsTemplateService(findingsStore);
  const findingsService = new FindingsService(findingsDataStore);

  return {
    templateService,
    findingsService,
  };
}

/**
 * Create findings router with all endpoints.
 */
export function createFindingsRouter(services: FindingsServices): Router {
  const router = Router({ mergeParams: true });

  // Middleware to attach tenant context
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // TEMPLATE ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/tenants/:tenantId/findings-templates
   * Get all available findings templates.
   */
  router.get('/findings-templates', async (req: Request, res: Response) => {
    try {
      const templates = services.templateService.getAvailableCaseTypes();
      res.json({ success: true, data: templates });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/tenants/:tenantId/findings-templates/:caseType
   * Get findings template for a specific case type.
   */
  router.get(
    '/findings-templates/:caseType',
    async (req: Request, res: Response) => {
      try {
        const caseType = req.params.caseType as FindingsCaseType;
        const template = services.templateService.getTemplate(caseType);

        if (!template) {
          res.status(404).json({
            success: false,
            error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' },
          });
          return;
        }

        res.json({ success: true, data: template });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * GET /api/tenants/:tenantId/findings-templates/:caseType/criteria
   * Get criteria for a case type.
   */
  router.get(
    '/findings-templates/:caseType/criteria',
    async (req: Request, res: Response) => {
      try {
        const caseType = req.params.caseType as FindingsCaseType;
        const criteria = services.templateService.getCriteriaForCaseType(caseType);
        res.json({ success: true, data: criteria });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // FINDINGS CRUD ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/tenants/:tenantId/agenda-items/:itemId/findings
   * Get findings for an agenda item.
   */
  router.get(
    '/agenda-items/:itemId/findings',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const findings = await services.findingsService.getFindings(
          ctx,
          req.params.itemId
        );

        if (!findings) {
          res.status(404).json({
            success: false,
            error: { code: 'FINDINGS_NOT_FOUND', message: 'Findings not found' },
          });
          return;
        }

        res.json({ success: true, data: findings });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/agenda-items/:itemId/findings
   * Create findings from template for an agenda item.
   *
   * Body:
   * - caseType: FindingsCaseType
   * - meetingId: string
   */
  router.post(
    '/agenda-items/:itemId/findings',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.caseType || !req.body.meetingId) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'caseType and meetingId are required',
            },
          });
          return;
        }

        const findings = await services.templateService.createFindingsFromTemplate(
          ctx,
          {
            meetingId: req.body.meetingId,
            agendaItemId: req.params.itemId,
            caseType: req.body.caseType as FindingsCaseType,
          }
        );

        res.status(201).json({ success: true, data: findings });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * GET /api/tenants/:tenantId/findings/:findingsId
   * Get findings by ID.
   */
  router.get('/findings/:findingsId', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const findings = await services.findingsService.getFindingsById(
        ctx,
        req.params.findingsId
      );

      if (!findings) {
        res.status(404).json({
          success: false,
          error: { code: 'FINDINGS_NOT_FOUND', message: 'Findings not found' },
        });
        return;
      }

      res.json({ success: true, data: findings });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/tenants/:tenantId/meetings/:meetingId/findings
   * Get all findings for a meeting.
   */
  router.get(
    '/meetings/:meetingId/findings',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const findingsList = await services.findingsService.getFindingsForMeeting(
          ctx,
          req.params.meetingId
        );
        res.json({ success: true, data: findingsList });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // CRITERION UPDATE ENDPOINTS
  // ===========================================================================

  /**
   * PUT /api/tenants/:tenantId/findings/:findingsId/criteria/:criterionId/staff
   * Update staff recommendation for a criterion.
   *
   * Body:
   * - recommendation: FindingsDetermination
   * - rationale: string (the "because" statement)
   */
  router.put(
    '/findings/:findingsId/criteria/:criterionId/staff',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.recommendation || !req.body.rationale) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'recommendation and rationale are required',
            },
          });
          return;
        }

        const criterion = await services.findingsService.updateStaffRecommendation(
          ctx,
          req.params.criterionId,
          {
            recommendation: req.body.recommendation as FindingsDetermination,
            rationale: req.body.rationale,
          }
        );

        res.json({ success: true, data: criterion });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * PUT /api/tenants/:tenantId/findings/:findingsId/criteria/:criterionId/board
   * Record board determination for a criterion.
   *
   * Body:
   * - determination: FindingsDetermination
   * - rationale: string (the "because" statement)
   */
  router.put(
    '/findings/:findingsId/criteria/:criterionId/board',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.determination || !req.body.rationale) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'determination and rationale are required',
            },
          });
          return;
        }

        const criterion = await services.findingsService.recordBoardDetermination(
          ctx,
          req.params.criterionId,
          {
            determination: req.body.determination as FindingsDetermination,
            rationale: req.body.rationale,
          }
        );

        res.json({ success: true, data: criterion });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // VALIDATION AND WORKFLOW ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/tenants/:tenantId/findings/:findingsId/validate
   * Validate findings completeness.
   */
  router.get(
    '/findings/:findingsId/validate',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const findings = await services.findingsService.getFindingsById(
          ctx,
          req.params.findingsId
        );

        if (!findings) {
          res.status(404).json({
            success: false,
            error: { code: 'FINDINGS_NOT_FOUND', message: 'Findings not found' },
          });
          return;
        }

        const validation = services.findingsService.validateFindings(findings);
        res.json({ success: true, data: validation });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/findings/:findingsId/submit
   * Submit findings for review.
   */
  router.post(
    '/findings/:findingsId/submit',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const findings = await services.findingsService.submitForReview(
          ctx,
          req.params.findingsId
        );
        res.json({ success: true, data: findings });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/findings/:findingsId/adopt
   * Adopt findings (link to vote record, lock findings).
   *
   * Body:
   * - voteRecordId: string
   */
  router.post(
    '/findings/:findingsId/adopt',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.voteRecordId) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'voteRecordId is required',
            },
          });
          return;
        }

        const findings = await services.findingsService.adoptFindings(
          ctx,
          req.params.findingsId,
          req.body.voteRecordId
        );

        res.json({ success: true, data: findings });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/findings/:findingsId/reject
   * Reject findings (for denied cases).
   *
   * Body:
   * - voteRecordId: string
   */
  router.post(
    '/findings/:findingsId/reject',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.voteRecordId) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'voteRecordId is required',
            },
          });
          return;
        }

        const findings = await services.findingsService.rejectFindings(
          ctx,
          req.params.findingsId,
          req.body.voteRecordId
        );

        res.json({ success: true, data: findings });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // CONDITIONS ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/tenants/:tenantId/findings/:findingsId/conditions
   * Add a condition of approval.
   *
   * Body:
   * - conditionText: string
   */
  router.post(
    '/findings/:findingsId/conditions',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.conditionText) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'conditionText is required',
            },
          });
          return;
        }

        const condition = await services.findingsService.addCondition(
          ctx,
          req.params.findingsId,
          { conditionText: req.body.conditionText }
        );

        res.status(201).json({ success: true, data: condition });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * PUT /api/tenants/:tenantId/findings/:findingsId/conditions/:conditionId
   * Update a condition.
   *
   * Body:
   * - conditionText: string
   */
  router.put(
    '/findings/:findingsId/conditions/:conditionId',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.conditionText) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'conditionText is required',
            },
          });
          return;
        }

        const condition = await services.findingsService.updateCondition(
          ctx,
          req.params.conditionId,
          req.body.conditionText
        );

        res.json({ success: true, data: condition });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * DELETE /api/tenants/:tenantId/findings/:findingsId/conditions/:conditionId
   * Remove a condition.
   */
  router.delete(
    '/findings/:findingsId/conditions/:conditionId',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        await services.findingsService.removeCondition(
          ctx,
          req.params.conditionId
        );
        res.json({ success: true, message: 'Condition removed' });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // DOCUMENT GENERATION ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/tenants/:tenantId/findings/:findingsId/generate-document
   * Generate findings document (PDF/DOCX).
   */
  router.post(
    '/findings/:findingsId/generate-document',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const result = await services.findingsService.generateFindingsDocument(
          ctx,
          req.params.findingsId
        );
        res.json({ success: true, data: result });
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
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message },
    });
    return;
  }

  if (message.includes('Invalid') || message.includes('required')) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message },
    });
    return;
  }

  if (message.includes('locked') || message.includes('Cannot modify')) {
    res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message },
    });
    return;
  }

  if (message.includes('Cannot approve') || message.includes('Cannot deny')) {
    res.status(422).json({
      success: false,
      error: { code: 'UNPROCESSABLE_ENTITY', message },
    });
    return;
  }

  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}
