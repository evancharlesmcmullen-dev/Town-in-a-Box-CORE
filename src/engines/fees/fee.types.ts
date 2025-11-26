// src/engines/fees/fee.types.ts

// Core types for fees, fines, and impact fee calculations.
// These are intentionally generic so Planning, Utilities, Permitting, and
// Code Enforcement can all plug into the same engine.

/**
 * High-level classification for a fee item.
 */
export type FeeCategory =
  | 'utility'
  | 'permit'
  | 'impact'
  | 'fine'
  | 'program'
  | 'other';

/**
 * A fee "item" (e.g., "Water Tap Fee", "Park Impact Fee", "Sign Permit Fee").
 * In practice, some of these will have formulas; for now we keep it simple.
 */
export interface FeeItem {
  id: string;
  tenantId: string;

  code: string;                // e.g. "WATER_TAP_3_4", "IMPACT_PARK", "FINE_GRASS"
  name: string;
  description?: string;

  category: FeeCategory;

  // Base amount in cents for simple fees.
  // For more complex formulas, we can add parameters later.
  baseAmountCents: number;

  isActive: boolean;
}

/**
 * A fee schedule groups fee items that are adopted together by ordinance or resolution.
 * E.g., "2025 Utility Fee Schedule", "2024 Impact Fee Schedule".
 */
export interface FeeSchedule {
  id: string;
  tenantId: string;

  name: string;                // e.g. "2025 Utility Fees"
  description?: string;

  effectiveFrom: Date;
  effectiveTo?: Date;

  feeItemIds: string[];        // FeeItem ids included in this schedule
}

/**
 * Input for calculating fees.
 */
export interface FeeCalculationInput {
  feeScheduleId?: string;      // optional: use specific schedule
  parameters: Record<string, number>; // quantity/multiplier by fee item code
}

/**
 * A single calculated line in a fee computation (e.g. "10 EDUs x $500 per EDU = $5,000").
 */
export interface FeeCalculationLine {
  feeItemId: string;
  feeItemCode: string;
  feeItemName: string;

  quantity: number;            // e.g. number of units, EDUs, square feet factor
  unitAmountCents: number;     // amount per unit
  lineTotalCents: number;      // quantity * unitAmountCents
}

/**
 * Result of a fee calculation for a particular case/action.
 */
export interface FeeCalculationResult {
  tenantId: string;
  scheduleId: string | null;   // which schedule was used, if any
  lines: FeeCalculationLine[];
  totalCents: number;
  currency: string;            // e.g. "USD"
}