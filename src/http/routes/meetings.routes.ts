// src/http/routes/meetings.routes.ts

import { Router } from 'express';
import { buildTenantContext } from '../context';
import { createAiBootstrap } from '../../core/ai/ai-bootstrap';
import { InMemoryMeetingsService } from '../../engines/meetings/in-memory-meetings.service';

/**
 * Create the meetings router with all endpoints.
 *
 * Uses in-memory storage and mock AI provider for dev mode.
 */
export function createMeetingsRouter(): Router {
  const router = Router();
  const ai = createAiBootstrap();

  const baseMeetings = new InMemoryMeetingsService();
  const meetings = ai.aiMeetingsService(baseMeetings);

  // List meetings
  router.get('/', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const list = await meetings.listMeetings(ctx, {});
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get meeting by id
  router.get('/:id', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const meeting = await meetings.getMeeting(ctx, req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(meeting);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Schedule meeting
  router.post('/', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const meeting = await meetings.scheduleMeeting(ctx, {
        ...req.body,
        scheduledStart: new Date(req.body.scheduledStart),
        scheduledEnd: req.body.scheduledEnd
          ? new Date(req.body.scheduledEnd)
          : undefined,
      });
      res.status(201).json(meeting);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Cancel meeting
  router.post('/:id/cancel', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const updated = await meetings.cancelMeeting(ctx, req.params.id, req.body.reason);
      res.json(updated);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  // Mark notice posted (Open Door compliance)
  router.post('/:id/notice', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const updated = await meetings.markNoticePosted(ctx, {
        meetingId: req.params.id,
        postedAt: new Date(req.body.postedAt),
        postedByUserId: req.body.postedByUserId,
        methods: req.body.methods,
        locations: req.body.locations,
        notes: req.body.notes,
      });
      res.json(updated);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  // AI: generate council summary
  router.post('/:id/ai/summary', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const updated = await meetings.generateCouncilSummary(
        ctx,
        req.params.id,
        req.body.agendaText
      );
      res.json(updated);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  // AI: scan for deadlines
  router.post('/:id/ai/deadlines/scan', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const updated = await meetings.scanForDeadlines(
        ctx,
        req.params.id,
        req.body.packetText
      );
      res.json(updated);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  // AI: review deadline
  router.post('/:id/ai/deadlines/:deadlineId/review', async (req, res) => {
    try {
      const ctx = buildTenantContext(req);
      const updated = await meetings.reviewDeadline(
        ctx,
        req.params.id,
        req.params.deadlineId,
        req.body.isConfirmed
      );
      res.json(updated);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  return router;
}
