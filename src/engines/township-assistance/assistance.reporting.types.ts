// src/engines/township-assistance/assistance.reporting.types.ts

import { AssistanceBenefitType } from './assistance.types';

/**
 * Time range for assistance stats.
 */
export interface AssistanceStatsRange {
  fromDate: Date;
  toDate: Date;
}

/**
 * High-level counts for assistance cases in a period.
 */
export interface AssistanceCaseStats {
  totalCases: number;
  openCases: number;
  approvedCases: number;
  deniedCases: number;
  paidCases: number;
}

/**
 * Breakdown of assistance dollars by benefit type.
 */
export interface AssistanceBenefitBreakdown {
  benefitType: AssistanceBenefitType;
  totalAmountCents: number;
  caseCount: number;
}

/**
 * Household size bucket stats for TA-7 reporting.
 */
export interface HouseholdSizeBucketStats {
  bucketLabel: string;     // e.g. "1", "2-3", "4-5", "6+"
  minSize: number;         // e.g. 1
  maxSize: number | null;  // e.g. 3, or null for open-ended "6+"
  caseCount: number;
  approvedCount: number;
  deniedCount: number;
}

/**
 * Summary stats for a period, roughly aligned with what TA-7 cares about.
 */
export interface AssistanceStatsSummary {
  range: AssistanceStatsRange;

  caseStats: AssistanceCaseStats;

  totalBenefitsCents: number;
  benefitsByType: AssistanceBenefitBreakdown[];

  householdBuckets: HouseholdSizeBucketStats[];
}

/**
 * Lightweight summary without household breakdown (for quick dashboards).
 */
export interface AssistanceStatsSummaryLite
  extends Omit<AssistanceStatsSummary, 'householdBuckets'> {}
