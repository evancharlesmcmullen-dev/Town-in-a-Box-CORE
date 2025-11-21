// src/engines/fees/fee.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FeeItem,
  FeeSchedule,
  FeeCalculationResult,
} from './fee.types';

/**
 * Input for calculating fees in a generic way.
 * Domain-specific engines (Planning, Utilities, Permitting) will call this with
 * the parameters they know (units, square footage, case type, etc.).
 */
export interface FeeCalculationInput {
  /**
   * Optional explicit schedule to use. If omitted, implementation may choose
   * the "current" or case-appropriate schedule.
   */
  feeScheduleId?: string | null;

  /**
   * Domain where the fee is being calculated, to help implementations route
   * to the right rules: 'planning', 'utilities', 'permitting', etc.
   */
  domain: 'planning' | 'utilities' | 'permitting' | 'codeEnforcement' | 'other';

  /**
   * A case or action type identifier from the calling engine, e.g.:
   * "USE_VARIANCE", "PRIMARY_PLAT", "WATER_TAP_3_4", "CODE_WEEDS".
   */
  caseType?: string;

  /**
   * Arbitrary numeric parameters, e.g.:
   * - units: number of dwelling units
   * - squareFeet: building square footage
   * - frontageFeet: linear frontage
   * - edus: equivalent dwelling units
   *
   * We'll keep this generic so each engine can decide how to populate it.
   */
  parameters: Record<string, number>;
}

/**
 * Public service interface for the Fees & Impact engine.
 *
 * Implementations will:
 * - Load FeeItems and FeeSchedules (from DB, config, or ordinance metadata).
 * - Apply jurisdiction- and case-specific rules to compute FeeCalculationResult.
 * - Be driven by INLegalEngine (and other state engines) for statutory constraints
 *   and required fee structures.
 */
export interface FeeService {
  //
  // FEE ITEMS & SCHEDULES
  //

  listFeeItems(ctx: TenantContext): Promise<FeeItem[]>;

  getFeeItem(
    ctx: TenantContext,
    id: string
  ): Promise<FeeItem | null>;

  listFeeSchedules(ctx: TenantContext): Promise<FeeSchedule[]>;

  getFeeSchedule(
    ctx: TenantContext,
    id: string
  ): Promise<FeeSchedule | null>;

  //
  // CALCULATION
  //

  /**
   * Calculate fees for a given input. Implementations may:
   * - Use a specific fee schedule (if feeScheduleId provided), or
   * - Automatically select the appropriate schedule based on date/domain/caseType.
   */
  calculateFees(
    ctx: TenantContext,
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult>;
}