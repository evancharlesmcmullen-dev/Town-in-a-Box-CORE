// src/engines/fees/fee.types.ts
//
// Core types for fees, fines, and impact fee calculations.
// These are intentionally generic so Planning, Utilities, Permitting, and
// Code Enforcement can all plug into the same engine.

// ===========================================================================
// FEE ITEMS & SCHEDULES
// ===========================================================================

/**
 * High-level classification for a fee item.
 */
export type FeeCategory =
  | 'utility'   // Water/sewer tap fees, connection fees
  | 'permit'    // Building, sign, ROW permits
  | 'impact'    // Park, road, drainage impact fees
  | 'fine'      // Code enforcement fines
  | 'program'   // Recreation, cemetery, etc.
  | 'other';

/**
 * A fee item definition (e.g., "Water Tap Fee", "Park Impact Fee").
 *
 * Fee items are the building blocks of fee schedules. Each represents
 * a single chargeable item with a base amount.
 *
 * @example
 * {
 *   id: 'fee-001',
 *   tenantId: 'lapel',
 *   code: 'WATER_TAP_3_4',
 *   name: '3/4" Water Tap Fee',
 *   category: 'utility',
 *   baseAmountCents: 150000, // $1,500.00
 *   isActive: true
 * }
 */
export interface FeeItem {
  id: string;
  tenantId: string;

  /** Unique code for lookups (e.g., "WATER_TAP_3_4", "IMPACT_PARK"). */
  code: string;
  /** Human-readable name. */
  name: string;
  description?: string;

  category: FeeCategory;

  /** Base amount in cents. For quantity-based fees, this is the per-unit rate. */
  baseAmountCents: number;

  isActive: boolean;
}

/**
 * A fee schedule groups fee items adopted together by ordinance or resolution.
 *
 * Schedules have effective dates, allowing you to maintain historical
 * fee structures for audit purposes.
 *
 * @example
 * {
 *   id: 'sched-2025-utility',
 *   tenantId: 'lapel',
 *   name: '2025 Utility Fee Schedule',
 *   effectiveFrom: new Date('2025-01-01'),
 *   feeItemIds: ['fee-001', 'fee-002', 'fee-003']
 * }
 */
export interface FeeSchedule {
  id: string;
  tenantId: string;

  name: string;
  description?: string;

  /** When this schedule becomes effective. */
  effectiveFrom: Date;
  /** When this schedule expires (null = no expiration). */
  effectiveTo?: Date;

  /** Fee item IDs included in this schedule. */
  feeItemIds: string[];
}

// ===========================================================================
// FEE CALCULATION INPUT
// ===========================================================================

/**
 * A single parameter for fee calculation (alternative structured format).
 */
export interface FeeCalculationParameter {
  /** Fee item code (e.g., "WATER_TAP_3_4", "sq_ft"). */
  key: string;
  /** Quantity or multiplier value. */
  value: number;
}

/**
 * Context for audit logs and legal defensibility.
 *
 * This information travels from input → result → storage, creating
 * an "instant case file" for any fee calculation.
 */
export interface FeeCalculationContext {
  /** Name of the applicant or property owner. */
  applicantName?: string;
  /** Parcel ID from GIS/assessor records. */
  parcelId?: string;
  /** Related case number (e.g., BZA-2025-001). */
  caseNumber?: string;
  /** Related permit number (e.g., BP-2025-0042). */
  permitNumber?: string;
  /** When the application/request was submitted (ISO 8601). */
  submittedAt?: string;
}

/**
 * Input for calculating fees.
 *
 * The fee engine uses this to determine which fees apply and
 * compute the total amount due.
 *
 * @example
 * const input: FeeCalculationInput = {
 *   feeScheduleId: 'sched-2025-impact',
 *   parameters: {
 *     'IMPACT_PARK': 10,    // 10 EDUs
 *     'IMPACT_ROAD': 10,
 *   },
 *   context: {
 *     applicantName: 'ABC Builders',
 *     parcelId: '48-05-36-100-001',
 *     caseNumber: 'SUB-2025-003'
 *   }
 * };
 */
export interface FeeCalculationInput {
  /** Optional: use a specific fee schedule. If omitted, uses all active items. */
  feeScheduleId?: string;

  /**
   * Parameters keyed by fee item code.
   * The value is the quantity/multiplier for that fee item.
   * Items not in this map default to quantity 1.
   */
  parameters: Record<string, number>;

  /**
   * Optional context for audit trail. Echoed back in the result.
   */
  context?: FeeCalculationContext;
}

// ===========================================================================
// FEE CALCULATION RESULT
// ===========================================================================

/**
 * A single calculated line item.
 *
 * @example
 * {
 *   feeItemId: 'fee-park-impact',
 *   feeItemCode: 'IMPACT_PARK',
 *   feeItemName: 'Park Impact Fee',
 *   quantity: 10,
 *   unitAmountCents: 50000,  // $500/EDU
 *   lineTotalCents: 500000   // $5,000 total
 * }
 */
export interface FeeCalculationLine {
  feeItemId: string;
  feeItemCode: string;
  feeItemName: string;

  /** Number of units, EDUs, square feet, etc. */
  quantity: number;
  /** Amount per unit in cents. */
  unitAmountCents: number;
  /** Line total: quantity × unitAmountCents. */
  lineTotalCents: number;
}

/**
 * A discount or adjustment applied to the fee total.
 */
export interface FeeDiscountLine {
  /** Discount code for tracking. */
  code: string;
  /** Human-readable description. */
  description: string;
  /** Discount amount in cents (positive = reduction). */
  amountCents: number;
  /** Reason for the discount (for audit). */
  reason?: string;
}

/**
 * Result of a fee calculation.
 *
 * This is the canonical output from the fee engine. It contains
 * everything needed for invoicing, audit, and legal defensibility.
 *
 * @example
 * {
 *   tenantId: 'lapel',
 *   scheduleId: 'sched-2025-impact',
 *   lines: [...],
 *   subtotalCents: 750000,
 *   totalCents: 750000,
 *   currency: 'USD',
 *   calculatedAt: new Date(),
 *   context: { applicantName: 'ABC Builders', ... }
 * }
 */
export interface FeeCalculationResult {
  tenantId: string;
  /** Which schedule was used (null if no specific schedule). */
  scheduleId: string | null;

  /** Individual line items. */
  lines: FeeCalculationLine[];
  /** Sum of all lines before discounts. */
  subtotalCents: number;

  /** Applied discounts (if any). */
  discounts?: FeeDiscountLine[];
  /** Total discount amount. */
  totalDiscountCents?: number;

  /** Final amount due after discounts. */
  totalCents: number;
  /** Currency code (locked to USD). */
  currency: 'USD';

  /** When this calculation was performed. */
  calculatedAt: Date;
  /** Echoed context from the input for audit trail. */
  context?: FeeCalculationContext;
}
