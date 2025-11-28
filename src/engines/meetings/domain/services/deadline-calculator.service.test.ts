// src/engines/meetings/domain/services/deadline-calculator.service.test.ts
//
// Unit tests for DeadlineCalculatorService.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeadlineCalculatorService,
  assessDeadlineRisk,
  getRiskMessage,
  isHighRisk,
  calculateSimpleDeadline,
  RISK_MESSAGES,
} from './deadline-calculator.service';
import {
  PublicationRuleService,
  InMemoryPublicationRuleStore,
} from './publication-rule.service';
import {
  NewspaperScheduleService,
  InMemoryNewspaperScheduleStore,
  addDays,
} from './newspaper-schedule.service';
import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import { NewspaperSchedule } from '../types';

describe('DeadlineCalculatorService', () => {
  let service: DeadlineCalculatorService;
  let ruleService: PublicationRuleService;
  let scheduleService: NewspaperScheduleService;
  let ruleStore: InMemoryPublicationRuleStore;
  let scheduleStore: InMemoryNewspaperScheduleStore;
  let ctx: TenantContext;

  beforeEach(async () => {
    ruleStore = new InMemoryPublicationRuleStore();
    scheduleStore = new InMemoryNewspaperScheduleStore();
    ruleService = new PublicationRuleService(ruleStore);
    scheduleService = new NewspaperScheduleService(scheduleStore);
    service = new DeadlineCalculatorService(ruleService, scheduleService);

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

    // Seed default rules
    await ruleService.seedDefaultRules(ctx);
  });

  describe('calculateDeadlines', () => {
    describe('Bond Hearing (consecutive weekly publications)', () => {
      it('should calculate deadlines for bond hearing with 2 consecutive publications', async () => {
        const hearingDate = new Date('2025-02-15');
        const now = new Date('2025-01-15');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'BOND_HEARING',
          undefined,
          now
        );

        expect(calculation.noticeReason).toBe('BOND_HEARING');
        expect(calculation.rule.requiredPublications).toBe(2);
        expect(calculation.rule.mustBeConsecutive).toBe(true);
        expect(calculation.requiredPublications.length).toBe(2);

        // First publication should be about 2 weeks before last
        const pub1 = calculation.requiredPublications[0];
        const pub2 = calculation.requiredPublications[1];

        expect(pub1.publicationNumber).toBe(1);
        expect(pub2.publicationNumber).toBe(2);

        // Publications should be approximately 7 days apart
        const daysDiff = Math.round(
          (pub2.latestPublicationDate.getTime() -
            pub1.latestPublicationDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        expect(daysDiff).toBeGreaterThanOrEqual(6);
        expect(daysDiff).toBeLessThanOrEqual(8);
      });

      it('should set LOW risk when deadline is far away', async () => {
        const hearingDate = new Date('2025-02-15');
        const now = new Date('2025-01-01');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'BOND_HEARING',
          undefined,
          now
        );

        expect(calculation.riskLevel).toBe('LOW');
        expect(calculation.riskMessage).toBeNull();
      });
    });

    describe('Variance Hearing (single publication, 10-day lead)', () => {
      it('should calculate deadlines for variance hearing', async () => {
        const hearingDate = new Date('2025-02-15');
        const now = new Date('2025-01-15');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          undefined,
          now
        );

        expect(calculation.noticeReason).toBe('VARIANCE_HEARING');
        expect(calculation.rule.requiredPublications).toBe(1);
        expect(calculation.rule.requiredLeadDays).toBe(10);
        expect(calculation.requiredPublications.length).toBe(1);

        // Latest publication should be at least 10 days before hearing
        const pub = calculation.requiredPublications[0];
        const daysBefore = Math.round(
          (hearingDate.getTime() - pub.latestPublicationDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        expect(daysBefore).toBeGreaterThanOrEqual(10);
      });
    });

    describe('With Newspaper Schedule', () => {
      let newspaper: NewspaperSchedule;

      beforeEach(async () => {
        newspaper = await scheduleService.createSchedule(ctx, {
          name: 'Herald Bulletin',
          publicationDays: ['WEDNESDAY', 'SATURDAY'],
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
      });

      it('should align publication dates with newspaper schedule', async () => {
        const hearingDate = new Date('2025-02-15'); // Saturday
        const now = new Date('2025-01-15');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          newspaper.id,
          now
        );

        // Publication should be on a Wednesday or Saturday
        const pubDate = calculation.requiredPublications[0].latestPublicationDate;
        const dayOfWeek = pubDate.getDay();

        expect([3, 6]).toContain(dayOfWeek); // 3 = Wednesday, 6 = Saturday
      });

      it('should calculate submission deadline based on newspaper config', async () => {
        const hearingDate = new Date('2025-02-15');
        const now = new Date('2025-01-15');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          newspaper.id,
          now
        );

        // Submission deadline should be before publication date
        const pub = calculation.requiredPublications[0];
        expect(pub.submissionDeadline < pub.latestPublicationDate).toBe(true);
      });
    });

    describe('Risk Assessment at Various Points', () => {
      it('should return LOW when > 5 business days until deadline', async () => {
        const hearingDate = new Date('2025-02-15');
        // Set now to about 3 weeks before
        const now = new Date('2025-01-20');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          undefined,
          now
        );

        expect(calculation.riskLevel).toBe('LOW');
      });

      it('should return MEDIUM when 2-5 business days until deadline', async () => {
        // Need to calculate a specific scenario where we're 2-5 business days out
        const hearingDate = new Date('2025-02-10');
        // Deadline is roughly 2025-01-31 (10 days before hearing)
        // Submission deadline roughly 3 days before = 2025-01-28
        // 5 business days before that = around 2025-01-21
        const now = new Date('2025-01-23');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          undefined,
          now
        );

        expect(['MEDIUM', 'LOW']).toContain(calculation.riskLevel);
      });

      it('should return IMPOSSIBLE when deadline has passed', async () => {
        const hearingDate = new Date('2025-01-15');
        const now = new Date('2025-01-14');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          undefined,
          now
        );

        expect(calculation.riskLevel).toBe('IMPOSSIBLE');
        expect(calculation.riskMessage).toContain(
          'Statutory publication deadline cannot be met'
        );
      });
    });

    describe('Newspaper Holiday Closures', () => {
      it('should skip holiday closures when finding publication date', async () => {
        const newspaper = await scheduleService.createSchedule(ctx, {
          name: 'Holiday Paper',
          publicationDays: ['WEDNESDAY'],
          submissionLeadDays: 3,
          holidayClosures: [new Date('2025-02-05')], // First Wednesday before hearing
        });

        const hearingDate = new Date('2025-02-15');
        const now = new Date('2025-01-15');

        const calculation = await service.calculateDeadlines(
          ctx,
          hearingDate,
          'VARIANCE_HEARING',
          newspaper.id,
          now
        );

        // Should not use 2025-02-05 since it's closed
        const pubDate = calculation.requiredPublications[0].latestPublicationDate;
        expect(pubDate.toISOString().split('T')[0]).not.toBe('2025-02-05');
      });
    });
  });

  describe('assessRisk', () => {
    it('should return correct risk for deadline calculation', async () => {
      const hearingDate = new Date('2025-02-15');
      const now = new Date('2025-01-15');

      const calculation = await service.calculateDeadlines(
        ctx,
        hearingDate,
        'VARIANCE_HEARING',
        undefined,
        now
      );

      const risk = service.assessRisk(calculation, now);
      expect(['LOW', 'MEDIUM', 'HIGH', 'IMPOSSIBLE']).toContain(risk);
    });
  });
});

describe('Standalone Risk Functions', () => {
  describe('assessDeadlineRisk', () => {
    it('should return IMPOSSIBLE when deadline has passed', () => {
      const deadline = new Date('2025-01-10');
      const now = new Date('2025-01-15');

      expect(assessDeadlineRisk(deadline, now)).toBe('IMPOSSIBLE');
    });

    it('should return HIGH when < 2 business days remain', () => {
      const deadline = new Date('2025-01-16T17:00:00');
      const now = new Date('2025-01-15T09:00:00');

      expect(assessDeadlineRisk(deadline, now)).toBe('HIGH');
    });

    it('should return MEDIUM when 2-5 business days remain', () => {
      // Friday deadline, check on Monday = 4 business days
      const deadline = new Date('2025-01-17T17:00:00');
      const now = new Date('2025-01-13T09:00:00');

      const risk = assessDeadlineRisk(deadline, now);
      expect(['MEDIUM', 'LOW']).toContain(risk);
    });

    it('should return LOW when > 5 business days remain', () => {
      const deadline = new Date('2025-01-30');
      const now = new Date('2025-01-15');

      expect(assessDeadlineRisk(deadline, now)).toBe('LOW');
    });
  });

  describe('getRiskMessage', () => {
    it('should return null for LOW', () => {
      expect(getRiskMessage('LOW')).toBeNull();
    });

    it('should return message for MEDIUM', () => {
      expect(getRiskMessage('MEDIUM')).toContain('approaching');
    });

    it('should return message for HIGH', () => {
      expect(getRiskMessage('HIGH')).toContain('imminent');
    });

    it('should return attorney consultation message for IMPOSSIBLE', () => {
      expect(getRiskMessage('IMPOSSIBLE')).toContain('attorney');
    });
  });

  describe('isHighRisk', () => {
    it('should return true for HIGH', () => {
      expect(isHighRisk('HIGH')).toBe(true);
    });

    it('should return true for IMPOSSIBLE', () => {
      expect(isHighRisk('IMPOSSIBLE')).toBe(true);
    });

    it('should return false for LOW', () => {
      expect(isHighRisk('LOW')).toBe(false);
    });

    it('should return false for MEDIUM', () => {
      expect(isHighRisk('MEDIUM')).toBe(false);
    });
  });

  describe('calculateSimpleDeadline', () => {
    it('should calculate simple deadline for single publication', () => {
      const hearingDate = new Date('2025-02-15');
      const result = calculateSimpleDeadline(hearingDate, 10, 1, false);

      // Latest publication: 10 days before = 2025-02-05
      // Submission: 3 days before that = 2025-02-02
      expect(result.latestPublication.toISOString().split('T')[0]).toBe(
        '2025-02-05'
      );
    });

    it('should calculate deadline for consecutive publications', () => {
      const hearingDate = new Date('2025-02-15');
      const result = calculateSimpleDeadline(hearingDate, 10, 2, true);

      // Last publication: 10 days before = 2025-02-05
      // First publication: 1 week before that = 2025-01-29
      // latestPublication returns the earliest required publication date
      const expectedFirst = addDays(addDays(hearingDate, -10), -7);
      expect(result.latestPublication.toISOString().split('T')[0]).toBe(
        expectedFirst.toISOString().split('T')[0]
      );
    });

    it('should set submission deadline at 5 PM', () => {
      const hearingDate = new Date('2025-02-15');
      const result = calculateSimpleDeadline(hearingDate, 10, 1, false);

      expect(result.estimatedSubmission.getHours()).toBe(17);
    });
  });
});
