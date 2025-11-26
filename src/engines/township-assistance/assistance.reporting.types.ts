// src/engines/township-assistance/assistance.reporting.types.ts

import { AssistanceBenefitType } from './assistance.types';

export interface AssistanceStatsRange {
  fromDate: Date;
  toDate: Date;
}

export interface AssistanceCaseStats {
  totalCases: number;
  openCases: number;
  approvedCases: number;
  deniedCases: number;
  paidCases: number;
}

export interface AssistanceBenefitBreakdown {
  benefitType: AssistanceBenefitType;
  totalAmountCents: number;
  caseCount: number;
}

export interface HouseholdSizeBucketStats {
  bucketLabel: string;      // e.g. "1", "2-3", "4-5", "6+"
  caseCount: number;
}

/**
 * Summary stats for a period, roughly aligned with TA-7 style reporting.
 */
export interface AssistanceStatsSummary {
  range: AssistanceStatsRange;
  caseStats: AssistanceCaseStats;

  totalBenefitsCents: number;
  benefitsByType: AssistanceBenefitBreakdown[];

  // Optional breakdown of cases by household size bucket.
  householdBuckets?: HouseholdSizeBucketStats[];
}