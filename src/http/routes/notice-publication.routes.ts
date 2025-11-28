// src/http/routes/notice-publication.routes.ts
//
// REST API routes for the Notice & Publication Engine.
// Provides endpoints for managing publication rules, newspaper schedules,
// deadline calculations, and notice requirements.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { buildTenantContext } from '../context';
import {
  PublicationRuleService,
  InMemoryPublicationRuleStore,
} from '../../engines/meetings/domain/services/publication-rule.service';
import {
  NewspaperScheduleService,
  InMemoryNewspaperScheduleStore,
} from '../../engines/meetings/domain/services/newspaper-schedule.service';
import {
  DeadlineCalculatorService,
  getRiskMessage,
} from '../../engines/meetings/domain/services/deadline-calculator.service';
import {
  NoticeRequirementService,
  InMemoryNoticeRequirementStore,
  InMemoryNoticeDeliveryStore,
} from '../../engines/meetings/domain/services/notice-requirement.service';
import { NoticeReason, NoticeChannelType } from '../../engines/meetings/domain/types';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Services container for dependency injection.
 */
export interface NoticePublicationServices {
  ruleService: PublicationRuleService;
  scheduleService: NewspaperScheduleService;
  deadlineCalculator: DeadlineCalculatorService;
  requirementService: NoticeRequirementService;
}

/**
 * Create in-memory services for development/testing.
 */
export function createInMemoryNoticePublicationServices(): NoticePublicationServices {
  const ruleStore = new InMemoryPublicationRuleStore();
  const scheduleStore = new InMemoryNewspaperScheduleStore();
  const requirementStore = new InMemoryNoticeRequirementStore();
  const deliveryStore = new InMemoryNoticeDeliveryStore();

  const ruleService = new PublicationRuleService(ruleStore);
  const scheduleService = new NewspaperScheduleService(scheduleStore);
  const deadlineCalculator = new DeadlineCalculatorService(
    ruleService,
    scheduleService
  );
  const requirementService = new NoticeRequirementService(
    requirementStore,
    deliveryStore,
    ruleService,
    deadlineCalculator
  );

  return {
    ruleService,
    scheduleService,
    deadlineCalculator,
    requirementService,
  };
}

/**
 * Create notice publication router with all endpoints.
 */
export function createNoticePublicationRouter(
  services: NoticePublicationServices
): Router {
  const router = Router({ mergeParams: true });

  // Middleware to attach tenant context
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // PUBLICATION RULES ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/tenants/:tenantId/publication-rules
   * Get all publication rules for the tenant.
   */
  router.get('/publication-rules', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const rules = await services.ruleService.getRulesForTenant(ctx);
      res.json({ success: true, data: rules });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/tenants/:tenantId/publication-rules/:reason
   * Get publication rule for a specific notice reason.
   */
  router.get(
    '/publication-rules/:reason',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const reason = req.params.reason as NoticeReason;
        const rule = await services.ruleService.getRuleForReason(ctx, reason);

        if (!rule) {
          res.status(404).json({
            success: false,
            error: { code: 'RULE_NOT_FOUND', message: 'Publication rule not found' },
          });
          return;
        }

        res.json({ success: true, data: rule });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/publication-rules/seed-defaults
   * Seed default Indiana publication rules for the tenant.
   */
  router.post(
    '/publication-rules/seed-defaults',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        await services.ruleService.seedDefaultRules(ctx);
        const rules = await services.ruleService.getRulesForTenant(ctx);
        res.status(201).json({ success: true, data: rules });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // NEWSPAPER SCHEDULE ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/tenants/:tenantId/notice-channels
   * Get all newspaper schedules for the tenant.
   */
  router.get('/notice-channels', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const schedules = await services.scheduleService.getAllSchedules(ctx);
      res.json({ success: true, data: schedules });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/tenants/:tenantId/notice-channels/:channelId/schedule
   * Get schedule for a specific notice channel (newspaper).
   */
  router.get(
    '/notice-channels/:channelId/schedule',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const schedule = await services.scheduleService.getSchedule(
          ctx,
          req.params.channelId
        );

        if (!schedule) {
          res.status(404).json({
            success: false,
            error: { code: 'SCHEDULE_NOT_FOUND', message: 'Newspaper schedule not found' },
          });
          return;
        }

        res.json({ success: true, data: schedule });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/notice-channels
   * Create a new newspaper schedule.
   */
  router.post('/notice-channels', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const schedule = await services.scheduleService.createSchedule(ctx, {
        name: req.body.name,
        publicationDays: req.body.publicationDays,
        submissionDeadlines: req.body.submissionDeadlines,
        submissionLeadDays: req.body.submissionLeadDays,
        holidayClosures: req.body.holidayClosures?.map(
          (d: string) => new Date(d)
        ),
        canAccommodateRush: req.body.canAccommodateRush,
        isLegalPublication: req.body.isLegalPublication,
        contactInfo: req.body.contactInfo,
      });
      res.status(201).json({ success: true, data: schedule });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/tenants/:tenantId/notice-channels/:channelId/schedule
   * Update a newspaper schedule.
   */
  router.put(
    '/notice-channels/:channelId/schedule',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const schedule = await services.scheduleService.updateSchedule(
          ctx,
          req.params.channelId,
          {
            name: req.body.name,
            publicationDays: req.body.publicationDays,
            submissionDeadlines: req.body.submissionDeadlines,
            submissionLeadDays: req.body.submissionLeadDays,
            holidayClosures: req.body.holidayClosures?.map(
              (d: string) => new Date(d)
            ),
            canAccommodateRush: req.body.canAccommodateRush,
            contactInfo: req.body.contactInfo,
          }
        );
        res.json({ success: true, data: schedule });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // DEADLINE CALCULATOR ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/tenants/:tenantId/deadline-calculator
   * Calculate deadlines for a hearing.
   *
   * Body:
   * - hearingDate: ISO 8601 date
   * - noticeReason: Notice reason type
   * - newspaperChannelId?: Optional newspaper schedule ID
   */
  router.post('/deadline-calculator', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.hearingDate || !req.body.noticeReason) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'hearingDate and noticeReason are required',
          },
        });
        return;
      }

      const calculation = await services.deadlineCalculator.calculateDeadlines(
        ctx,
        new Date(req.body.hearingDate),
        req.body.noticeReason as NoticeReason,
        req.body.newspaperChannelId
      );

      res.json({ success: true, data: calculation });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // NOTICE REQUIREMENTS ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/tenants/:tenantId/meetings/:meetingId/notice-requirements
   * Get notice requirements for a meeting.
   */
  router.get(
    '/meetings/:meetingId/notice-requirements',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const requirements = await services.requirementService.getRequirements(
          ctx,
          req.params.meetingId
        );
        res.json({ success: true, data: requirements });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/meetings/:meetingId/notice-requirements/generate
   * Generate notice requirements for a meeting.
   *
   * Body:
   * - meetingDate: ISO 8601 date
   * - meetingType: Meeting type string
   * - agendaItemId?: Optional agenda item ID
   * - noticeReason?: Override notice reason
   * - newspaperChannelId?: Newspaper schedule ID
   */
  router.post(
    '/meetings/:meetingId/notice-requirements/generate',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.meetingDate || !req.body.meetingType) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'meetingDate and meetingType are required',
            },
          });
          return;
        }

        const requirements =
          await services.requirementService.generateRequirements(ctx, {
            meetingId: req.params.meetingId,
            meetingDate: new Date(req.body.meetingDate),
            meetingType: req.body.meetingType,
            agendaItemId: req.body.agendaItemId,
            noticeReason: req.body.noticeReason as NoticeReason | undefined,
            newspaperChannelId: req.body.newspaperChannelId,
          });

        res.status(201).json({ success: true, data: requirements });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * GET /api/tenants/:tenantId/notice-requirements/:id
   * Get a specific notice requirement.
   */
  router.get(
    '/notice-requirements/:id',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const requirement = await services.requirementService.getRequirement(
          ctx,
          req.params.id
        );

        if (!requirement) {
          res.status(404).json({
            success: false,
            error: {
              code: 'REQUIREMENT_NOT_FOUND',
              message: 'Notice requirement not found',
            },
          });
          return;
        }

        res.json({ success: true, data: requirement });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * PATCH /api/tenants/:tenantId/notice-requirements/:id/status
   * Update notice requirement status.
   *
   * Body:
   * - status: New status
   * - failureReason?: For FAILED status
   * - waiverReason?: For WAIVED status
   */
  router.patch(
    '/notice-requirements/:id/status',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.status) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'status is required' },
          });
          return;
        }

        const requirement = await services.requirementService.updateStatus(
          ctx,
          req.params.id,
          {
            status: req.body.status,
            failureReason: req.body.failureReason,
            waiverReason: req.body.waiverReason,
          }
        );

        res.json({ success: true, data: requirement });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/notice-requirements/:id/refresh-risk
   * Refresh risk assessment for a requirement.
   */
  router.post(
    '/notice-requirements/:id/refresh-risk',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const requirement =
          await services.requirementService.refreshRiskAssessment(
            ctx,
            req.params.id
          );
        res.json({
          success: true,
          data: {
            ...requirement,
            riskMessage: requirement.riskLevel
              ? getRiskMessage(requirement.riskLevel)
              : null,
          },
        });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // NOTICE DELIVERY ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/tenants/:tenantId/notice-requirements/:id/deliveries
   * Record a delivery attempt.
   *
   * Body:
   * - channelType: Notice channel type
   * - channelId?: Channel ID (e.g., newspaper schedule ID)
   * - publicationNumber: Publication sequence number
   * - targetPublicationDate?: Target date
   * - notes?: Notes
   */
  router.post(
    '/notice-requirements/:id/deliveries',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.channelType || req.body.publicationNumber === undefined) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'channelType and publicationNumber are required',
            },
          });
          return;
        }

        const delivery = await services.requirementService.recordDelivery(
          ctx,
          req.params.id,
          {
            channelType: req.body.channelType as NoticeChannelType,
            channelId: req.body.channelId,
            publicationNumber: req.body.publicationNumber,
            targetPublicationDate: req.body.targetPublicationDate
              ? new Date(req.body.targetPublicationDate)
              : undefined,
            notes: req.body.notes,
          }
        );

        res.status(201).json({ success: true, data: delivery });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/notice-deliveries/:id/submit
   * Mark a delivery as submitted.
   */
  router.post(
    '/notice-deliveries/:id/submit',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const delivery = await services.requirementService.submitDelivery(
          ctx,
          req.params.id
        );
        res.json({ success: true, data: delivery });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * PUT /api/tenants/:tenantId/notice-deliveries/:id/confirm
   * Confirm a delivery with proof.
   *
   * Body:
   * - actualPublicationDate: Actual publication date
   * - proofDocumentId?: File ID of proof (tearsheet, etc.)
   * - affidavitFileId?: File ID of affidavit of publication
   * - notes?: Additional notes
   */
  router.put(
    '/notice-deliveries/:id/confirm',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.actualPublicationDate) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'actualPublicationDate is required',
            },
          });
          return;
        }

        const delivery = await services.requirementService.confirmDelivery(
          ctx,
          req.params.id,
          {
            actualPublicationDate: new Date(req.body.actualPublicationDate),
            proofDocumentId: req.body.proofDocumentId,
            affidavitFileId: req.body.affidavitFileId,
            notes: req.body.notes,
          }
        );

        res.json({ success: true, data: delivery });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/tenants/:tenantId/notice-deliveries/:id/fail
   * Mark a delivery as failed.
   *
   * Body:
   * - reason: Failure reason
   */
  router.post(
    '/notice-deliveries/:id/fail',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (!req.body.reason) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'reason is required' },
          });
          return;
        }

        const delivery = await services.requirementService.failDelivery(
          ctx,
          req.params.id,
          req.body.reason
        );

        res.json({ success: true, data: delivery });
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

  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}
