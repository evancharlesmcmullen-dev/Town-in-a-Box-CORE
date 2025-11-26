// src/engines/township-assistance/assistance.reporting.types.ts
//
// Reporting types for Township Assistance (Poor Relief).
// These types support TA-7 state reporting, trustee dashboards, and board presentations.

import { AssistanceBenefitType } from './assistance.types';

// ===========================================================================
// STATS RANGE & CASE COUNTS
// ===========================================================================

/**
 * Time range for assistance statistics queries.
 *
 * @example
 * const q1Range: AssistanceStatsRange = {
 *   fromDate: new Date('2025-01-01'),
 *   toDate: new Date('2025-03-31')
 * };
 */
export interface AssistanceStatsRange {
  fromDate: Date;
  toDate: Date;
}

/**
 * High-level case counts for a reporting period.
 *
 * These counts align with TA-7 reporting requirements and
 * provide the "at a glance" numbers for trustee dashboards.
 */
export interface AssistanceCaseStats {
  /** Total cases opened in the period. */
  totalCases: number;
  /** Cases still awaiting decision. */
  openCases: number;
  /** Cases approved (may or may not be paid yet). */
  approvedCases: number;
  /** Cases denied. */
  deniedCases: number;
  /** Cases where benefits have been disbursed. */
  paidCases: number;
}

/**
 * Breakdown of assistance dollars by benefit type.
 *
 * Used for pie charts and TA-7 categorical reporting.
 */
export interface AssistanceBenefitBreakdown {
  /** Type of benefit (rent, utilities, food, etc.). */
  benefitType: AssistanceBenefitType;
  /** Total amount disbursed for this type (in cents). */
  totalAmountCents: number;
  /** Number of unique cases receiving this benefit type. */
  caseCount: number;
}

// ===========================================================================
// HOUSEHOLD SIZE BUCKETS (for TA-7 and charts)
// ===========================================================================

/**
 * Household size bucket statistics for TA-7 reporting.
 *
 * Indiana TA-7 requires reporting by household size. These buckets
 * are also useful for bar charts showing case distribution.
 *
 * @example
 * {
 *   bucketLabel: '2-3',
 *   minSize: 2,
 *   maxSize: 3,
 *   caseCount: 45,
 *   approvedCount: 38,
 *   deniedCount: 7
 * }
 */
export interface HouseholdSizeBucketStats {
  /** Display label for this bucket (e.g., "1", "2-3", "4-5", "6+"). */
  bucketLabel: string;
  /** Minimum household size in this bucket (inclusive). */
  minSize: number;
  /** Maximum household size in this bucket (inclusive), or null for open-ended. */
  maxSize: number | null;
  /** Total cases in this bucket. */
  caseCount: number;
  /** Cases in this bucket that were approved. */
  approvedCount: number;
  /** Cases in this bucket that were denied. */
  deniedCount: number;
}

// ===========================================================================
// SUMMARY TYPES
// ===========================================================================

/**
 * Full summary statistics for a reporting period.
 *
 * This is the primary type used for:
 * - TA-7 state report generation
 * - Trustee dashboard with charts
 * - Board presentation summaries
 *
 * **Note:** `householdBuckets` is required. If you need a lightweight
 * summary without buckets (e.g., for a "glance card"), use
 * {@link AssistanceStatsSummaryLite} instead.
 *
 * @example
 * const summary = await reportingService.getStatsForRange(ctx, range);
 * console.log(`Total cases: ${summary.caseStats.totalCases}`);
 * console.log(`Approval rate: ${summary.caseStats.approvedCases / summary.caseStats.totalCases}`);
 */
export interface AssistanceStatsSummary {
  /** The time range these stats cover. */
  range: AssistanceStatsRange;

  /** High-level case counts. */
  caseStats: AssistanceCaseStats;

  /** Total benefits disbursed across all types (in cents). */
  totalBenefitsCents: number;
  /** Breakdown by benefit type for categorical reporting. */
  benefitsByType: AssistanceBenefitBreakdown[];

  /**
   * Household size distribution.
   * Required for TA-7 reporting and household-based charts.
   */
  householdBuckets: HouseholdSizeBucketStats[];
}

/**
 * Lightweight summary without household breakdown.
 *
 * Use this for quick dashboard "glance cards" where you only need
 * totals, not the full household distribution.
 *
 * @example
 * // For a dashboard card showing just totals
 * const lite: AssistanceStatsSummaryLite = {
 *   range: { fromDate, toDate },
 *   caseStats: { totalCases: 150, openCases: 12, ... },
 *   totalBenefitsCents: 4500000,
 *   benefitsByType: [...]
 * };
 */
export interface AssistanceStatsSummaryLite
  extends Omit<AssistanceStatsSummary, 'householdBuckets'> {}
