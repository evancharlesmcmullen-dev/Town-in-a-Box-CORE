// src/http/__tests__/township.routes.test.ts
// Integration tests for Township HTTP API endpoints.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createServer } from '../server';

// Use mock AI provider for tests
beforeAll(() => {
  process.env.AI_PROVIDER = 'mock';
});

describe('Township API', () => {
  let app: Express;

  beforeEach(async () => {
    const server = await createServer();
    app = server.app;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tenant Access Control
  // ─────────────────────────────────────────────────────────────────────────

  describe('Tenant Access Control', () => {
    it('returns 403 for non-township tenant on assistance endpoint', async () => {
      const res = await request(app)
        .get('/api/township/assistance/cases')
        .set('x-tenant-id', 'lapel-in'); // Town, not township

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('township');
    });

    it('returns 403 for non-township tenant on fence-viewer endpoint', async () => {
      const res = await request(app)
        .get('/api/township/fence-viewer/cases')
        .set('x-tenant-id', 'anderson-in'); // City, not township

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('township');
    });

    it('returns 200 for township tenant on assistance endpoint', async () => {
      const res = await request(app)
        .get('/api/township/assistance/cases')
        .set('x-tenant-id', 'fall-creek-twp'); // Township tenant

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 200 for township tenant on fence-viewer endpoint', async () => {
      const res = await request(app)
        .get('/api/township/fence-viewer/cases')
        .set('x-tenant-id', 'fall-creek-twp');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Township Assistance
  // ─────────────────────────────────────────────────────────────────────────

  describe('Township Assistance API', () => {
    const TENANT_HEADER = { 'x-tenant-id': 'fall-creek-twp' };

    describe('POST /api/township/assistance/applications', () => {
      it('creates an application with valid input', async () => {
        const res = await request(app)
          .post('/api/township/assistance/applications')
          .set(TENANT_HEADER)
          .send({
            applicantName: 'John Doe',
            applicantPhone: '765-555-1234',
            household: [
              { name: 'John Doe', age: 45, relationship: 'applicant' },
            ],
            requestedBenefitTypes: ['rent', 'utilities'],
          });

        expect(res.status).toBe(201);
        expect(res.body.applicantName).toBe('John Doe');
        expect(res.body.id).toBeDefined();
      });

      it('returns 400 when applicantName is missing', async () => {
        const res = await request(app)
          .post('/api/township/assistance/applications')
          .set(TENANT_HEADER)
          .send({
            household: [],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('applicantName');
      });
    });

    describe('GET /api/township/assistance/cases', () => {
      it('returns empty array when no cases exist', async () => {
        const res = await request(app)
          .get('/api/township/assistance/cases')
          .set(TENANT_HEADER);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Fence Viewer
  // ─────────────────────────────────────────────────────────────────────────

  describe('Fence Viewer API', () => {
    const TENANT_HEADER = { 'x-tenant-id': 'fall-creek-twp' };

    describe('POST /api/township/fence-viewer/cases', () => {
      it('creates a case with valid input', async () => {
        const res = await request(app)
          .post('/api/township/fence-viewer/cases')
          .set(TENANT_HEADER)
          .send({
            disputeType: 'boundary',
            fenceLocationDescription: 'Between parcels 48-11-01-100-001 and 48-11-01-100-002',
          });

        expect(res.status).toBe(201);
        expect(res.body.disputeType).toBe('boundary');
        expect(res.body.id).toBeDefined();
        expect(res.body.caseNumber).toBeDefined();
      });

      it('returns 400 when disputeType is missing', async () => {
        const res = await request(app)
          .post('/api/township/fence-viewer/cases')
          .set(TENANT_HEADER)
          .send({
            fenceLocationDescription: 'Some location',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('disputeType');
      });

      it('returns 400 when fenceLocationDescription is missing', async () => {
        const res = await request(app)
          .post('/api/township/fence-viewer/cases')
          .set(TENANT_HEADER)
          .send({
            disputeType: 'boundary',
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('fenceLocationDescription');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Insurance & Bonds
  // ─────────────────────────────────────────────────────────────────────────

  describe('Insurance & Bonds API', () => {
    const TENANT_HEADER = { 'x-tenant-id': 'fall-creek-twp' };

    describe('POST /api/township/insurance/bonds', () => {
      it('creates a bond with valid input', async () => {
        const res = await request(app)
          .post('/api/township/insurance/bonds')
          .set(TENANT_HEADER)
          .send({
            bondType: 'trustee',
            officialName: 'James Smith',
            officialTitle: 'Township Trustee',
            bondAmountCents: 1500000,
            effectiveDate: '2025-01-01',
            expirationDate: '2028-12-31',
          });

        expect(res.status).toBe(201);
        expect(res.body.officialName).toBe('James Smith');
        expect(res.body.bondType).toBe('trustee');
        expect(res.body.id).toBeDefined();
      });

      it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
          .post('/api/township/insurance/bonds')
          .set(TENANT_HEADER)
          .send({
            bondType: 'trustee',
            // Missing other required fields
          });

        expect(res.status).toBe(400);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Policies (Shared - No Township Restriction)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Policies API (Shared)', () => {
    it('allows access from any tenant type', async () => {
      // Town tenant can access policies
      const townRes = await request(app)
        .get('/api/policies')
        .set('x-tenant-id', 'lapel-in');

      expect(townRes.status).toBe(200);

      // Township tenant can also access policies
      const twpRes = await request(app)
        .get('/api/policies')
        .set('x-tenant-id', 'fall-creek-twp');

      expect(twpRes.status).toBe(200);

      // City tenant can also access policies
      const cityRes = await request(app)
        .get('/api/policies')
        .set('x-tenant-id', 'anderson-in');

      expect(cityRes.status).toBe(200);
    });

    it('creates a policy document', async () => {
      const res = await request(app)
        .post('/api/policies')
        .set('x-tenant-id', 'fall-creek-twp')
        .send({
          documentType: 'policy',
          category: 'eligibility',
          title: 'Township Assistance Eligibility Standards',
          effectiveDate: '2025-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Township Assistance Eligibility Standards');
      expect(res.body.id).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-Tenant Isolation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Multi-Tenant Isolation', () => {
    it('isolates fence viewer cases between townships', async () => {
      // Create a case for Fall Creek Township
      const createRes = await request(app)
        .post('/api/township/fence-viewer/cases')
        .set('x-tenant-id', 'fall-creek-twp')
        .send({
          disputeType: 'repair',
          fenceLocationDescription: 'Fall Creek location',
        });

      const caseId = createRes.body.id;

      // Fall Creek can access the case
      const fallCreekRes = await request(app)
        .get(`/api/township/fence-viewer/cases/${caseId}`)
        .set('x-tenant-id', 'fall-creek-twp');

      expect(fallCreekRes.status).toBe(200);

      // Stony Creek cannot access the case
      const stonyCreekRes = await request(app)
        .get(`/api/township/fence-viewer/cases/${caseId}`)
        .set('x-tenant-id', 'stony-creek-twp');

      expect(stonyCreekRes.status).toBe(404);
    });
  });
});
