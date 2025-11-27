// src/engines/records/apra-fee.calculator.ts
//
// APRA fee calculator for computing copy fees per IC 5-14-3-8.
//
// Per Indiana law, agencies may charge:
// - Reasonable copying fees
// - Labor costs for extensive requests (some agencies only)
// - Media/mailing costs

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FeeService,
} from '../fees/fee.service';
import {
  FeeCalculationResult,
  FeeCalculationLine,
} from '../fees/fee.types';

// =============================================================================
// APRA Fee Types
// =============================================================================

/**
 * Standard APRA fee item codes.
 * These should be created in the FeeService with appropriate rates.
 */
export const APRA_FEE_CODES = {
  /** Per-page copying (black & white, standard paper) */
  COPY_BW_PAGE: 'APRA_COPY_BW_PAGE',
  /** Per-page copying (color) */
  COPY_COLOR_PAGE: 'APRA_COPY_COLOR_PAGE',
  /** Large format copying (11x17, blueprints, etc.) */
  COPY_LARGE_FORMAT: 'APRA_COPY_LARGE_FORMAT',
  /** CD/DVD media */
  MEDIA_CD_DVD: 'APRA_MEDIA_CD_DVD',
  /** USB drive media */
  MEDIA_USB: 'APRA_MEDIA_USB',
  /** Mailing/postage fee */
  MAILING: 'APRA_MAILING',
  /** Per-hour labor for extensive research (if applicable) */
  LABOR_HOUR: 'APRA_LABOR_HOUR',
  /** Certification fee for certified copies */
  CERTIFICATION: 'APRA_CERTIFICATION',
} as const;

/**
 * Input for calculating APRA copy fees.
 */
export interface ApraFeeInput {
  /** Number of black & white pages */
  bwPages?: number;
  /** Number of color pages */
  colorPages?: number;
  /** Number of large format pages */
  largeFormatPages?: number;
  /** Number of CDs/DVDs */
  cdDvdMedia?: number;
  /** Number of USB drives */
  usbMedia?: number;
  /** Whether mailing is required */
  requiresMailing?: boolean;
  /** Hours of labor for extensive requests (if agency charges) */
  laborHours?: number;
  /** Number of certified copies */
  certifications?: number;
  /** APRA request ID for context */
  requestId?: string;
  /** Requester name for context */
  requesterName?: string;
}

/**
 * Result of APRA fee calculation with APRA-specific details.
 */
export interface ApraFeeResult {
  /** Full fee calculation result from FeeService */
  calculation: FeeCalculationResult;
  /** Summary for display */
  summary: {
    /** Total pages copied */
    totalPages: number;
    /** Total amount in cents */
    totalCents: number;
    /** Formatted total (e.g., "$12.50") */
    formattedTotal: string;
  };
  /** Whether the request qualifies as "extensive" requiring labor fees */
  isExtensive: boolean;
}

/**
 * Default APRA fee rates in cents.
 * Used when FeeService doesn't have specific rates configured.
 */
export const DEFAULT_APRA_RATES = {
  /** $0.10 per page black & white (industry standard) */
  [APRA_FEE_CODES.COPY_BW_PAGE]: 10,
  /** $0.25 per page color */
  [APRA_FEE_CODES.COPY_COLOR_PAGE]: 25,
  /** $0.50 per large format page */
  [APRA_FEE_CODES.COPY_LARGE_FORMAT]: 50,
  /** $1.00 per CD/DVD */
  [APRA_FEE_CODES.MEDIA_CD_DVD]: 100,
  /** $5.00 per USB drive */
  [APRA_FEE_CODES.MEDIA_USB]: 500,
  /** $5.00 flat mailing fee */
  [APRA_FEE_CODES.MAILING]: 500,
  /** $15.00 per hour labor (if charged) */
  [APRA_FEE_CODES.LABOR_HOUR]: 1500,
  /** $1.00 per certification */
  [APRA_FEE_CODES.CERTIFICATION]: 100,
};

// =============================================================================
// APRA Fee Calculator
// =============================================================================

/**
 * Calculates APRA copying fees using the FeeService.
 *
 * Per IC 5-14-3-8, Indiana public agencies may charge reasonable fees for
 * copying public records. This calculator:
 * - Uses FeeService rates if configured
 * - Falls back to reasonable default rates
 * - Tracks all line items for transparency
 *
 * @example
 * const calculator = new ApraFeeCalculator(feeService);
 * const result = await calculator.calculateFees(ctx, {
 *   bwPages: 50,
 *   colorPages: 5,
 *   requiresMailing: true,
 * });
 * console.log(result.summary.formattedTotal); // "$8.75"
 */
export class ApraFeeCalculator {
  constructor(private readonly feeService?: FeeService) {}

  /**
   * Calculate APRA copy fees for a request.
   *
   * @param ctx - Tenant context
   * @param input - Fee calculation inputs
   * @returns Fee calculation result with APRA-specific summary
   */
  async calculateFees(
    ctx: TenantContext,
    input: ApraFeeInput
  ): Promise<ApraFeeResult> {
    const lines: FeeCalculationLine[] = [];
    const now = new Date();

    // Try to get rates from FeeService, fall back to defaults
    const rates = await this.getRates(ctx);

    // Calculate each fee type
    if (input.bwPages && input.bwPages > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.COPY_BW_PAGE,
        'Black & White Copies',
        input.bwPages,
        rates[APRA_FEE_CODES.COPY_BW_PAGE]
      ));
    }

    if (input.colorPages && input.colorPages > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.COPY_COLOR_PAGE,
        'Color Copies',
        input.colorPages,
        rates[APRA_FEE_CODES.COPY_COLOR_PAGE]
      ));
    }

    if (input.largeFormatPages && input.largeFormatPages > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.COPY_LARGE_FORMAT,
        'Large Format Copies',
        input.largeFormatPages,
        rates[APRA_FEE_CODES.COPY_LARGE_FORMAT]
      ));
    }

    if (input.cdDvdMedia && input.cdDvdMedia > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.MEDIA_CD_DVD,
        'CD/DVD Media',
        input.cdDvdMedia,
        rates[APRA_FEE_CODES.MEDIA_CD_DVD]
      ));
    }

    if (input.usbMedia && input.usbMedia > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.MEDIA_USB,
        'USB Drive',
        input.usbMedia,
        rates[APRA_FEE_CODES.MEDIA_USB]
      ));
    }

    if (input.requiresMailing) {
      lines.push(this.createLine(
        APRA_FEE_CODES.MAILING,
        'Mailing/Postage',
        1,
        rates[APRA_FEE_CODES.MAILING]
      ));
    }

    if (input.laborHours && input.laborHours > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.LABOR_HOUR,
        'Research/Retrieval Labor',
        input.laborHours,
        rates[APRA_FEE_CODES.LABOR_HOUR]
      ));
    }

    if (input.certifications && input.certifications > 0) {
      lines.push(this.createLine(
        APRA_FEE_CODES.CERTIFICATION,
        'Certification Fee',
        input.certifications,
        rates[APRA_FEE_CODES.CERTIFICATION]
      ));
    }

    // Calculate totals
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const totalCents = subtotalCents; // No discounts for APRA fees

    // Build result
    const calculation: FeeCalculationResult = {
      tenantId: ctx.tenantId,
      scheduleId: null,
      lines,
      subtotalCents,
      totalCents,
      currency: 'USD',
      calculatedAt: now.toISOString(),
      context: {
        applicantName: input.requesterName,
        caseNumber: input.requestId,
      },
    };

    const totalPages = (input.bwPages ?? 0) +
                       (input.colorPages ?? 0) +
                       (input.largeFormatPages ?? 0);

    // "Extensive" requests typically involve more than 100 pages or labor
    const isExtensive = totalPages > 100 || (input.laborHours ?? 0) > 0;

    return {
      calculation,
      summary: {
        totalPages,
        totalCents,
        formattedTotal: this.formatCents(totalCents),
      },
      isExtensive,
    };
  }

  /**
   * Get configured fee rates, falling back to defaults.
   */
  private async getRates(ctx: TenantContext): Promise<Record<string, number>> {
    const rates: Record<string, number> = { ...DEFAULT_APRA_RATES };

    // Create a set of valid APRA fee codes for fast lookup
    const validCodes = new Set<string>(Object.values(APRA_FEE_CODES));

    if (this.feeService) {
      try {
        const feeItems = await this.feeService.listFeeItems(ctx);
        for (const item of feeItems) {
          if (validCodes.has(item.code) && item.isActive) {
            rates[item.code] = item.baseAmountCents;
          }
        }
      } catch {
        // Use defaults if FeeService fails
      }
    }

    return rates;
  }

  /**
   * Create a fee calculation line item.
   */
  private createLine(
    code: string,
    name: string,
    quantity: number,
    unitAmountCents: number
  ): FeeCalculationLine {
    return {
      feeItemId: code,
      feeItemCode: code,
      feeItemName: name,
      quantity,
      unitAmountCents,
      lineTotalCents: quantity * unitAmountCents,
    };
  }

  /**
   * Format cents as a currency string.
   */
  private formatCents(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toFixed(2)}`;
  }
}

/**
 * Create default APRA fee items for a tenant.
 *
 * Call this to seed the FeeService with standard APRA fee items
 * that can then be customized by the tenant.
 */
export function getDefaultApraFeeItems(tenantId: string) {
  return [
    {
      id: `${tenantId}-apra-bw`,
      tenantId,
      code: APRA_FEE_CODES.COPY_BW_PAGE,
      name: 'APRA - Black & White Copy (per page)',
      description: 'Per IC 5-14-3-8, reasonable copying fee for standard B&W copies',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_BW_PAGE],
      isActive: true,
    },
    {
      id: `${tenantId}-apra-color`,
      tenantId,
      code: APRA_FEE_CODES.COPY_COLOR_PAGE,
      name: 'APRA - Color Copy (per page)',
      description: 'Per IC 5-14-3-8, reasonable copying fee for color copies',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_COLOR_PAGE],
      isActive: true,
    },
    {
      id: `${tenantId}-apra-large`,
      tenantId,
      code: APRA_FEE_CODES.COPY_LARGE_FORMAT,
      name: 'APRA - Large Format Copy (per page)',
      description: 'Per IC 5-14-3-8, fee for 11x17 or larger copies',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_LARGE_FORMAT],
      isActive: true,
    },
    {
      id: `${tenantId}-apra-cd`,
      tenantId,
      code: APRA_FEE_CODES.MEDIA_CD_DVD,
      name: 'APRA - CD/DVD Media',
      description: 'Per IC 5-14-3-8, fee for CD or DVD media',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.MEDIA_CD_DVD],
      isActive: true,
    },
    {
      id: `${tenantId}-apra-usb`,
      tenantId,
      code: APRA_FEE_CODES.MEDIA_USB,
      name: 'APRA - USB Drive',
      description: 'Per IC 5-14-3-8, fee for USB flash drive',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.MEDIA_USB],
      isActive: true,
    },
    {
      id: `${tenantId}-apra-mail`,
      tenantId,
      code: APRA_FEE_CODES.MAILING,
      name: 'APRA - Mailing/Postage',
      description: 'Per IC 5-14-3-8, reasonable mailing costs',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.MAILING],
      isActive: true,
    },
    {
      id: `${tenantId}-apra-labor`,
      tenantId,
      code: APRA_FEE_CODES.LABOR_HOUR,
      name: 'APRA - Labor (per hour)',
      description: 'Per IC 5-14-3-8, labor costs for extensive requests (if applicable)',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.LABOR_HOUR],
      isActive: false, // Disabled by default - agency must opt-in
    },
    {
      id: `${tenantId}-apra-cert`,
      tenantId,
      code: APRA_FEE_CODES.CERTIFICATION,
      name: 'APRA - Certification Fee',
      description: 'Fee for certified copies of public records',
      category: 'other' as const,
      baseAmountCents: DEFAULT_APRA_RATES[APRA_FEE_CODES.CERTIFICATION],
      isActive: true,
    },
  ];
}
