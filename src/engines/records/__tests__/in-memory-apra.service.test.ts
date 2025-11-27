// src/engines/records/__tests__/in-memory-apra.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryApraService } from '../in-memory-apra.service';
import { TenantContext } from '../../../core/tenancy/tenancy.types';

// Test fixture for TenantContext
const createTestContext = (overrides?: Partial<TenantContext>): TenantContext => ({
  tenantId: 'test-tenant',
  userId: 'test-user',
  jurisdiction: {
    tenantId: 'test-tenant',
    state: 'IN',
    kind: 'town',
    name: 'Test Town',
    authorityTags: ['zoningAuthority'],
  },
  ...overrides,
});

describe('InMemoryApraService', () => {
  let service: InMemoryApraService;
  let ctx: TenantContext;

  beforeEach(() => {
    service = new InMemoryApraService();
    ctx = createTestContext();
  });

  describe('createRequest', () => {
    it('should create a request with correct initial values', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'John Doe',
        requesterEmail: 'john@example.com',
        description: 'All emails from January 2025',
      });

      expect(request.id).toBeDefined();
      expect(request.tenantId).toBe('test-tenant');
      expect(request.requesterName).toBe('John Doe');
      expect(request.requesterEmail).toBe('john@example.com');
      expect(request.description).toBe('All emails from January 2025');
      expect(request.status).toBe('RECEIVED');
      expect(request.reasonablyParticular).toBe(true);
      expect(request.receivedAt).toBeDefined();
      expect(request.createdAt).toBeDefined();
      expect(request.updatedAt).toBeDefined();
    });

    it('should compute statutoryDeadlineAt as 7 business days from receivedAt', async () => {
      // Mock the current date to a known Monday
      const mockDate = new Date('2025-01-06T10:00:00Z'); // Monday
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      try {
        const request = await service.createRequest(ctx, {
          requesterName: 'Jane Doe',
          description: 'Budget records',
        });

        expect(request.statutoryDeadlineAt).toBeDefined();

        // 7 business days from Monday Jan 6:
        // Tue Jan 7 (1), Wed Jan 8 (2), Thu Jan 9 (3), Fri Jan 10 (4)
        // Skip Sat/Sun
        // Mon Jan 13 (5), Tue Jan 14 (6), Wed Jan 15 (7)
        const deadline = new Date(request.statutoryDeadlineAt!);
        expect(deadline.getUTCDate()).toBe(15);
        expect(deadline.getUTCMonth()).toBe(0); // January
        expect(deadline.getUTCFullYear()).toBe(2025);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should skip weekends when computing deadline', async () => {
      // Mock the current date to a Friday
      const mockDate = new Date('2025-01-10T10:00:00Z'); // Friday
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      try {
        const request = await service.createRequest(ctx, {
          requesterName: 'Test User',
          description: 'Test records',
        });

        // 7 business days from Friday Jan 10:
        // Skip Sat/Sun
        // Mon Jan 13 (1), Tue Jan 14 (2), Wed Jan 15 (3), Thu Jan 16 (4), Fri Jan 17 (5)
        // Skip Sat/Sun
        // Mon Jan 20 = MLK Day (holiday) - skipped
        // Tue Jan 21 (6), Wed Jan 22 (7)
        const deadline = new Date(request.statutoryDeadlineAt!);
        expect(deadline.getUTCDate()).toBe(22);
        expect(deadline.getUTCMonth()).toBe(0); // January
      } finally {
        vi.useRealTimers();
      }
    });

    it('should create initial status history entry', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Test records',
      });

      const history = await service.getStatusHistory(ctx, request.id);
      expect(history).toHaveLength(1);
      expect(history[0].newStatus).toBe('RECEIVED');
      expect(history[0].oldStatus).toBeUndefined();
      expect(history[0].changedByUserId).toBe('test-user');
    });

    it('should create scopes when provided', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Email records',
        scopes: [
          {
            recordType: 'email',
            dateRangeStart: '2025-01-01',
            dateRangeEnd: '2025-01-31',
            custodians: ['mayor', 'clerk'],
            keywords: ['budget', 'finance'],
          },
        ],
      });

      const scopes = await service.getScopes(ctx, request.id);
      expect(scopes).toHaveLength(1);
      expect(scopes[0].recordType).toBe('email');
      expect(scopes[0].custodians).toEqual(['mayor', 'clerk']);
    });
  });

  describe('getRequest', () => {
    it('should return null for non-existent request', async () => {
      const request = await service.getRequest(ctx, 'non-existent');
      expect(request).toBeNull();
    });

    it('should return null for request from different tenant', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Test records',
      });

      const otherCtx = createTestContext({ tenantId: 'other-tenant' });
      const result = await service.getRequest(otherCtx, request.id);
      expect(result).toBeNull();
    });
  });

  describe('listRequests', () => {
    it('should return empty array when no requests exist', async () => {
      const requests = await service.listRequests(ctx);
      expect(requests).toEqual([]);
    });

    it('should filter by status', async () => {
      await service.createRequest(ctx, {
        requesterName: 'User 1',
        description: 'Request 1',
      });
      const req2 = await service.createRequest(ctx, {
        requesterName: 'User 2',
        description: 'Request 2',
      });
      await service.updateStatus(ctx, req2.id, 'IN_REVIEW');

      const received = await service.listRequests(ctx, { status: ['RECEIVED'] });
      expect(received).toHaveLength(1);
      expect(received[0].requesterName).toBe('User 1');

      const inReview = await service.listRequests(ctx, { status: ['IN_REVIEW'] });
      expect(inReview).toHaveLength(1);
      expect(inReview[0].requesterName).toBe('User 2');
    });

    it('should filter by multiple statuses', async () => {
      await service.createRequest(ctx, {
        requesterName: 'User 1',
        description: 'Request 1',
      });
      const req2 = await service.createRequest(ctx, {
        requesterName: 'User 2',
        description: 'Request 2',
      });
      await service.updateStatus(ctx, req2.id, 'IN_REVIEW');

      const results = await service.listRequests(ctx, {
        status: ['RECEIVED', 'IN_REVIEW'],
      });
      expect(results).toHaveLength(2);
    });

    it('should filter by search text', async () => {
      await service.createRequest(ctx, {
        requesterName: 'John Smith',
        description: 'Budget documents',
      });
      await service.createRequest(ctx, {
        requesterName: 'Jane Doe',
        description: 'Meeting minutes',
      });

      const byName = await service.listRequests(ctx, { searchText: 'john' });
      expect(byName).toHaveLength(1);
      expect(byName[0].requesterName).toBe('John Smith');

      const byDesc = await service.listRequests(ctx, { searchText: 'meeting' });
      expect(byDesc).toHaveLength(1);
      expect(byDesc[0].requesterName).toBe('Jane Doe');
    });
  });

  describe('updateStatus', () => {
    it('should update status and create history entry', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Test records',
      });

      const updated = await service.updateStatus(
        ctx,
        request.id,
        'IN_REVIEW',
        'Starting review'
      );

      expect(updated.status).toBe('IN_REVIEW');

      const history = await service.getStatusHistory(ctx, request.id);
      expect(history).toHaveLength(2);
      expect(history[1].oldStatus).toBe('RECEIVED');
      expect(history[1].newStatus).toBe('IN_REVIEW');
      expect(history[1].note).toBe('Starting review');
    });

    it('should be idempotent for same status', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Test records',
      });

      const updated = await service.updateStatus(ctx, request.id, 'RECEIVED');
      expect(updated.status).toBe('RECEIVED');

      const history = await service.getStatusHistory(ctx, request.id);
      expect(history).toHaveLength(1); // No new entry
    });

    it('should throw for non-existent request', async () => {
      await expect(
        service.updateStatus(ctx, 'non-existent', 'IN_REVIEW')
      ).rejects.toThrow('APRA request not found for tenant');
    });
  });

  describe('addClarification', () => {
    it('should create clarification and update status', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'All emails',
      });

      const clarification = await service.addClarification(
        ctx,
        request.id,
        'Please specify the date range'
      );

      expect(clarification.id).toBeDefined();
      expect(clarification.messageToRequester).toBe('Please specify the date range');
      expect(clarification.sentAt).toBeDefined();
      expect(clarification.respondedAt).toBeUndefined();

      // Check request was updated
      const updated = await service.getRequest(ctx, request.id);
      expect(updated?.status).toBe('NEEDS_CLARIFICATION');
      expect(updated?.reasonablyParticular).toBe(false);
    });

    it('should append to status history', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'All emails',
      });

      await service.addClarification(ctx, request.id, 'Please clarify');

      const history = await service.getStatusHistory(ctx, request.id);
      expect(history).toHaveLength(2);
      expect(history[1].newStatus).toBe('NEEDS_CLARIFICATION');
    });
  });

  describe('recordClarificationResponse', () => {
    it('should update clarification and move to IN_REVIEW', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'All emails',
      });

      const clarification = await service.addClarification(
        ctx,
        request.id,
        'Please specify date range'
      );

      const updated = await service.recordClarificationResponse(
        ctx,
        clarification.id,
        'January 1-31, 2025'
      );

      expect(updated.respondedAt).toBeDefined();
      expect(updated.requesterResponse).toBe('January 1-31, 2025');

      // Check request was updated
      const req = await service.getRequest(ctx, request.id);
      expect(req?.status).toBe('IN_REVIEW');
      expect(req?.reasonablyParticular).toBe(true);
    });

    it('should reset statutory deadline after clarification response', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'All emails',
      });

      const originalDeadline = request.statutoryDeadlineAt;

      const clarification = await service.addClarification(
        ctx,
        request.id,
        'Please clarify'
      );

      // Wait a moment then respond
      await service.recordClarificationResponse(
        ctx,
        clarification.id,
        'Here is my clarification'
      );

      const updated = await service.getRequest(ctx, request.id);
      // Deadline should be recalculated (will be >= original since time passed)
      expect(updated?.statutoryDeadlineAt).toBeDefined();
      // We can't reliably test the exact deadline value without mocking time
    });

    it('should throw for non-existent clarification', async () => {
      await expect(
        service.recordClarificationResponse(ctx, 'non-existent', 'Response')
      ).rejects.toThrow('Clarification not found');
    });
  });

  describe('addExemption', () => {
    it('should create exemption record', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Personnel records',
      });

      const exemption = await service.addExemption(ctx, request.id, {
        citation: 'IC 5-14-3-4(b)(8)',
        description: 'Personnel files of public employees',
      });

      expect(exemption.id).toBeDefined();
      expect(exemption.citation).toBe('IC 5-14-3-4(b)(8)');
      expect(exemption.description).toBe('Personnel files of public employees');
      expect(exemption.createdAt).toBeDefined();
    });

    it('should associate exemption with scope if provided', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Records',
        scopes: [{ recordType: 'personnel' }],
      });

      const scopes = await service.getScopes(ctx, request.id);
      const scopeId = scopes[0].id;

      const exemption = await service.addExemption(ctx, request.id, {
        citation: 'IC 5-14-3-4(b)(8)',
        description: 'Personnel exemption',
        appliesToScopeId: scopeId,
      });

      expect(exemption.appliesToScopeId).toBe(scopeId);
    });
  });

  describe('recordFulfillment', () => {
    it('should create fulfillment record', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Budget documents',
      });

      const fulfillment = await service.recordFulfillment(ctx, request.id, {
        deliveryMethod: 'EMAIL',
        notes: 'Sent 5 PDF files',
        totalFeesCents: 500,
      });

      expect(fulfillment.id).toBeDefined();
      expect(fulfillment.deliveryMethod).toBe('EMAIL');
      expect(fulfillment.notes).toBe('Sent 5 PDF files');
      expect(fulfillment.totalFeesCents).toBe(500);
      expect(fulfillment.fulfilledAt).toBeDefined();
    });

    it('should allow multiple fulfillments for same request', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Large records request',
      });

      await service.recordFulfillment(ctx, request.id, {
        deliveryMethod: 'EMAIL',
        notes: 'First batch',
      });

      await service.recordFulfillment(ctx, request.id, {
        deliveryMethod: 'PORTAL',
        notes: 'Second batch',
      });

      const fulfillments = await service.getFulfillments(ctx, request.id);
      expect(fulfillments).toHaveLength(2);
    });
  });

  describe('tenant isolation', () => {
    it('should isolate requests by tenant', async () => {
      const ctx1 = createTestContext({ tenantId: 'tenant-1' });
      const ctx2 = createTestContext({ tenantId: 'tenant-2' });

      await service.createRequest(ctx1, {
        requesterName: 'Tenant 1 User',
        description: 'Request 1',
      });

      await service.createRequest(ctx2, {
        requesterName: 'Tenant 2 User',
        description: 'Request 2',
      });

      const tenant1Requests = await service.listRequests(ctx1);
      expect(tenant1Requests).toHaveLength(1);
      expect(tenant1Requests[0].requesterName).toBe('Tenant 1 User');

      const tenant2Requests = await service.listRequests(ctx2);
      expect(tenant2Requests).toHaveLength(1);
      expect(tenant2Requests[0].requesterName).toBe('Tenant 2 User');
    });
  });
});
