// src/http/server.test.ts
// Integration tests for the HTTP API.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createServer } from './server';

// Use mock AI provider for tests
beforeAll(() => {
  process.env.AI_PROVIDER = 'mock';
});

describe('HTTP API', () => {
  let app: Express;

  beforeEach(async () => {
    const server = await createServer();
    app = server.app;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Health check
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
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
      expect(res.body.error).toContain('not found');
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
      const res = await request(app)
        .post(`/api/meetings/${meetingId}/cancel`)
        .send({ reason: 'Test cancellation' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
      expect(res.body.cancelledAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AI endpoints
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/meetings/:id/ai/summary', () => {
    it('generates AI summary for a meeting', async () => {
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
  });
});
