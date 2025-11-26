// src/engines/meetings/in-memory-meetings.service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMeetingsService } from './in-memory-meetings.service';
import { Meeting } from './meeting.types';
import { TenantContext } from '../../core/tenancy/tenancy.types';

// Test fixture for TenantContext
const createTestContext = (): TenantContext => ({
  tenantId: 'test-tenant',
  userId: 'test-user',
  jurisdiction: {
    tenantId: 'test-tenant',
    state: 'IN',
    kind: 'town',
    name: 'Test Town',
    authorityTags: ['zoningAuthority'],
  },
});

describe('InMemoryMeetingsService', () => {
  let service: InMemoryMeetingsService;
  let ctx: TenantContext;

  beforeEach(() => {
    service = new InMemoryMeetingsService();
    ctx = createTestContext();
  });

  describe('cancelMeeting', () => {
    it('should cancel a future meeting and set status, cancelledAt, and reason', async () => {
      // Schedule a meeting
      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: new Date('2025-02-01T19:00:00Z'),
        location: 'Town Hall',
      });

      // Cancel with reason
      const cancelled = await service.cancelMeeting(
        ctx,
        meeting.id,
        'Weather emergency'
      );

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      expect(cancelled.cancellationReason).toBe('Weather emergency');
    });

    it('should be idempotent - cancelling already cancelled meeting returns same meeting', async () => {
      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: new Date('2025-02-01T19:00:00Z'),
        location: 'Town Hall',
      });

      // Cancel first time
      const firstCancel = await service.cancelMeeting(ctx, meeting.id, 'First');

      // Cancel second time - should not throw, should return same meeting
      const secondCancel = await service.cancelMeeting(ctx, meeting.id, 'Second');

      expect(secondCancel.status).toBe('cancelled');
      expect(secondCancel.id).toBe(firstCancel.id);
      // Reason should still be the original
      expect(secondCancel.cancellationReason).toBe('First');
    });

    it('should throw error when cancelling an adjourned meeting', async () => {
      // Create a meeting and manually set it to adjourned (simulating completion)
      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: new Date('2025-01-15T19:00:00Z'),
        location: 'Town Hall',
      });

      // Directly manipulate status to simulate adjourned state
      const fetched = await service.getMeeting(ctx, meeting.id);
      (fetched as Meeting).status = 'adjourned';

      await expect(service.cancelMeeting(ctx, meeting.id)).rejects.toThrow(
        'Cannot cancel an adjourned meeting'
      );
    });

    it('should throw error when meeting not found', async () => {
      await expect(
        service.cancelMeeting(ctx, 'nonexistent-id')
      ).rejects.toThrow('Meeting not found for tenant');
    });
  });

  describe('markNoticePosted', () => {
    it('should mark timeliness as COMPLIANT when posted 48+ hours before meeting', async () => {
      const meetingStart = new Date('2025-02-10T19:00:00Z');
      const postedAt = new Date('2025-02-07T10:00:00Z'); // 81 hours before

      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: meetingStart,
        location: 'Town Hall',
      });

      const updated = await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt,
        postedByUserId: 'clerk-1',
        methods: ['WEBSITE', 'PHYSICAL_POSTING'],
        locations: ['Town Hall bulletin board', 'www.town.gov/meetings'],
      });

      expect(updated.openDoorCompliance?.timeliness).toBe('COMPLIANT');
      expect(updated.status).toBe('noticed');
    });

    it('should mark timeliness as LATE when posted less than 48 hours before meeting', async () => {
      const meetingStart = new Date('2025-02-10T19:00:00Z');
      const postedAt = new Date('2025-02-09T10:00:00Z'); // 33 hours before

      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: meetingStart,
        location: 'Town Hall',
      });

      const updated = await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt,
        postedByUserId: 'clerk-1',
        methods: ['WEBSITE'],
        locations: ['www.town.gov/meetings'],
      });

      expect(updated.openDoorCompliance?.timeliness).toBe('LATE');
    });

    it('should always mark emergency meetings as COMPLIANT', async () => {
      const meetingStart = new Date('2025-02-10T19:00:00Z');
      const postedAt = new Date('2025-02-10T18:00:00Z'); // 1 hour before

      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'emergency',
        scheduledStart: meetingStart,
        location: 'Town Hall',
      });

      const updated = await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt,
        postedByUserId: 'clerk-1',
        methods: ['EMAIL_LIST'],
        locations: ['Email blast to subscribers'],
      });

      expect(updated.openDoorCompliance?.timeliness).toBe('COMPLIANT');
      expect(updated.openDoorCompliance?.notes).toContain('Emergency meeting');
    });

    it('should store requiredPostedBy and actualPostedAt as ISO strings', async () => {
      const meetingStart = new Date('2025-02-10T19:00:00Z');
      const postedAt = new Date('2025-02-07T10:00:00Z');

      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: meetingStart,
        location: 'Town Hall',
      });

      const updated = await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt,
        postedByUserId: 'clerk-1',
        methods: ['WEBSITE'],
        locations: ['www.town.gov'],
      });

      const compliance = updated.openDoorCompliance!;

      // Check ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(compliance.requiredPostedBy).toMatch(isoRegex);
      expect(compliance.actualPostedAt).toMatch(isoRegex);
      expect(compliance.actualPostedAt).toBe(postedAt.toISOString());
    });

    it('should append notices to array and track lastNoticePostedAt', async () => {
      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: new Date('2025-02-10T19:00:00Z'),
        location: 'Town Hall',
      });

      // Post first notice
      const firstPost = new Date('2025-02-07T10:00:00Z');
      await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt: firstPost,
        postedByUserId: 'clerk-1',
        methods: ['PHYSICAL_POSTING'],
        locations: ['Town Hall'],
      });

      // Post second notice
      const secondPost = new Date('2025-02-08T09:00:00Z');
      const updated = await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt: secondPost,
        postedByUserId: 'clerk-1',
        methods: ['WEBSITE'],
        locations: ['www.town.gov'],
      });

      expect(updated.notices).toHaveLength(2);
      expect(updated.lastNoticePostedAt).toEqual(secondPost);
    });
  });
});
