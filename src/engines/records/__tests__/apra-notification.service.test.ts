// src/engines/records/__tests__/apra-notification.service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ApraNotificationService } from '../apra-notification.service';
import { InMemoryApraService } from '../in-memory-apra.service';
import { InMemoryNotificationService } from '../../../core/notifications/in-memory-notification.service';
import { TenantContext } from '../../../core/tenancy/tenancy.types';

describe('ApraNotificationService', () => {
  let apraService: InMemoryApraService;
  let notificationService: InMemoryNotificationService;
  let apraNotificationService: ApraNotificationService;
  let ctx: TenantContext;

  beforeEach(() => {
    apraService = new InMemoryApraService();
    notificationService = new InMemoryNotificationService();
    apraNotificationService = new ApraNotificationService(
      apraService,
      notificationService,
      {
        defaultStaffUserId: 'clerk-1',
        defaultStaffEmail: 'clerk@town.gov',
        warningDays: 2,
        urgentDays: 1,
      }
    );
    ctx = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      jurisdiction: {
        tenantId: 'test-tenant',
        state: 'IN',
        kind: 'town',
        name: 'Test Town',
        authorityTags: [],
      },
    };
  });

  describe('notifyNewRequest', () => {
    it('should send notification when new request is created', async () => {
      const request = await apraService.createRequest(ctx, {
        requesterName: 'John Doe',
        requesterEmail: 'john@example.com',
        description: 'All council meeting minutes from 2024.',
      });

      await apraNotificationService.notifyNewRequest(ctx, request);

      const notifications = notificationService.getAllNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('apra_new_request');
      expect(notifications[0].subject).toContain('John Doe');
      expect(notifications[0].body).toContain('council meeting minutes');
      expect(notifications[0].recipientUserId).toBe('clerk-1');
    });

    it('should include request details in notification', async () => {
      const request = await apraService.createRequest(ctx, {
        requesterName: 'Reporter Smith',
        description: 'Budget documents from FY2023.',
      });

      await apraNotificationService.notifyNewRequest(ctx, request);

      const notifications = notificationService.getAllNotifications();
      expect(notifications[0].relatedEntityId).toBe(request.id);
      expect(notifications[0].relatedEntityType).toBe('apra_request');
    });
  });

  describe('notifyStatusChange', () => {
    it('should send notification on status change', async () => {
      const request = await apraService.createRequest(ctx, {
        requesterName: 'Jane Citizen',
        description: 'Test request.',
      });

      await apraNotificationService.notifyStatusChange(
        ctx,
        request,
        'RECEIVED'
      );

      const notifications = notificationService.getAllNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('apra_status_change');
      expect(notifications[0].subject).toContain('RECEIVED');
    });
  });

  describe('notifyClarificationReceived', () => {
    it('should send notification when clarification is received', async () => {
      const request = await apraService.createRequest(ctx, {
        requesterName: 'Researcher',
        description: 'Records about project.',
      });

      await apraNotificationService.notifyClarificationReceived(
        ctx,
        request,
        'The downtown renovation project from 2023.'
      );

      const notifications = notificationService.getAllNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].priority).toBe('high');
      expect(notifications[0].body).toContain('downtown renovation');
    });
  });

  describe('checkDeadlines', () => {
    it('should return summary of checked requests', async () => {
      // Create multiple requests
      await apraService.createRequest(ctx, {
        requesterName: 'User 1',
        description: 'Request 1.',
      });
      await apraService.createRequest(ctx, {
        requesterName: 'User 2',
        description: 'Request 2.',
      });

      const result = await apraNotificationService.checkDeadlines(ctx);

      expect(result.requestsChecked).toBe(2);
      expect(typeof result.notificationsSent).toBe('number');
      expect(Array.isArray(result.approachingDeadline)).toBe(true);
      expect(Array.isArray(result.pastDeadline)).toBe(true);
      expect(result.checkedAt).toBeDefined();
    });

    it('should not check fulfilled requests', async () => {
      const request = await apraService.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Test request.',
      });

      // Mark as fulfilled
      await apraService.updateStatus(ctx, request.id, 'FULFILLED');

      const result = await apraNotificationService.checkDeadlines(ctx);

      // Fulfilled requests should not be included
      expect(result.requestsChecked).toBe(0);
    });
  });
});
