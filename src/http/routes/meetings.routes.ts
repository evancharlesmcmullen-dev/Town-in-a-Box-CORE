// src/http/routes/meetings.routes.ts
//
// REST API routes for the Meetings engine (including AI endpoints).

import { Router, Request, Response, NextFunction } from 'express';
import {
  AiMeetingsService,
  TenantContext,
  MeetingFilter,
  MeetingStatus,
} from '../../index';
import { buildTenantContext } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create meetings router with all endpoints.
 *
 * @param meetings - The AI-enhanced meetings service instance
 */
export function createMeetingsRouter(meetings: AiMeetingsService): Router {
  const router = Router();

  // Middleware to attach tenant context to all routes
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
   *
   * Query params:
   * - bodyId: Filter by governing body
   * - from: Filter by start date (ISO 8601)
   * - to: Filter by end date (ISO 8601)
   * - status: Filter by status (planned, noticed, inSession, adjourned, cancelled)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: MeetingFilter = {};

      if (req.query.bodyId) {
        filter.bodyId = String(req.query.bodyId);
      }
      if (req.query.from) {
        filter.fromDate = new Date(String(req.query.from));
      }
      if (req.query.to) {
        filter.toDate = new Date(String(req.query.to));
      }
      if (req.query.status) {
        filter.status = String(req.query.status) as MeetingStatus;
      }

      const list = await meetings.listMeetings(ctx, filter);
      res.json(list);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings
   * Schedule a new meeting.
   *
   * Body: ScheduleMeetingInput
   * - bodyId: Governing body ID
   * - type: 'regular' | 'special' | 'emergency' | 'executiveSession'
   * - scheduledStart: ISO 8601 datetime
   * - scheduledEnd?: ISO 8601 datetime
   * - location: Meeting location
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
      res.status(201).json(meeting);
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
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      res.json(meeting);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/cancel
   * Cancel a meeting.
   *
   * Body:
   * - reason?: Cancellation reason
   */
  router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const updated = await meetings.cancelMeeting(
        ctx,
        req.params.id,
        req.body.reason
      );
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/notice
   * Record that notice has been posted for a meeting.
   *
   * Body: MarkNoticePostedInput
   * - postedAt: ISO 8601 datetime
   * - postedByUserId: User who posted
   * - methods: Array of notice methods
   * - locations: Array of posting locations
   * - proofUris?: Array of proof document URIs
   * - notes?: Additional notes
   */
  router.post('/:id/notice', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const updated = await meetings.markNoticePosted(ctx, {
        meetingId: req.params.id,
        postedAt: new Date(req.body.postedAt),
        postedByUserId: req.body.postedByUserId,
        methods: req.body.methods,
        locations: req.body.locations,
        proofUris: req.body.proofUris,
        notes: req.body.notes,
        requiredLeadTimeHours: req.body.requiredLeadTimeHours,
      });

      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // AI-ENHANCED ENDPOINTS
  // ===========================================================================

  /**
   * POST /api/meetings/:id/ai/summary
   * Generate AI summary of meeting agenda for council packet.
   *
   * Body:
   * - agendaText: The agenda text to summarize
   *
   * Returns: Meeting with aiCouncilSummary and aiSummaryGeneratedAt populated
   */
  router.post('/:id/ai/summary', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.agendaText) {
        res.status(400).json({ error: 'agendaText is required' });
        return;
      }

      const updated = await meetings.generateCouncilSummary(
        ctx,
        req.params.id,
        req.body.agendaText
      );

      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/ai/deadlines/scan
   * Scan meeting materials for deadlines using AI.
   *
   * Body:
   * - packetText: The meeting packet/agenda text to scan
   *
   * Returns: Meeting with aiExtractedDeadlines populated (isConfirmed=false)
   */
  router.post('/:id/ai/deadlines/scan', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.packetText) {
        res.status(400).json({ error: 'packetText is required' });
        return;
      }

      const updated = await meetings.scanForDeadlines(
        ctx,
        req.params.id,
        req.body.packetText
      );

      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/meetings/:id/ai/deadlines/:deadlineId/review
   * Confirm or reject an AI-extracted deadline after human review.
   *
   * Body:
   * - isConfirmed: boolean - true to confirm, false to reject
   *
   * Returns: Meeting with updated deadline
   */
  router.post(
    '/:id/ai/deadlines/:deadlineId/review',
    async (req: Request, res: Response) => {
      try {
        const ctx = (req as ApiRequest).ctx;

        if (typeof req.body.isConfirmed !== 'boolean') {
          res.status(400).json({ error: 'isConfirmed (boolean) is required' });
          return;
        }

        const updated = await meetings.reviewDeadline(
          ctx,
          req.params.id,
          req.params.deadlineId,
          req.body.isConfirmed
        );

        res.json(updated);
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

  // Map known errors to HTTP status codes
  if (message.includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('Cannot cancel')) {
    res.status(400).json({ error: message });
    return;
  }

  if (message.includes('Cannot post notice')) {
    res.status(400).json({ error: message });
    return;
  }

  // Log unexpected errors
  console.error('API Error:', err);
  res.status(500).json({ error: message });
}
