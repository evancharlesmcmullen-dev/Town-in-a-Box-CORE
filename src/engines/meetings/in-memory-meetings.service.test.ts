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
    it('should mark timeliness as COMPLIANT when posted 48+ business hours before meeting', async () => {
      // Wednesday meeting, posted Friday before - gives 48+ business hours
      // Required by: Mon Feb 10 at 19:00 (48 biz hours back from Wed 19:00)
      // Posted: Fri Feb 7 at 10:00 (before Mon 19:00) → COMPLIANT
      const meetingStart = new Date('2025-02-12T19:00:00Z'); // Wednesday
      const postedAt = new Date('2025-02-07T10:00:00Z'); // Friday before

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
      // Use Wed meeting, posted Fri before (same as COMPLIANT test)
      const meetingStart = new Date('2025-02-12T19:00:00Z'); // Wednesday
      const postedAt = new Date('2025-02-07T10:00:00Z'); // Friday before

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
      // Use Wed meeting for proper business hour calculation
      const meeting = await service.scheduleMeeting(ctx, {
        bodyId: 'council',
        type: 'regular',
        scheduledStart: new Date('2025-02-12T19:00:00Z'), // Wednesday
        location: 'Town Hall',
      });

      // Post first notice
      const firstPost = new Date('2025-02-07T10:00:00Z'); // Friday before
      await service.markNoticePosted(ctx, {
        meetingId: meeting.id,
        postedAt: firstPost,
        postedByUserId: 'clerk-1',
        methods: ['PHYSICAL_POSTING'],
        locations: ['Town Hall'],
      });

      // Post second notice
      const secondPost = new Date('2025-02-10T09:00:00Z'); // Monday before
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

    // --- Weekend/Holiday Specific Tests (IC 5-14-1.5-5) ---

    it('should skip weekends when calculating required posting time (Friday → Monday)', async () => {
      // Meeting on Monday at 19:00
      // 48 business hours back = Thu at 19:00 (skipping Sat/Sun)
      // Mon 19 hrs + Fri 24 hrs = 43, need 5 more from Thu
      const meetingStart = new Date('2025-02-10T19:00:00Z'); // Monday
      const postedAt = new Date('2025-02-06T18:00:00Z'); // Thursday 18:00 (before Thu 19:00)

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

      expect(updated.openDoorCompliance?.timeliness).toBe('COMPLIANT');
      // Verify business hours lead is at least 48
      expect(updated.openDoorCompliance?.notes).toContain('business hours');
    });

    it('should not skip weekdays when no weekend crossing (Tuesday meeting)', async () => {
      // Meeting on Tuesday at 19:00
      // 48 business hours back = previous Thursday at 19:00
      // (Tue 19 + Mon 24 = 43, need 5 from prev Fri? No wait...)
      // Tue 19 hrs + Mon 24 = 43 + Fri 5 = 48, but we skip Sat/Sun
      // Actually: Tue 19 + Mon 24 + Fri 5 = 48 (skipping weekend)
      // Wait, going back from Tuesday:
      //   Tue: 19 hrs, Mon: 24 hrs = 43 total, need 5 more from Sun? No, skip to Fri
      //   Fri: 5 hrs = 48 total → Fri 19:00
      const meetingStart = new Date('2025-02-11T19:00:00Z'); // Tuesday
      const postedAt = new Date('2025-02-07T18:00:00Z'); // Friday 18:00 (before Fri 19:00)

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

      expect(updated.openDoorCompliance?.timeliness).toBe('COMPLIANT');
    });

    it('should skip holidays when calculating required posting time', async () => {
      // Meeting on Thursday Jan 2, 2025 at 19:00
      // New Year's Day (Jan 1) is a holiday
      // 48 business hours back, skipping Jan 1 and weekends
      // Thu Jan 2: 19 hrs
      // Wed Jan 1 = HOLIDAY (skipped)
      // Tue Dec 31: 24 hrs = 43 total
      // Mon Dec 30: 5 hrs = 48 total → Mon Dec 30 at 19:00
      const meetingStart = new Date('2025-01-02T19:00:00Z'); // Thursday Jan 2
      const postedAt = new Date('2024-12-30T18:00:00Z'); // Mon Dec 30 at 18:00 (before 19:00)

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

      expect(updated.openDoorCompliance?.timeliness).toBe('COMPLIANT');
    });

    it('should mark as LATE when posting after deadline due to weekend skip', async () => {
      // Meeting on Monday at 19:00
      // Required by: Thursday at 19:00 (48 biz hours back, skipping Sat/Sun)
      // Posted: Friday at 10:00 (AFTER the deadline)
      const meetingStart = new Date('2025-02-10T19:00:00Z'); // Monday
      const postedAt = new Date('2025-02-07T10:00:00Z'); // Friday 10:00 (after Thu 19:00)

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

      expect(updated.openDoorCompliance?.timeliness).toBe('LATE');
    });
  });
});
