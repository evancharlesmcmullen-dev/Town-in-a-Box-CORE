// src/http/server.test.ts
// Integration tests for the HTTP API.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './server';
import { InMemoryMeetingsService } from '../engines/meetings/in-memory-meetings.service';
import { MockAiClient } from './ai.routes';

describe('HTTP API', () => {
  let app: ReturnType<typeof createApp>;
  let meetingsService: InMemoryMeetingsService;
  let aiClient: MockAiClient;

  beforeEach(() => {
    meetingsService = new InMemoryMeetingsService();
    aiClient = new MockAiClient();
    app = createApp({ meetingsService, aiClient });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Health check
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Meetings API
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/meetings', () => {
    it('creates a meeting with valid input', async () => {
      const scheduledStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart,
          location: 'Town Hall',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        bodyId: 'council-1',
        type: 'regular',
        status: 'planned',
        location: 'Town Hall',
      });
      expect(res.body.id).toBeDefined();
    });

    it('rejects missing bodyId', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          type: 'regular',
          scheduledStart: new Date().toISOString(),
          location: 'Town Hall',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('bodyId');
    });

    it('rejects invalid meeting type', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'invalid-type',
          scheduledStart: new Date().toISOString(),
          location: 'Town Hall',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('type');
    });

    it('rejects invalid scheduledStart date', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: 'not-a-date',
          location: 'Town Hall',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('scheduledStart');
    });

    it('rejects scheduledEnd before scheduledStart', async () => {
      const now = Date.now();
      const res = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: new Date(now + 7200000).toISOString(),
          scheduledEnd: new Date(now).toISOString(),
          location: 'Town Hall',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('scheduledEnd');
    });
  });

  describe('GET /api/meetings/:id', () => {
    it('returns a meeting by ID', async () => {
      // First create a meeting
      const createRes = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Town Hall',
        });

      const meetingId = createRes.body.id;

      // Then fetch it
      const res = await request(app).get(`/api/meetings/${meetingId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(meetingId);
      expect(res.body.bodyId).toBe('council-1');
    });

    it('returns 404 for non-existent meeting', async () => {
      const res = await request(app).get('/api/meetings/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/meetings/:id/cancel', () => {
    it('cancels a meeting', async () => {
      // First create a meeting
      const createRes = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Town Hall',
        });

      const meetingId = createRes.body.id;

      // Then cancel it
      const res = await request(app).post(`/api/meetings/${meetingId}/cancel`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
      expect(res.body.cancelledAt).toBeDefined();
    });

    it('returns 404 for non-existent meeting', async () => {
      const res = await request(app).post('/api/meetings/non-existent-id/cancel');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/meetings/:id/notice', () => {
    it('marks notice as posted with valid payload', async () => {
      // First create a meeting
      const scheduledStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const createRes = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: scheduledStart.toISOString(),
          location: 'Town Hall',
        });

      const meetingId = createRes.body.id;

      // Post notice 3 days before (on time for 48-hour requirement)
      const postedAt = new Date(scheduledStart.getTime() - 3 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/notice`)
        .send({
          postedAt: postedAt.toISOString(),
          postedByUserId: 'clerk-1',
          methods: ['physicalPosting', 'website'],
          locations: ['Town Hall', 'Library'],
        });

      expect(res.status).toBe(200);
      expect(res.body.openDoorCompliance).toBeDefined();
      expect(res.body.openDoorCompliance.timeliness).toBe('onTime');
      expect(res.body.openDoorCompliance.requiredPostedBy).toBeDefined();
      expect(res.body.openDoorCompliance.actualPostedAt).toBeDefined();
      // Verify ISO pattern
      expect(res.body.openDoorCompliance.requiredPostedBy).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(res.body.openDoorCompliance.actualPostedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('rejects missing postedAt', async () => {
      const createRes = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Town Hall',
        });

      const res = await request(app)
        .post(`/api/meetings/${createRes.body.id}/notice`)
        .send({
          postedByUserId: 'clerk-1',
          methods: ['physicalPosting'],
          locations: ['Town Hall'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects empty methods array', async () => {
      const createRes = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Town Hall',
        });

      const res = await request(app)
        .post(`/api/meetings/${createRes.body.id}/notice`)
        .send({
          postedAt: new Date().toISOString(),
          postedByUserId: 'clerk-1',
          methods: [],
          locations: ['Town Hall'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('methods');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AI API
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/ai/summary', () => {
    it('generates AI summary with valid input', async () => {
      const res = await request(app)
        .post('/api/ai/summary')
        .send({
          agendaText: 'Call to order. Roll call. Approve minutes. New business.',
        });

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary).toContain('Mock AI Summary');
    });

    it('rejects empty agendaText', async () => {
      const res = await request(app)
        .post('/api/ai/summary')
        .send({
          agendaText: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('agendaText');
    });

    it('rejects missing agendaText', async () => {
      const res = await request(app)
        .post('/api/ai/summary')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/meetings/:id/ai/summary', () => {
    it('generates and stores AI summary for a meeting', async () => {
      // First create a meeting
      const createRes = await request(app)
        .post('/api/meetings')
        .send({
          bodyId: 'council-1',
          type: 'regular',
          scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Town Hall',
        });

      const meetingId = createRes.body.id;

      // Generate AI summary
      const res = await request(app)
        .post(`/api/meetings/${meetingId}/ai/summary`)
        .send({
          agendaText: 'Call to order. Roll call. Approve minutes. New business.',
        });

      expect(res.status).toBe(200);
      expect(res.body.aiCouncilSummary).toBeDefined();
      expect(res.body.aiCouncilSummary).toContain('Mock AI Summary');
    });

    it('returns 404 for non-existent meeting', async () => {
      const res = await request(app)
        .post('/api/meetings/non-existent-id/ai/summary')
        .send({
          agendaText: 'Call to order.',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/ai/deadlines/scan', () => {
    it('scans packet for deadlines', async () => {
      const res = await request(app)
        .post('/api/ai/deadlines/scan')
        .send({
          packetText: 'Budget proposal due next week. Zoning review deadline in two weeks.',
        });

      expect(res.status).toBe(200);
      expect(res.body.deadlines).toBeDefined();
      expect(Array.isArray(res.body.deadlines)).toBe(true);
      expect(res.body.deadlines.length).toBeGreaterThan(0);
      expect(res.body.deadlines[0].id).toBeDefined();
      expect(res.body.deadlines[0].description).toBeDefined();
    });

    it('rejects empty packetText', async () => {
      const res = await request(app)
        .post('/api/ai/deadlines/scan')
        .send({
          packetText: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/ai/deadlines/:deadlineId/review', () => {
    it('confirms a scanned deadline', async () => {
      // First scan for deadlines
      const scanRes = await request(app)
        .post('/api/ai/deadlines/scan')
        .send({
          packetText: 'Budget proposal due next week.',
        });

      const deadlineId = scanRes.body.deadlines[0].id;

      // Confirm the deadline
      const res = await request(app)
        .post(`/api/ai/deadlines/${deadlineId}/review`)
        .send({
          isConfirmed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.isConfirmed).toBe(true);
    });

    it('rejects missing isConfirmed', async () => {
      // First scan for deadlines
      const scanRes = await request(app)
        .post('/api/ai/deadlines/scan')
        .send({
          packetText: 'Budget proposal due next week.',
        });

      const deadlineId = scanRes.body.deadlines[0].id;

      const res = await request(app)
        .post(`/api/ai/deadlines/${deadlineId}/review`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for non-existent deadline', async () => {
      const res = await request(app)
        .post('/api/ai/deadlines/non-existent-id/review')
        .send({
          isConfirmed: true,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns structured error for validation failures', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    });
  });
});
