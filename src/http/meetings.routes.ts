// src/http/meetings.routes.ts
// Meeting routes with request validation.

import { Router, Request, Response } from 'express';
import { MeetingType, MeetingStatus } from '../engines/meetings/meeting.types';
import { InMemoryMeetingsService } from '../engines/meetings/in-memory-meetings.service';
import { MeetingFilter } from '../engines/meetings/meetings.service';
import { ApiRequest, asyncHandler } from './middleware';
import { NotFoundError } from './errors';
import {
  assertString,
  assertOneOf,
  assertIsoDate,
  assertStringArray,
  assertOptionalString,
  assertDateAfter,
} from './validation';

const MEETING_STATUSES: readonly MeetingStatus[] = [
  'planned',
  'noticed',
  'inSession',
  'adjourned',
  'cancelled',
];

const MEETING_TYPES: readonly MeetingType[] = [
  'regular',
  'special',
  'emergency',
  'executiveSession',
];

/**
 * Create meetings router with the provided service.
 */
export function createMeetingsRouter(
  meetingsService: InMemoryMeetingsService
): Router {
  const router = Router();

  /**
   * POST /api/meetings - Schedule a new meeting.
   */
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const body = req.body;

      // Validate required fields
      assertString(body.bodyId, 'bodyId');
      assertOneOf(body.type, MEETING_TYPES, 'type');
      const scheduledStart = assertIsoDate(body.scheduledStart, 'scheduledStart');
      assertString(body.location, 'location');

      // Validate optional fields
      let scheduledEnd: Date | undefined;
      if (body.scheduledEnd !== undefined && body.scheduledEnd !== null) {
        scheduledEnd = assertIsoDate(body.scheduledEnd, 'scheduledEnd');
        assertDateAfter(scheduledEnd, scheduledStart, 'scheduledEnd', 'scheduledStart');
      }

      const meeting = await meetingsService.scheduleMeeting(ctx, {
        bodyId: body.bodyId,
        type: body.type,
        scheduledStart,
        scheduledEnd,
        location: body.location,
      });

      res.status(201).json(meeting);
    })
  );

  /**
   * GET /api/meetings - List meetings.
   */
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;

      // Optional filters from query params
      const filter: MeetingFilter = {};

      if (req.query.bodyId) {
        filter.bodyId = String(req.query.bodyId);
      }
      if (req.query.status) {
        const statusStr = String(req.query.status);
        assertOneOf(statusStr, MEETING_STATUSES, 'status');
        filter.status = statusStr;
      }
      if (req.query.fromDate) {
        filter.fromDate = new Date(String(req.query.fromDate));
      }
      if (req.query.toDate) {
        filter.toDate = new Date(String(req.query.toDate));
      }

      const meetings = await meetingsService.listMeetings(ctx, filter);
      res.json(meetings);
    })
  );

  /**
   * GET /api/meetings/:id - Get a single meeting.
   */
  router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const { id } = req.params;

      const meeting = await meetingsService.getMeeting(ctx, id);
      if (!meeting) {
        throw new NotFoundError(`Meeting not found: ${id}`);
      }

      res.json(meeting);
    })
  );

  /**
   * POST /api/meetings/:id/cancel - Cancel a meeting.
   */
  router.post(
    '/:id/cancel',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const { id } = req.params;

      try {
        const meeting = await meetingsService.cancelMeeting(ctx, id);
        res.json(meeting);
      } catch (err) {
        if (err instanceof Error && err.message.includes('not found')) {
          throw new NotFoundError(`Meeting not found: ${id}`);
        }
        throw err;
      }
    })
  );

  /**
   * POST /api/meetings/:id/notice - Mark notice as posted.
   */
  router.post(
    '/:id/notice',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const { id } = req.params;
      const body = req.body;

      // Validate required fields
      const postedAt = assertIsoDate(body.postedAt, 'postedAt');
      assertString(body.postedByUserId, 'postedByUserId');
      assertStringArray(body.methods, 'methods');
      assertStringArray(body.locations, 'locations');

      // Validate optional fields
      assertOptionalString(body.notes, 'notes');

      try {
        const result = await meetingsService.markNoticePosted(ctx, id, {
          postedAt,
          postedByUserId: body.postedByUserId,
          methods: body.methods,
          locations: body.locations,
          notes: body.notes,
        });

        res.json(result);
      } catch (err) {
        if (err instanceof Error && err.message.includes('not found')) {
          throw new NotFoundError(`Meeting not found: ${id}`);
        }
        throw err;
      }
    })
  );

  return router;
}
