// src/engines/meetings/domain/services/deadline-calculator.service.ts
//
// Service for calculating publication deadlines and assessing risk levels.
// This is the main orchestrator for the Notice & Publication Engine.

import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  PublicationRule,
  NoticeReason,
  DeadlineCalculation,
  RequiredPublication,
  RiskLevel,
  NewspaperSchedule,
} from '../types';
import { PublicationRuleService } from './publication-rule.service';
import {
  NewspaperScheduleService,
  addDays,
  countBusinessDays,
  weeksBefore,
} from './newspaper-schedule.service';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Risk messages for different levels.
 */
export const RISK_MESSAGES = {
  LOW: null,
  MEDIUM: 'Publication deadline approaching. Submit notice soon.',
  HIGH: 'Publication deadline is imminent. Submit notice immediately.',
  IMPOSSIBLE:
    'Statutory publication deadline cannot be met. Contact the newspaper immediately to request accommodation and consult your attorney before proceeding.',
} as const;

/**
 * Business days thresholds for risk levels.
 */
const RISK_THRESHOLDS = {
  LOW_MIN_BUSINESS_DAYS: 5,
  MEDIUM_MIN_BUSINESS_DAYS: 2,
} as const;

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * Deadline Calculator Service.
 *
 * Calculates publication deadlines for hearings based on statutory requirements
 * and newspaper schedules. Assesses risk levels to help clerks meet deadlines.
 */
export class DeadlineCalculatorService {
  constructor(
    private readonly ruleService: PublicationRuleService,
    private readonly scheduleService: NewspaperScheduleService
  ) {}

  /**
   * Calculate all deadlines for a hearing.
   *
   * This method:
   * 1. Looks up the publication rule for the notice reason
   * 2. Calculates required publication dates based on statutory lead time
   * 3. For consecutive publication requirements, spaces publications by weeks
   * 4. Calculates submission deadlines based on newspaper schedule
   * 5. Assesses risk level based on current time
   *
   * @param ctx Tenant context
   * @param hearingDate Date of the hearing
   * @param noticeReason Type of notice required
   * @param newspaperChannelId Optional newspaper schedule ID
   * @param now Optional current time (for testing)
   * @returns Complete deadline calculation
   */
  async calculateDeadlines(
    ctx: TenantContext,
    hearingDate: Date,
    noticeReason: NoticeReason,
    newspaperChannelId?: string,
    now: Date = new Date()
  ): Promise<DeadlineCalculation> {
    // Get the applicable rule
    const rule = await this.ruleService.getRuleForReason(ctx, noticeReason);

    if (!rule) {
      throw new Error(`No publication rule found for reason: ${noticeReason}`);
    }

    // Get newspaper schedule if specified
    let newspaperSchedule: NewspaperSchedule | null = null;
    if (newspaperChannelId) {
      newspaperSchedule = await this.scheduleService.getSchedule(
        ctx,
        newspaperChannelId
      );
    }

    // Calculate required publications
    const requiredPublications = this.calculateRequiredPublications(
      hearingDate,
      rule,
      newspaperSchedule
    );

    // Find the earliest submission deadline
    const earliestSubmissionDeadline = this.findEarliestSubmissionDeadline(
      requiredPublications
    );

    // Assess risk level
    const riskLevel = this.assessRisk(earliestSubmissionDeadline, now);

    return {
      hearingDate,
      noticeReason,
      rule,
      requiredPublications,
      earliestSubmissionDeadline,
      riskLevel,
      riskMessage: RISK_MESSAGES[riskLevel],
    };
  }

  /**
   * Assess risk level based on current date vs deadline.
   *
   * Risk levels:
   * - LOW: > 5 business days until earliest submission deadline
   * - MEDIUM: 2-5 business days until earliest submission deadline
   * - HIGH: < 2 business days until earliest submission deadline
   * - IMPOSSIBLE: Earliest submission deadline has passed
   *
   * @param deadline The deadline calculation or earliest submission deadline
   * @param now Current date/time
   * @returns Risk level
   */
  assessRisk(
    deadlineOrCalculation: DeadlineCalculation | Date,
    now: Date = new Date()
  ): RiskLevel {
    const deadline =
      deadlineOrCalculation instanceof Date
        ? deadlineOrCalculation
        : deadlineOrCalculation.earliestSubmissionDeadline;

    // Check if deadline has passed
    if (now > deadline) {
      return 'IMPOSSIBLE';
    }

    // Count business days until deadline
    const businessDaysRemaining = countBusinessDays(now, deadline);

    if (businessDaysRemaining > RISK_THRESHOLDS.LOW_MIN_BUSINESS_DAYS) {
      return 'LOW';
    }

    if (businessDaysRemaining >= RISK_THRESHOLDS.MEDIUM_MIN_BUSINESS_DAYS) {
      return 'MEDIUM';
    }

    return 'HIGH';
  }

  /**
   * Calculate required publications for a hearing.
   *
   * @param hearingDate The hearing date
   * @param rule The publication rule
   * @param schedule Optional newspaper schedule
   * @returns Array of required publications with dates
   */
  private calculateRequiredPublications(
    hearingDate: Date,
    rule: PublicationRule,
    schedule: NewspaperSchedule | null
  ): RequiredPublication[] {
    const publications: RequiredPublication[] = [];

    // If no publications required (e.g., OPEN_DOOR_MEETING), return empty
    if (rule.requiredPublications === 0) {
      return publications;
    }

    // Calculate the latest date for the last publication
    // Must be at least requiredLeadDays before the hearing
    const latestLastPublicationDate = addDays(hearingDate, -rule.requiredLeadDays);

    // For consecutive week requirements, work backwards
    if (rule.mustBeConsecutive && rule.requiredPublications > 1) {
      // Last publication must be at least requiredLeadDays before hearing
      // Previous publications must be in consecutive prior weeks

      for (let i = rule.requiredPublications; i >= 1; i--) {
        const weeksBeforeLast = rule.requiredPublications - i;
        const publicationDate = weeksBefore(
          latestLastPublicationDate,
          weeksBeforeLast
        );

        // Find actual publication date (accounting for newspaper schedule)
        const actualPubDate = schedule
          ? this.scheduleService.findNextPublicationDate(
              schedule,
              // Look backward from target date to find a publication day in that week
              addDays(publicationDate, -6)
            )
          : publicationDate;

        // Ensure the actual date is not after the target
        const finalPubDate =
          actualPubDate <= publicationDate
            ? actualPubDate
            : this.findPreviousPublicationDate(schedule, publicationDate);

        const submissionDeadline = this.calculateSubmissionDeadline(
          finalPubDate,
          schedule
        );

        publications.push({
          publicationNumber: i,
          latestPublicationDate: finalPubDate,
          submissionDeadline,
          newspaperChannelId: schedule?.id ?? null,
        });
      }

      // Sort by publication number ascending
      publications.sort((a, b) => a.publicationNumber - b.publicationNumber);
    } else {
      // Non-consecutive publications - all can be on/before the same deadline
      for (let i = 1; i <= rule.requiredPublications; i++) {
        const publicationDate = schedule
          ? this.findPreviousPublicationDate(schedule, latestLastPublicationDate)
          : latestLastPublicationDate;

        const submissionDeadline = this.calculateSubmissionDeadline(
          publicationDate,
          schedule
        );

        publications.push({
          publicationNumber: i,
          latestPublicationDate: publicationDate,
          submissionDeadline,
          newspaperChannelId: schedule?.id ?? null,
        });
      }
    }

    return publications;
  }

  /**
   * Find the publication date on or before a given date.
   */
  private findPreviousPublicationDate(
    schedule: NewspaperSchedule | null,
    onOrBefore: Date
  ): Date {
    if (!schedule) {
      return onOrBefore;
    }

    // Look backwards up to 7 days to find a publication day
    for (let i = 0; i <= 7; i++) {
      const candidate = addDays(onOrBefore, -i);
      const nextPub = this.scheduleService.findNextPublicationDate(
        schedule,
        candidate
      );

      // If the next publication from this candidate is the same day,
      // and it's on or before our target, use it
      if (
        nextPub.toDateString() === candidate.toDateString() &&
        nextPub <= onOrBefore
      ) {
        return nextPub;
      }
    }

    // Fallback: return 7 days before
    return addDays(onOrBefore, -7);
  }

  /**
   * Calculate submission deadline for a publication date.
   */
  private calculateSubmissionDeadline(
    publicationDate: Date,
    schedule: NewspaperSchedule | null
  ): Date {
    if (schedule) {
      return this.scheduleService.getSubmissionDeadline(schedule, publicationDate);
    }

    // Default: 3 business days before publication at 5 PM
    const deadline = addDays(publicationDate, -3);
    deadline.setHours(17, 0, 0, 0);
    return deadline;
  }

  /**
   * Find the earliest submission deadline from all required publications.
   */
  private findEarliestSubmissionDeadline(
    publications: RequiredPublication[]
  ): Date {
    if (publications.length === 0) {
      // No publication required - return a date far in the future
      return addDays(new Date(), 365);
    }

    return publications.reduce(
      (earliest, pub) =>
        pub.submissionDeadline < earliest ? pub.submissionDeadline : earliest,
      publications[0].submissionDeadline
    );
  }
}

// =============================================================================
// STANDALONE RISK ASSESSMENT FUNCTIONS
// =============================================================================

/**
 * Assess risk level given a deadline and current time.
 * Standalone function for use without service instantiation.
 *
 * @param deadline The submission deadline
 * @param now Current time
 * @returns Risk level
 */
export function assessDeadlineRisk(
  deadline: Date,
  now: Date = new Date()
): RiskLevel {
  if (now > deadline) {
    return 'IMPOSSIBLE';
  }

  const businessDaysRemaining = countBusinessDays(now, deadline);

  if (businessDaysRemaining > RISK_THRESHOLDS.LOW_MIN_BUSINESS_DAYS) {
    return 'LOW';
  }

  if (businessDaysRemaining >= RISK_THRESHOLDS.MEDIUM_MIN_BUSINESS_DAYS) {
    return 'MEDIUM';
  }

  return 'HIGH';
}

/**
 * Get the risk message for a given level.
 *
 * @param level Risk level
 * @returns Human-readable risk message
 */
export function getRiskMessage(level: RiskLevel): string | null {
  return RISK_MESSAGES[level];
}

/**
 * Check if a risk level indicates a problem.
 *
 * @param level Risk level
 * @returns True if HIGH or IMPOSSIBLE
 */
export function isHighRisk(level: RiskLevel): boolean {
  return level === 'HIGH' || level === 'IMPOSSIBLE';
}

/**
 * Calculate a simple deadline without newspaper schedule.
 * Useful for quick calculations when newspaper details aren't available.
 *
 * @param hearingDate The hearing date
 * @param leadDays Required lead time in days
 * @param numPublications Number of publications required
 * @param consecutive Whether publications must be consecutive weeks
 * @returns Latest publication date and estimated submission deadline
 */
export function calculateSimpleDeadline(
  hearingDate: Date,
  leadDays: number,
  numPublications: number = 1,
  consecutive: boolean = false
): { latestPublication: Date; estimatedSubmission: Date } {
  // Latest publication date
  let latestPublication = addDays(hearingDate, -leadDays);

  // For consecutive publications, the first one needs to be earlier
  if (consecutive && numPublications > 1) {
    // First publication must be (numPublications - 1) weeks before the last
    const firstPublication = weeksBefore(
      latestPublication,
      numPublications - 1
    );
    latestPublication = firstPublication;
  }

  // Estimated submission: 3 business days before first publication
  const estimatedSubmission = addDays(latestPublication, -3);
  estimatedSubmission.setHours(17, 0, 0, 0);

  return {
    latestPublication,
    estimatedSubmission,
  };
}
