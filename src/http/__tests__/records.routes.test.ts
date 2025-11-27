// src/http/__tests__/records.routes.test.ts
// Integration tests for the Records/APRA HTTP API.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createServer } from '../server';

// Use mock AI provider for tests
beforeAll(() => {
  process.env.AI_PROVIDER = 'mock';
});

describe('Records API', () => {
  let app: Express;

  beforeEach(async () => {
    const server = await createServer();
    app = server.app;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Create Request
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests', () => {
    it('creates a request with valid input', async () => {
      const res = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          requesterEmail: 'john@example.com',
          description: 'All emails from January 2025',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        requesterName: 'John Doe',
        requesterEmail: 'john@example.com',
        description: 'All emails from January 2025',
        status: 'RECEIVED',
        reasonablyParticular: true,
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.statutoryDeadlineAt).toBeDefined();
      expect(res.body.receivedAt).toBeDefined();
    });

    it('includes 7 business-day statutory deadline', async () => {
      const res = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'Jane Doe',
          description: 'Budget records',
        });

      expect(res.status).toBe(201);
      expect(res.body.statutoryDeadlineAt).toBeDefined();

      // Verify deadline is in the future
      const deadline = new Date(res.body.statutoryDeadlineAt);
      const received = new Date(res.body.receivedAt);
      expect(deadline.getTime()).toBeGreaterThan(received.getTime());
    });

    it('returns 400 when requesterName is missing', async () => {
      const res = await request(app)
        .post('/api/records/requests')
        .send({
          description: 'Some records',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('requesterName');
    });

    it('returns 400 when description is missing', async () => {
      const res = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('description');
    });

    it('creates request with scopes', async () => {
      const res = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Email records',
          scopes: [
            {
              recordType: 'email',
              dateRangeStart: '2025-01-01',
              dateRangeEnd: '2025-01-31',
              custodians: ['mayor', 'clerk'],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Get Request
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/records/requests/:id', () => {
    it('returns a request by ID', async () => {
      // First create a request
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Test records',
        });

      const requestId = createRes.body.id;

      // Then fetch it
      const res = await request(app).get(`/api/records/requests/${requestId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(requestId);
      expect(res.body.requesterName).toBe('John Doe');
    });

    it('returns 404 for non-existent request', async () => {
      const res = await request(app).get('/api/records/requests/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // List Requests
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/records/requests', () => {
    it('returns empty array when no requests exist', async () => {
      const res = await request(app).get('/api/records/requests');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all requests for tenant', async () => {
      // Create two requests
      await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'User 1',
          description: 'Request 1',
        });

      await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'User 2',
          description: 'Request 2',
        });

      const res = await request(app).get('/api/records/requests');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by status', async () => {
      // Create two requests
      const req1 = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'User 1',
          description: 'Request 1',
        });

      const req2 = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'User 2',
          description: 'Request 2',
        });

      // Update one to IN_REVIEW
      await request(app)
        .post(`/api/records/requests/${req2.body.id}/status`)
        .send({ newStatus: 'IN_REVIEW' });

      // Filter by RECEIVED
      const received = await request(app)
        .get('/api/records/requests')
        .query({ status: 'RECEIVED' });

      expect(received.status).toBe(200);
      expect(received.body).toHaveLength(1);
      expect(received.body[0].requesterName).toBe('User 1');

      // Filter by IN_REVIEW
      const inReview = await request(app)
        .get('/api/records/requests')
        .query({ status: 'IN_REVIEW' });

      expect(inReview.status).toBe(200);
      expect(inReview.body).toHaveLength(1);
      expect(inReview.body[0].requesterName).toBe('User 2');
    });

    it('filters by multiple statuses', async () => {
      await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'User 1',
          description: 'Request 1',
        });

      const req2 = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'User 2',
          description: 'Request 2',
        });

      await request(app)
        .post(`/api/records/requests/${req2.body.id}/status`)
        .send({ newStatus: 'IN_REVIEW' });

      const res = await request(app)
        .get('/api/records/requests')
        .query({ status: 'RECEIVED,IN_REVIEW' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Status Updates
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests/:id/status', () => {
    it('updates status', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Test records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/status`)
        .send({
          newStatus: 'IN_REVIEW',
          note: 'Starting review',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_REVIEW');
    });

    it('returns 400 for invalid status', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Test records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/status`)
        .send({
          newStatus: 'INVALID_STATUS',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('returns 400 when newStatus is missing', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Test records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/status`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('newStatus');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Clarifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests/:id/clarifications', () => {
    it('creates a clarification', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/clarifications`)
        .send({
          messageToRequester: 'Please specify the date range',
        });

      expect(res.status).toBe(201);
      expect(res.body.messageToRequester).toBe('Please specify the date range');
      expect(res.body.sentAt).toBeDefined();
    });

    it('returns 400 when messageToRequester is missing', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/clarifications`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('messageToRequester');
    });
  });

  describe('POST /api/records/clarifications/:id/response', () => {
    it('records clarification response', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails',
        });

      const clarRes = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/clarifications`)
        .send({
          messageToRequester: 'Please specify date range',
        });

      const res = await request(app)
        .post(`/api/records/clarifications/${clarRes.body.id}/response`)
        .send({
          requesterResponse: 'January 1-31, 2025',
        });

      expect(res.status).toBe(200);
      expect(res.body.requesterResponse).toBe('January 1-31, 2025');
      expect(res.body.respondedAt).toBeDefined();
    });

    it('returns 400 when requesterResponse is missing', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails',
        });

      const clarRes = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/clarifications`)
        .send({
          messageToRequester: 'Please specify date range',
        });

      const res = await request(app)
        .post(`/api/records/clarifications/${clarRes.body.id}/response`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('requesterResponse');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Exemptions
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests/:id/exemptions', () => {
    it('creates an exemption', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Personnel records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/exemptions`)
        .send({
          citation: 'IC 5-14-3-4(b)(8)',
          description: 'Personnel files of public employees',
        });

      expect(res.status).toBe(201);
      expect(res.body.citation).toBe('IC 5-14-3-4(b)(8)');
      expect(res.body.description).toBe('Personnel files of public employees');
    });

    it('returns 400 when citation is missing', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Personnel records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/exemptions`)
        .send({
          description: 'Some exemption',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('citation');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Fulfillment
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests/:id/fulfill', () => {
    it('records fulfillment', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Budget documents',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/fulfill`)
        .send({
          deliveryMethod: 'EMAIL',
          notes: 'Sent 5 PDF files',
          totalFeesCents: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body.deliveryMethod).toBe('EMAIL');
      expect(res.body.notes).toBe('Sent 5 PDF files');
      expect(res.body.totalFeesCents).toBe(500);
    });

    it('returns 400 for invalid delivery method', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Budget documents',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/fulfill`)
        .send({
          deliveryMethod: 'CARRIER_PIGEON',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('deliveryMethod');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Related Data Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/records/requests/:id/history', () => {
    it('returns status history', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Test records',
        });

      await request(app)
        .post(`/api/records/requests/${createRes.body.id}/status`)
        .send({ newStatus: 'IN_REVIEW' });

      const res = await request(app)
        .get(`/api/records/requests/${createRes.body.id}/history`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].newStatus).toBe('RECEIVED');
      expect(res.body[1].newStatus).toBe('IN_REVIEW');
    });
  });

  describe('GET /api/records/requests/:id/scopes', () => {
    it('returns scopes', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Email records',
          scopes: [
            { recordType: 'email', keywords: ['budget'] },
          ],
        });

      const res = await request(app)
        .get(`/api/records/requests/${createRes.body.id}/scopes`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].recordType).toBe('email');
    });
  });

  describe('GET /api/records/requests/:id/clarifications', () => {
    it('returns clarifications', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails',
        });

      await request(app)
        .post(`/api/records/requests/${createRes.body.id}/clarifications`)
        .send({ messageToRequester: 'Please clarify' });

      const res = await request(app)
        .get(`/api/records/requests/${createRes.body.id}/clarifications`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /api/records/requests/:id/exemptions', () => {
    it('returns exemptions', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Personnel records',
        });

      await request(app)
        .post(`/api/records/requests/${createRes.body.id}/exemptions`)
        .send({
          citation: 'IC 5-14-3-4(b)(8)',
          description: 'Personnel exemption',
        });

      const res = await request(app)
        .get(`/api/records/requests/${createRes.body.id}/exemptions`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /api/records/requests/:id/fulfillments', () => {
    it('returns fulfillments', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Budget documents',
        });

      await request(app)
        .post(`/api/records/requests/${createRes.body.id}/fulfill`)
        .send({ deliveryMethod: 'EMAIL' });

      const res = await request(app)
        .get(`/api/records/requests/${createRes.body.id}/fulfillments`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
