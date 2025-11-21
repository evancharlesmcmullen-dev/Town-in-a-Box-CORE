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
 * Summary stats for a period, roughly aligned with what TA-7 cares about.
 */
export interface AssistanceStatsSummary {
  range: AssistanceStatsRange;

  caseStats: AssistanceCaseStats;

  totalBenefitsCents: number;
  benefitsByType: AssistanceBenefitBreakdown[];

  // Later: household counts, persons served, etc.
}