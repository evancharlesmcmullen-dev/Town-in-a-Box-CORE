// src/engines/meetings/domain/services/newspaper-schedule.service.test.ts
//
// Unit tests for NewspaperScheduleService.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NewspaperScheduleService,
  InMemoryNewspaperScheduleStore,
  addDays,
  getDayOfWeek,
  countBusinessDays,
  weeksBefore,
} from './newspaper-schedule.service';
import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import { NewspaperSchedule, DayOfWeek } from '../types';

describe('NewspaperScheduleService', () => {
  let service: NewspaperScheduleService;
  let store: InMemoryNewspaperScheduleStore;
  let ctx: TenantContext;

  beforeEach(() => {
    store = new InMemoryNewspaperScheduleStore();
    service = new NewspaperScheduleService(store);
    ctx = {
      tenantId: 'tenant-1',
      jurisdiction: {
        tenantId: 'tenant-1',
        state: 'IN',
        kind: 'township',
        name: 'Test Township',
        authorityTags: [],
      },
      userId: 'user-1',
    };
  });

  describe('createSchedule', () => {
    it('should create a newspaper schedule', async () => {
      const schedule = await service.createSchedule(ctx, {
        name: 'Herald Bulletin',
        publicationDays: ['WEDNESDAY', 'SATURDAY'],
        submissionLeadDays: 3,
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Herald Bulletin');
      expect(schedule.publicationDays).toEqual(['WEDNESDAY', 'SATURDAY']);
    });

    it('should set default values', async () => {
      const schedule = await service.createSchedule(ctx, {
        name: 'Test Paper',
        publicationDays: ['FRIDAY'],
        submissionLeadDays: 2,
      });

      expect(schedule.canAccommodateRush).toBe(false);
      expect(schedule.isLegalPublication).toBe(true);
      expect(schedule.holidayClosures).toEqual([]);
    });
  });

  describe('findNextPublicationDate', () => {
    let schedule: NewspaperSchedule;

    beforeEach(async () => {
      schedule = await service.createSchedule(ctx, {
        name: 'Test Paper',
        publicationDays: ['WEDNESDAY', 'SATURDAY'],
        submissionLeadDays: 3,
      });
    });

    it('should find next publication on same day if it is a publication day', () => {
      // 2025-01-15 is a Wednesday
      const date = new Date('2025-01-15');
      const nextPub = service.findNextPublicationDate(schedule, date);

      expect(nextPub.toISOString().split('T')[0]).toBe('2025-01-15');
    });

    it('should find next publication day when starting on non-publication day', () => {
      // 2025-01-13 is a Monday, next publication is Wednesday 2025-01-15
      const date = new Date('2025-01-13');
      const nextPub = service.findNextPublicationDate(schedule, date);

      expect(nextPub.toISOString().split('T')[0]).toBe('2025-01-15');
    });

    it('should skip to next week if no publication days remain in current week', () => {
      // 2025-01-16 is Thursday, next publication is Saturday 2025-01-18
      const date = new Date('2025-01-16');
      const nextPub = service.findNextPublicationDate(schedule, date);

      expect(nextPub.toISOString().split('T')[0]).toBe('2025-01-18');
    });

    it('should skip holiday closures', async () => {
      const scheduleWithHoliday = await service.createSchedule(ctx, {
        name: 'Test Paper 2',
        publicationDays: ['WEDNESDAY'],
        submissionLeadDays: 3,
        holidayClosures: [new Date('2025-01-15')],
      });

      // 2025-01-15 is Wednesday but closed, should skip to 2025-01-22
      const date = new Date('2025-01-15');
      const nextPub = service.findNextPublicationDate(scheduleWithHoliday, date);

      expect(nextPub.toISOString().split('T')[0]).toBe('2025-01-22');
    });
  });

  describe('getSubmissionDeadline', () => {
    it('should calculate deadline using general lead days', async () => {
      const schedule = await service.createSchedule(ctx, {
        name: 'Test Paper',
        publicationDays: ['WEDNESDAY'],
        submissionLeadDays: 3,
      });

      // Publication on 2025-01-15, deadline should be 3 days before at 5 PM
      const pubDate = new Date('2025-01-15');
      const deadline = service.getSubmissionDeadline(schedule, pubDate);

      expect(deadline.toISOString().split('T')[0]).toBe('2025-01-12');
      expect(deadline.getHours()).toBe(17);
    });

    it('should use specific deadline when configured', async () => {
      const schedule = await service.createSchedule(ctx, {
        name: 'Test Paper',
        publicationDays: ['WEDNESDAY'],
        submissionLeadDays: 3,
        submissionDeadlines: [
          {
            publicationDay: 'WEDNESDAY',
            submissionDay: 'MONDAY',
            submissionTime: '12:00',
            daysBeforePublication: 2,
          },
        ],
      });

      // Publication on Wednesday 2025-01-15, deadline Monday 2025-01-13 at noon
      const pubDate = new Date('2025-01-15');
      const deadline = service.getSubmissionDeadline(schedule, pubDate);

      expect(deadline.toISOString().split('T')[0]).toBe('2025-01-13');
      expect(deadline.getHours()).toBe(12);
      expect(deadline.getMinutes()).toBe(0);
    });
  });

  describe('isDeadlinePassed', () => {
    let schedule: NewspaperSchedule;

    beforeEach(async () => {
      schedule = await service.createSchedule(ctx, {
        name: 'Test Paper',
        publicationDays: ['WEDNESDAY'],
        submissionLeadDays: 3,
      });
    });

    it('should return true when deadline has passed', () => {
      const pubDate = new Date('2025-01-15');
      // Deadline is 2025-01-12 at 5 PM, check at 2025-01-13
      const now = new Date('2025-01-13T10:00:00');

      expect(service.isDeadlinePassed(schedule, pubDate, now)).toBe(true);
    });

    it('should return false when deadline has not passed', () => {
      const pubDate = new Date('2025-01-15');
      // Deadline is 2025-01-12 at 5 PM, check at 2025-01-12 at noon
      const now = new Date('2025-01-12T12:00:00');

      expect(service.isDeadlinePassed(schedule, pubDate, now)).toBe(false);
    });
  });
});

describe('Helper Functions', () => {
  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2025-01-15');
      const result = addDays(date, 5);
      expect(result.toISOString().split('T')[0]).toBe('2025-01-20');
    });

    it('should add negative days', () => {
      const date = new Date('2025-01-15');
      const result = addDays(date, -5);
      expect(result.toISOString().split('T')[0]).toBe('2025-01-10');
    });

    it('should handle month boundaries', () => {
      const date = new Date('2025-01-30');
      const result = addDays(date, 5);
      expect(result.toISOString().split('T')[0]).toBe('2025-02-04');
    });
  });

  describe('getDayOfWeek', () => {
    it('should return correct day name', () => {
      expect(getDayOfWeek(new Date('2025-01-12'))).toBe('SUNDAY');
      expect(getDayOfWeek(new Date('2025-01-13'))).toBe('MONDAY');
      expect(getDayOfWeek(new Date('2025-01-15'))).toBe('WEDNESDAY');
      expect(getDayOfWeek(new Date('2025-01-18'))).toBe('SATURDAY');
    });
  });

  describe('countBusinessDays', () => {
    it('should count business days correctly', () => {
      // Monday to Friday = 4 business days (Tue, Wed, Thu, Fri)
      const start = new Date('2025-01-13'); // Monday
      const end = new Date('2025-01-17'); // Friday

      expect(countBusinessDays(start, end)).toBe(4);
    });

    it('should skip weekends', () => {
      // Friday to next Monday = 1 business day (Monday itself not counted)
      const start = new Date('2025-01-17'); // Friday
      const end = new Date('2025-01-20'); // Monday

      expect(countBusinessDays(start, end)).toBe(1); // Just Friday
    });

    it('should return 0 for same day', () => {
      const date = new Date('2025-01-15');
      expect(countBusinessDays(date, date)).toBe(0);
    });

    it('should handle full week', () => {
      // Monday to next Monday = 5 business days
      const start = new Date('2025-01-13');
      const end = new Date('2025-01-20');

      expect(countBusinessDays(start, end)).toBe(5);
    });
  });

  describe('weeksBefore', () => {
    it('should calculate weeks correctly', () => {
      const date = new Date('2025-01-22');
      const result = weeksBefore(date, 2);

      expect(result.toISOString().split('T')[0]).toBe('2025-01-08');
    });

    it('should handle month boundaries', () => {
      const date = new Date('2025-02-10');
      const result = weeksBefore(date, 3);

      expect(result.toISOString().split('T')[0]).toBe('2025-01-20');
    });
  });
});
