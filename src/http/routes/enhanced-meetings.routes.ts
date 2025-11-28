// src/http/routes/enhanced-meetings.routes.ts
//
// REST API routes for the Enhanced Meetings engine.
// Includes agenda, executive sessions, quorum, actions, and minutes management.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { buildTenantContext } from '../context';
import { EnhancedMeetingsService } from '../../engines/meetings/enhanced-meetings.service';
import { ComplianceError } from '../../engines/meetings/domain/services/compliance.service';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create enhanced meetings router with all endpoints.
 */
export function createEnhancedMeetingsRouter(
  meetings: EnhancedMeetingsService
): Router {
  const router = Router();

  // Middleware to attach tenant context
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as ApiRequest).ctx = buildTenantContext(req);
    next();
  });

  // ===========================================================================
  // CORE MEETINGS ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings
   * List meetings with optional filters.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const filter: any = {};

      if (req.query.bodyId) filter.bodyId = String(req.query.bodyId);
      if (req.query.from) filter.fromDate = new Date(String(req.query.from));
      if (req.query.to) filter.toDate = new Date(String(req.query.to));
      if (req.query.status) filter.status = String(req.query.status);

      const list = await meetings.listMeetings(ctx, filter);
      res.json({ success: true, data: list });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings
   * Schedule a new meeting.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const input = {
        bodyId: req.body.bodyId,
        type: req.body.type,
        scheduledStart: new Date(req.body.scheduledStart),
        scheduledEnd: req.body.scheduledEnd
          ? new Date(req.body.scheduledEnd)
          : undefined,
        location: req.body.location,
      };

      const meeting = await meetings.scheduleMeeting(ctx, input);
      res.status(201).json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/meetings/:id
   * Get a single meeting by ID.
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.getMeeting(ctx, req.params.id);

      if (!meeting) {
        res.status(404).json({ success: false, error: { code: 'MEETINGS.NOT_FOUND', message: 'Meeting not found' } });
        return;
      }

      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // MEETING LIFECYCLE ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/meetings/:id/start
   * Start a meeting (transition to IN_PROGRESS).
   */
  router.post('/:id/start', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.startMeeting(ctx, req.params.id);
      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/recess
   * Recess a meeting.
   */
  router.post('/:id/recess', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.recessMeeting(ctx, req.params.id);
      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/resume
   * Resume a recessed meeting.
   */
  router.post('/:id/resume', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.resumeMeeting(ctx, req.params.id);
      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/adjourn
   * Adjourn a meeting.
   */
  router.post('/:id/adjourn', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.adjournMeeting(ctx, req.params.id);
      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/cancel
   * Cancel a meeting.
   */
  router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.cancelMeeting(
        ctx,
        req.params.id,
        req.body.reason
      );
      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/notice
   * Record notice posted.
   */
  router.post('/:id/notice', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const meeting = await meetings.markNoticePosted(ctx, {
        meetingId: req.params.id,
        postedAt: new Date(req.body.postedAt),
        postedByUserId: req.body.postedByUserId || ctx.userId || '',
        methods: req.body.methods || [],
        locations: req.body.locations || [],
        proofUris: req.body.proofUris,
        notes: req.body.notes,
      });
      res.json({ success: true, data: meeting });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // AGENDA ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/meetings/:id/agenda
   * Create an agenda for a meeting.
   */
  router.post('/:id/agenda', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const agenda = await meetings.createAgenda(ctx, {
        meetingId: req.params.id,
        title: req.body.title,
        preamble: req.body.preamble,
        postamble: req.body.postamble,
      });
      res.status(201).json({ success: true, data: agenda });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/meetings/:id/agenda
   * Get the agenda for a meeting.
   */
  router.get('/:id/agenda', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const agenda = await meetings.getAgenda(ctx, req.params.id);

      if (!agenda) {
        res.status(404).json({ success: false, error: { code: 'AGENDA.NOT_FOUND', message: 'Agenda not found' } });
        return;
      }

      res.json({ success: true, data: agenda });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/agenda/items
   * Add an item to the agenda.
   */
  router.post('/:id/agenda/items', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const agenda = await meetings.getAgenda(ctx, req.params.id);
      if (!agenda) {
        res.status(404).json({ success: false, error: { code: 'AGENDA.NOT_FOUND', message: 'Agenda not found' } });
        return;
      }

      const item = await meetings.addAgendaItem(ctx, {
        agendaId: agenda.id,
        orderIndex: req.body.orderIndex ?? 0,
        title: req.body.title,
        description: req.body.description,
        itemType: req.body.itemType,
        parentItemId: req.body.parentItemId,
        durationMinutes: req.body.durationMinutes,
        requiresVote: req.body.requiresVote,
        requiresPublicHearing: req.body.requiresPublicHearing,
        presenterName: req.body.presenterName,
        presenterUserId: req.body.presenterUserId,
        relatedType: req.body.relatedType,
        relatedId: req.body.relatedId,
      });
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/agenda/publish
   * Publish the agenda.
   */
  router.post('/:id/agenda/publish', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const agenda = await meetings.getAgenda(ctx, req.params.id);
      if (!agenda) {
        res.status(404).json({ success: false, error: { code: 'AGENDA.NOT_FOUND', message: 'Agenda not found' } });
        return;
      }

      const published = await meetings.publishAgenda(ctx, agenda.id);
      res.json({ success: true, data: published });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // EXECUTIVE SESSION ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/executive-sessions
   * Get executive sessions for a meeting.
   */
  router.get('/:id/executive-sessions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const sessions = await meetings.getExecSessions(ctx, req.params.id);
      res.json({ success: true, data: sessions });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/executive-sessions
   * Create an executive session.
   */
  router.post('/:id/executive-sessions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const session = await meetings.createExecSession(ctx, {
        meetingId: req.params.id,
        agendaItemId: req.body.agendaItemId,
        basisCode: req.body.basisCode,
        subject: req.body.subject,
        scheduledStart: req.body.scheduledStart
          ? new Date(req.body.scheduledStart)
          : undefined,
      });
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/executive-sessions/:sessionId/enter
   * Enter an executive session (with pre-certification).
   */
  router.post(
    '/:id/executive-sessions/:sessionId/enter',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const session = await meetings.enterExecSession(ctx, {
          sessionId: req.params.sessionId,
          preCertStatement: req.body.preCertStatement,
          attendeeUserIds: req.body.attendeeUserIds || [],
        });
        res.json({ success: true, data: session });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/meetings/:id/executive-sessions/:sessionId/end
   * End an executive session (with post-certification).
   */
  router.post(
    '/:id/executive-sessions/:sessionId/end',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const session = await meetings.endExecSession(ctx, {
          sessionId: req.params.sessionId,
          postCertStatement: req.body.postCertStatement,
        });
        res.json({ success: true, data: session });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/meetings/:id/executive-sessions/:sessionId/certify
   * Certify an executive session.
   */
  router.post(
    '/:id/executive-sessions/:sessionId/certify',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const session = await meetings.certifyExecSession(
          ctx,
          req.params.sessionId
        );
        res.json({ success: true, data: session });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // ATTENDANCE ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/attendance
   * Get attendance for a meeting.
   */
  router.get('/:id/attendance', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const attendance = await meetings.getAttendance(ctx, req.params.id);
      res.json({ success: true, data: attendance });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/attendance
   * Record attendance.
   */
  router.post('/:id/attendance', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const attendance = await meetings.recordAttendance(ctx, {
        meetingId: req.params.id,
        memberId: req.body.memberId,
        status: req.body.status,
        arrivedAt: req.body.arrivedAt ? new Date(req.body.arrivedAt) : undefined,
        notes: req.body.notes,
      });
      res.status(201).json({ success: true, data: attendance });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // RECUSAL ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/recusals
   * Get recusals for a meeting.
   */
  router.get('/:id/recusals', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const recusals = await meetings.getRecusals(ctx, req.params.id);
      res.json({ success: true, data: recusals });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/recusals
   * Record a recusal.
   */
  router.post('/:id/recusals', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const recusal = await meetings.recordRecusal(ctx, {
        meetingId: req.params.id,
        agendaItemId: req.body.agendaItemId,
        memberId: req.body.memberId,
        reason: req.body.reason,
        statutoryCite: req.body.statutoryCite,
      });
      res.status(201).json({ success: true, data: recusal });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // QUORUM ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/quorum
   * Calculate quorum for a meeting.
   */
  router.get('/:id/quorum', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const agendaItemId = req.query.agendaItemId
        ? String(req.query.agendaItemId)
        : undefined;
      const quorum = await meetings.calculateQuorum(
        ctx,
        req.params.id,
        agendaItemId
      );
      res.json({ success: true, data: quorum });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // ACTION & VOTING ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/actions
   * Get actions for a meeting.
   */
  router.get('/:id/actions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const actions = await meetings.getActions(ctx, req.params.id);
      res.json({ success: true, data: actions });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/actions
   * Create an action (motion, resolution, etc.).
   */
  router.post('/:id/actions', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const action = await meetings.createAction(ctx, {
        meetingId: req.params.id,
        agendaItemId: req.body.agendaItemId,
        actionType: req.body.actionType,
        title: req.body.title,
        description: req.body.description,
        movedByUserId: req.body.movedByUserId || ctx.userId || '',
      });
      res.status(201).json({ success: true, data: action });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/actions/:actionId/second
   * Second a motion.
   */
  router.post(
    '/:id/actions/:actionId/second',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const action = await meetings.secondAction(ctx, {
          actionId: req.params.actionId,
          secondedByUserId: req.body.secondedByUserId || ctx.userId || '',
        });
        res.json({ success: true, data: action });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/meetings/:id/actions/:actionId/vote
   * Record a vote on an action.
   */
  router.post(
    '/:id/actions/:actionId/vote',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const vote = await meetings.recordActionVote(ctx, {
          actionId: req.params.actionId,
          memberId: req.body.memberId,
          vote: req.body.vote,
        });
        res.status(201).json({ success: true, data: vote });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  /**
   * POST /api/meetings/:id/actions/:actionId/close
   * Close voting and determine result.
   */
  router.post(
    '/:id/actions/:actionId/close',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const action = await meetings.closeVoting(ctx, req.params.actionId);
        res.json({ success: true, data: action });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ===========================================================================
  // MINUTES ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/minutes
   * Get minutes for a meeting.
   */
  router.get('/:id/minutes', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const minutes = await meetings.getMinutes(ctx, req.params.id);

      if (!minutes) {
        res.status(404).json({ success: false, error: { code: 'MINUTES.NOT_FOUND', message: 'Minutes not found' } });
        return;
      }

      res.json({ success: true, data: minutes });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/minutes
   * Create minutes for a meeting.
   */
  router.post('/:id/minutes', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const minutes = await meetings.createMinutes(ctx, {
        meetingId: req.params.id,
        body: req.body.body,
      });
      res.status(201).json({ success: true, data: minutes });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/meetings/:id/minutes
   * Update minutes.
   */
  router.put('/:id/minutes', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const existing = await meetings.getMinutes(ctx, req.params.id);
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'MINUTES.NOT_FOUND', message: 'Minutes not found' } });
        return;
      }

      const minutes = await meetings.updateMinutes(ctx, {
        minutesId: existing.id,
        body: req.body.body,
        status: req.body.status,
      });
      res.json({ success: true, data: minutes });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/minutes/approve
   * Approve minutes (validates all exec sessions certified).
   */
  router.post('/:id/minutes/approve', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const existing = await meetings.getMinutes(ctx, req.params.id);
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'MINUTES.NOT_FOUND', message: 'Minutes not found' } });
        return;
      }

      const minutes = await meetings.approveMinutes(
        ctx,
        existing.id,
        req.body.approvalMeetingId
      );
      res.json({ success: true, data: minutes });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // MEDIA ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/media
   * Get media for a meeting.
   */
  router.get('/:id/media', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const media = await meetings.getMedia(ctx, req.params.id);
      res.json({ success: true, data: media });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/media
   * Upload media for a meeting.
   */
  router.post('/:id/media', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const media = await meetings.uploadMedia(ctx, {
        meetingId: req.params.id,
        mediaType: req.body.mediaType,
        title: req.body.title,
        description: req.body.description,
        externalUrl: req.body.externalUrl,
        provider: req.body.provider,
      });
      res.status(201).json({ success: true, data: media });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // RECORD BUNDLE ENDPOINTS
  // ===========================================================================

  /**
   * GET /api/meetings/:id/record-bundle
   * Get record bundle for a meeting.
   */
  router.get('/:id/record-bundle', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const bundle = await meetings.getRecordBundle(ctx, req.params.id);

      if (!bundle) {
        res.status(404).json({ success: false, error: { code: 'BUNDLE.NOT_FOUND', message: 'Record bundle not found' } });
        return;
      }

      res.json({ success: true, data: bundle });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/record-bundle/assemble
   * Assemble record bundle for APRA compliance.
   */
  router.post(
    '/:id/record-bundle/assemble',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;
        const bundle = await meetings.assembleRecordBundle(ctx, req.params.id);
        res.status(201).json({ success: true, data: bundle });
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
  if (err instanceof ComplianceError) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        statutoryCite: err.statutoryCite,
        details: err.details,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';

  if (message.includes('not found')) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message } });
    return;
  }

  if (message.includes('Invalid') || message.includes('Cannot')) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
    return;
  }

  console.error('API Error:', err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
}
