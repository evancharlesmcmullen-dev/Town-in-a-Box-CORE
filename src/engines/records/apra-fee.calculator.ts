// src/engines/records/apra-fee.calculator.ts
//
// Fee calculator for Indiana APRA (Access to Public Records Act) requests.
// Implements fee limits per IC 5-14-3-8 and 25 IAC 1-1-1.

import { TenantContext } from '../../core/tenancy/tenancy.types';

// ===========================================================================
// FEE INPUT / OUTPUT TYPES
// ===========================================================================

/**
 * Input for calculating APRA copying fees.
 */
export interface ApraFeeInput {
  /** Request ID for tracking */
  requestId?: string;
  /** Requester name for records */
  requesterName?: string;

  // Page counts by type
  /** Number of black & white pages */
  bwPages?: number;
  /** Number of color pages */
  colorPages?: number;
  /** Number of large format pages (11x17 or larger) */
  largeFormatPages?: number;

  // Media
  /** Number of CD/DVD media */
  cdDvdMedia?: number;
  /** Number of USB drives */
  usbMedia?: number;

  // Additional costs
  /** Whether mailing is required */
  requiresMailing?: boolean;
  /** Actual mailing costs in cents (if known) */
  mailingCostCents?: number;
  /** Labor hours for extensive requests (over 2 hours, per IC 5-14-3-8(c)) */
  laborHours?: number;
  /** Number of certified copies */
  certifications?: number;
}

/**
 * A single fee line item.
 */
export interface ApraFeeLine {
  /** Fee code for tracking */
  code: string;
  /** Human-readable name */
  name: string;
  /** Quantity */
  quantity: number;
  /** Amount per unit in cents */
  unitAmountCents: number;
  /** Line total in cents */
  lineTotalCents: number;
}

/**
 * Result of fee calculation.
 */
export interface ApraFeeResult {
  /** Total amount in cents */
  totalCents: number;
  /** Formatted total (e.g., "$15.50") */
  formattedTotal: string;
  /** Total page count */
  totalPages: number;
  /** Whether this qualifies as an "extensive" request under IC 5-14-3-8(c) */
  isExtensive: boolean;
  /** Line-item breakdown */
  lines: ApraFeeLine[];
  /** Calculated at timestamp */
  calculatedAt: string;
  /** Context from input */
  requestId?: string;
  requesterName?: string;
}

// ===========================================================================
// FEE SCHEDULE DEFAULTS (per Indiana Admin Code)
// These are maximum allowed amounts per 25 IAC 1-1-1
// ===========================================================================

export interface ApraFeeSchedule {
  /** Black & white per page in cents */
  bwPageCents: number;
  /** Color per page in cents */
  colorPageCents: number;
  /** Large format per page in cents */
  largeFormatPageCents: number;
  /** CD/DVD per disc in cents */
  cdDvdCents: number;
  /** USB drive per unit in cents */
  usbCents: number;
  /** Labor per hour in cents (for requests over 2 hours) */
  laborHourlyCents: number;
  /** Certification per copy in cents */
  certificationCents: number;
  /** Default mailing cost in cents if not specified */
  defaultMailingCents: number;
  /** Threshold hours for "extensive" request */
  extensiveThresholdHours: number;
}

/**
 * Default fee schedule based on Indiana Administrative Code.
 * Agencies may set lower amounts but not higher.
 */
export const DEFAULT_INDIANA_FEE_SCHEDULE: ApraFeeSchedule = {
  bwPageCents: 10, // $0.10 per page
  colorPageCents: 25, // $0.25 per page
  largeFormatPageCents: 50, // $0.50 per page
  cdDvdCents: 100, // $1.00 per disc
  usbCents: 500, // $5.00 per USB (actual cost)
  laborHourlyCents: 2000, // $20.00 per hour (lowest-paid employee rate)
  certificationCents: 200, // $2.00 per certification
  defaultMailingCents: 500, // $5.00 default for mailing
  extensiveThresholdHours: 2, // First 2 hours are free
};

// ===========================================================================
// APRA FEE CALCULATOR
// ===========================================================================

/**
 * Calculator for APRA copying fees.
 *
 * Implements fee limits per IC 5-14-3-8:
 * - (a) Agencies may charge for copying records
 * - (b) Fees cannot exceed actual cost or be used to discourage requests
 * - (c) For extensive requests, labor may be charged after first 2 hours
 *
 * @example
 * const calculator = new ApraFeeCalculator();
 * const result = calculator.calculateFees(ctx, {
 *   bwPages: 50,
 *   colorPages: 5,
 *   requiresMailing: true,
 * });
 * console.log(result.formattedTotal); // "$8.50"
 */
export class ApraFeeCalculator {
  private schedule: ApraFeeSchedule;

  constructor(schedule: ApraFeeSchedule = DEFAULT_INDIANA_FEE_SCHEDULE) {
    this.schedule = schedule;
  }

  /**
   * Calculate fees for an APRA request.
   *
   * @param ctx - Tenant context (for future tenant-specific fee schedules)
   * @param input - Fee calculation input
   * @returns Detailed fee breakdown
   */
  calculateFees(ctx: TenantContext, input: ApraFeeInput): ApraFeeResult {
    const lines: ApraFeeLine[] = [];
    let totalPages = 0;

    // Black & white pages
    if (input.bwPages && input.bwPages > 0) {
      const qty = input.bwPages;
      totalPages += qty;
      lines.push({
        code: 'BW_COPY',
        name: 'Black & White Copies',
        quantity: qty,
        unitAmountCents: this.schedule.bwPageCents,
        lineTotalCents: qty * this.schedule.bwPageCents,
      });
    }

    // Color pages
    if (input.colorPages && input.colorPages > 0) {
      const qty = input.colorPages;
      totalPages += qty;
      lines.push({
        code: 'COLOR_COPY',
        name: 'Color Copies',
        quantity: qty,
        unitAmountCents: this.schedule.colorPageCents,
        lineTotalCents: qty * this.schedule.colorPageCents,
      });
    }

    // Large format pages
    if (input.largeFormatPages && input.largeFormatPages > 0) {
      const qty = input.largeFormatPages;
      totalPages += qty;
      lines.push({
        code: 'LARGE_FORMAT',
        name: 'Large Format Copies (11x17+)',
        quantity: qty,
        unitAmountCents: this.schedule.largeFormatPageCents,
        lineTotalCents: qty * this.schedule.largeFormatPageCents,
      });
    }

    // CD/DVD media
    if (input.cdDvdMedia && input.cdDvdMedia > 0) {
      const qty = input.cdDvdMedia;
      lines.push({
        code: 'CD_DVD',
        name: 'CD/DVD Media',
        quantity: qty,
        unitAmountCents: this.schedule.cdDvdCents,
        lineTotalCents: qty * this.schedule.cdDvdCents,
      });
    }

    // USB media
    if (input.usbMedia && input.usbMedia > 0) {
      const qty = input.usbMedia;
      lines.push({
        code: 'USB',
        name: 'USB Drive',
        quantity: qty,
        unitAmountCents: this.schedule.usbCents,
        lineTotalCents: qty * this.schedule.usbCents,
      });
    }

    // Certifications
    if (input.certifications && input.certifications > 0) {
      const qty = input.certifications;
      lines.push({
        code: 'CERTIFICATION',
        name: 'Certified Copy',
        quantity: qty,
        unitAmountCents: this.schedule.certificationCents,
        lineTotalCents: qty * this.schedule.certificationCents,
      });
    }

    // Mailing
    if (input.requiresMailing) {
      const mailingCost = input.mailingCostCents ?? this.schedule.defaultMailingCents;
      lines.push({
        code: 'MAILING',
        name: 'Mailing/Postage',
        quantity: 1,
        unitAmountCents: mailingCost,
        lineTotalCents: mailingCost,
      });
    }

    // Labor (only for extensive requests over 2 hours)
    const isExtensive = (input.laborHours ?? 0) > this.schedule.extensiveThresholdHours;
    if (isExtensive && input.laborHours) {
      // Only charge for hours over the threshold
      const chargeableHours = input.laborHours - this.schedule.extensiveThresholdHours;
      if (chargeableHours > 0) {
        lines.push({
          code: 'LABOR',
          name: `Staff Time (over ${this.schedule.extensiveThresholdHours} hrs)`,
          quantity: chargeableHours,
          unitAmountCents: this.schedule.laborHourlyCents,
          lineTotalCents: Math.round(chargeableHours * this.schedule.laborHourlyCents),
        });
      }
    }

    // Calculate total
    const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

    return {
      totalCents,
      formattedTotal: this.formatCurrency(totalCents),
      totalPages,
      isExtensive,
      lines,
      calculatedAt: new Date().toISOString(),
      requestId: input.requestId,
      requesterName: input.requesterName,
    };
  }

  /**
   * Get the current fee schedule.
   */
  getSchedule(): ApraFeeSchedule {
    return { ...this.schedule };
  }

  /**
   * Update the fee schedule.
   * Agencies may set lower fees but not higher than state maximums.
   */
  setSchedule(schedule: Partial<ApraFeeSchedule>): void {
    this.schedule = { ...this.schedule, ...schedule };
  }

  /**
   * Format cents as currency string.
   */
  private formatCurrency(cents: number): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  }
}
