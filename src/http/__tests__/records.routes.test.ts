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

  // ─────────────────────────────────────────────────────────────────────────
  // AI Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests/:id/ai/particularity', () => {
    it('analyzes particularity of a request', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails from the mayor to the town council regarding the 2024 budget from January to March 2024',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/ai/particularity`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isParticular');
      expect(res.body).toHaveProperty('confidence');
      expect(res.body).toHaveProperty('reasoning');
      expect(typeof res.body.isParticular).toBe('boolean');
      expect(typeof res.body.confidence).toBe('number');
    });

    it('returns 404 for non-existent request', async () => {
      const res = await request(app)
        .post('/api/records/requests/non-existent/ai/particularity');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/records/requests/:id/ai/exemptions', () => {
    it('suggests exemptions for a request', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All personnel files for police officers',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/ai/exemptions`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/records/requests/:id/ai/scope', () => {
    it('analyzes scope of a request', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails from the mayor about the 2024 budget from January to March',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/ai/scope`);

      expect(res.status).toBe(200);
      // Should have at least some scope analysis fields
      expect(res.body).toBeDefined();
    });
  });

  describe('POST /api/records/requests/:id/ai/response-letter', () => {
    it('drafts a response letter', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Budget records for 2024',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/ai/response-letter`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requestId');
      expect(res.body).toHaveProperty('letter');
      expect(res.body.requestId).toBe(createRes.body.id);
      expect(typeof res.body.letter).toBe('string');
    });
  });

  describe('POST /api/records/requests/:id/ai/particularity/review', () => {
    it('allows reviewing particularity determination', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/ai/particularity/review`)
        .send({
          isParticular: false,
          reason: 'Too vague - needs to specify record type and date range',
        });

      expect(res.status).toBe(200);
      expect(res.body.reasonablyParticular).toBe(false);
      expect(res.body.particularityReason).toBe('Too vague - needs to specify record type and date range');
    });

    it('returns 400 when isParticular is missing', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All records',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/ai/particularity/review`)
        .send({ reason: 'Some reason' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('isParticular');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Fee Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/requests/:id/fees/quote', () => {
    it('calculates fee quote for copies', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Budget documents',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/fees/quote`)
        .send({
          bwPages: 50,
          colorPages: 5,
          requiresMailing: true,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCents');
      expect(res.body).toHaveProperty('formattedTotal');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body).toHaveProperty('isExtensive');
      expect(res.body).toHaveProperty('lines');

      // Check calculation: 50 * $0.10 + 5 * $0.25 + $5 mailing = $5 + $1.25 + $5 = $11.25
      expect(res.body.totalCents).toBe(1125);
      expect(res.body.totalPages).toBe(55);
      expect(res.body.isExtensive).toBe(false);
      expect(res.body.lines).toHaveLength(3); // BW, color, mailing
    });

    it('calculates extensive request fees with labor', async () => {
      const createRes = await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'All emails for 10 years',
        });

      const res = await request(app)
        .post(`/api/records/requests/${createRes.body.id}/fees/quote`)
        .send({
          bwPages: 100,
          laborHours: 5, // 5 hours total, 3 chargeable after 2-hour threshold
        });

      expect(res.status).toBe(200);
      expect(res.body.isExtensive).toBe(true);

      // Should include labor for 3 hours (over 2-hour threshold)
      const laborLine = res.body.lines.find((l: { code: string }) => l.code === 'LABOR');
      expect(laborLine).toBeDefined();
      expect(laborLine.quantity).toBe(3); // 5 - 2 = 3 chargeable hours
    });

    it('returns 404 for non-existent request', async () => {
      const res = await request(app)
        .post('/api/records/requests/non-existent/fees/quote')
        .send({ bwPages: 10 });

      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Deadline Check Endpoint
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/records/deadlines/check', () => {
    it('checks deadlines for all open requests', async () => {
      // Create a request (will have a 7 business day deadline)
      await request(app)
        .post('/api/records/requests')
        .send({
          requesterName: 'John Doe',
          description: 'Some records',
        });

      const res = await request(app)
        .post('/api/records/deadlines/check');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requestsChecked');
      expect(res.body).toHaveProperty('approachingDeadline');
      expect(res.body).toHaveProperty('pastDeadline');
      expect(res.body).toHaveProperty('notificationsSent');
      expect(res.body).toHaveProperty('checkedAt');

      expect(typeof res.body.requestsChecked).toBe('number');
      expect(Array.isArray(res.body.approachingDeadline)).toBe(true);
      expect(Array.isArray(res.body.pastDeadline)).toBe(true);
    });

    it('returns empty results when no requests exist', async () => {
      const res = await request(app)
        .post('/api/records/deadlines/check');

      expect(res.status).toBe(200);
      expect(res.body.requestsChecked).toBe(0);
      expect(res.body.approachingDeadline).toHaveLength(0);
      expect(res.body.pastDeadline).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-Tenant Isolation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Multi-tenant isolation', () => {
    it('isolates requests between tenants', async () => {
      // Create request as tenant A
      const reqA = await request(app)
        .post('/api/records/requests')
        .set('x-tenant-id', 'tenant-a')
        .send({
          requesterName: 'User A',
          description: 'Records for A',
        });

      // Create request as tenant B
      await request(app)
        .post('/api/records/requests')
        .set('x-tenant-id', 'tenant-b')
        .send({
          requesterName: 'User B',
          description: 'Records for B',
        });

      // List as tenant A
      const listA = await request(app)
        .get('/api/records/requests')
        .set('x-tenant-id', 'tenant-a');

      expect(listA.body).toHaveLength(1);
      expect(listA.body[0].requesterName).toBe('User A');

      // Tenant B cannot access tenant A's request
      const getB = await request(app)
        .get(`/api/records/requests/${reqA.body.id}`)
        .set('x-tenant-id', 'tenant-b');

      expect(getB.status).toBe(404);
    });
  });
});
