// src/engines/fees/in-memory-fee.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FeeItem,
  FeeSchedule,
  FeeCalculationLine,
  FeeCalculationResult,
  FeeCalculationInput,
} from './fee.types';
import { FeeService } from './fee.service';

export interface InMemoryFeeSeedData {
  feeItems?: FeeItem[];
  feeSchedules?: FeeSchedule[];
}

/**
 * Simple in-memory implementation of FeeService for demos/tests.
 *
 * - All data is stored in memory.
 * - Calculation uses FeeItem.baseAmountCents and numeric parameters
 *   keyed by feeItem.code, defaulting to quantity 1 if no parameter exists.
 */
export class InMemoryFeeService implements FeeService {
  private feeItems: FeeItem[];
  private feeSchedules: FeeSchedule[];

  constructor(seed: InMemoryFeeSeedData = {}) {
    this.feeItems = seed.feeItems ? [...seed.feeItems] : [];
    this.feeSchedules = seed.feeSchedules ? [...seed.feeSchedules] : [];
  }

  async listFeeItems(ctx: TenantContext): Promise<FeeItem[]> {
    return this.feeItems.filter(
      (i) => i.tenantId === ctx.tenantId && i.isActive
    );
  }

  async getFeeItem(
    ctx: TenantContext,
    id: string
  ): Promise<FeeItem | null> {
    return (
      this.feeItems.find(
        (i) => i.id === id && i.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listFeeSchedules(ctx: TenantContext): Promise<FeeSchedule[]> {
    return this.feeSchedules.filter((s) => s.tenantId === ctx.tenantId);
  }

  async getFeeSchedule(
    ctx: TenantContext,
    id: string
  ): Promise<FeeSchedule | null> {
    return (
      this.feeSchedules.find(
        (s) => s.id === id && s.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async calculateFees(
    ctx: TenantContext,
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult> {
    const tenantId = ctx.tenantId;

    // Determine which fee items apply.
    let items: FeeItem[];

    if (input.feeScheduleId) {
      const schedule = this.feeSchedules.find(
        (s) => s.id === input.feeScheduleId && s.tenantId === tenantId
      );
      if (!schedule) {
        throw new Error('Fee schedule not found for tenant');
      }
      const itemIds = new Set(schedule.feeItemIds);
      items = this.feeItems.filter(
        (i) => i.tenantId === tenantId && i.isActive && itemIds.has(i.id)
      );
    } else {
      // No explicit schedule – use all active fee items for this tenant.
      items = this.feeItems.filter(
        (i) => i.tenantId === tenantId && i.isActive
      );
    }

    // Build calculation lines.
    const lines: FeeCalculationLine[] = items.map((item) => {
      // If a parameter exists matching the fee code, use that as quantity; otherwise 1.
      const quantityParam = input.parameters[item.code];
      const quantity =
        typeof quantityParam === 'number' && !isNaN(quantityParam)
          ? quantityParam
          : 1;

      const lineTotalCents = item.baseAmountCents * quantity;

      return {
        feeItemId: item.id,
        feeItemCode: item.code,
        feeItemName: item.name,
        quantity,
        unitAmountCents: item.baseAmountCents,
        lineTotalCents,
      };
    });

    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.lineTotalCents,
      0
    );

    // No discounts in this simple implementation
    const totalCents = subtotalCents;

    const result: FeeCalculationResult = {
      tenantId,
      scheduleId: input.feeScheduleId ?? null,
      lines,
      subtotalCents,
      totalCents,
      currency: 'USD',
      calculatedAt: new Date().toISOString(),
      context: input.context,
    };

    return result;
  }

  // Optional helpers to seed from outside for tests.
  addFeeItem(item: FeeItem): void {
    this.feeItems.push(item);
  }

  addFeeSchedule(schedule: FeeSchedule): void {
    this.feeSchedules.push(schedule);
  }
}
