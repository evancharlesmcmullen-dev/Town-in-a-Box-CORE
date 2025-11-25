// src/engines/fees/fee.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FeeItem,
  FeeSchedule,
  FeeCalculationInput,
  FeeCalculationResult,
} from './fee.types';

/**
 * Public service interface for the Fees & Impact engine.
 *
 * Implementations will:
 * - Manage fee items & schedules,
 * - Compute fee totals for given inputs.
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

  calculateFees(
    ctx: TenantContext,
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult>;
}
