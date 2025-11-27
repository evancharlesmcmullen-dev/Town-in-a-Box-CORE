// src/engines/fees/in-memory-fee.service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFeeService } from './in-memory-fee.service';
import { FeeItem, FeeSchedule, FeeCalculationContext } from './fee.types';
import { TenantContext } from '../../core/tenancy/tenancy.types';

// Test fixture for TenantContext
const createTestContext = (): TenantContext => ({
  tenantId: 'test-tenant',
  userId: 'test-user',
  jurisdiction: {
    tenantId: 'test-tenant',
    state: 'IN',
    kind: 'town',
    name: 'Test Town',
    authorityTags: ['zoningAuthority'],
  },
});

describe('InMemoryFeeService', () => {
  let service: InMemoryFeeService;
  let ctx: TenantContext;

  const sampleFeeItems: FeeItem[] = [
    {
      id: 'fee-water-tap',
      tenantId: 'test-tenant',
      code: 'WATER_TAP_3_4',
      name: '3/4" Water Tap Fee',
      category: 'utility',
      baseAmountCents: 150000, // $1,500
      isActive: true,
    },
    {
      id: 'fee-park-impact',
      tenantId: 'test-tenant',
      code: 'IMPACT_PARK',
      name: 'Park Impact Fee',
      category: 'impact',
      baseAmountCents: 50000, // $500 per EDU
      isActive: true,
    },
    {
      id: 'fee-road-impact',
      tenantId: 'test-tenant',
      code: 'IMPACT_ROAD',
      name: 'Road Impact Fee',
      category: 'impact',
      baseAmountCents: 75000, // $750 per EDU
      isActive: true,
    },
  ];

  const sampleSchedule: FeeSchedule = {
    id: 'sched-2025-impact',
    tenantId: 'test-tenant',
    name: '2025 Impact Fee Schedule',
    effectiveFrom: new Date('2025-01-01'),
    feeItemIds: ['fee-park-impact', 'fee-road-impact'],
  };

  beforeEach(() => {
    service = new InMemoryFeeService({
      feeItems: sampleFeeItems,
      feeSchedules: [sampleSchedule],
    });
    ctx = createTestContext();
  });

  describe('calculateFees', () => {
    it('should calculate fees with context and return proper result structure', async () => {
      const inputContext: FeeCalculationContext = {
        applicantName: 'ABC Builders LLC',
        parcelId: '48-05-36-100-001',
        caseNumber: 'SUB-2025-003',
        permitNumber: 'BP-2025-0042',
        submittedAt: '2025-01-15T14:30:00Z',
      };

      const result = await service.calculateFees(ctx, {
        feeScheduleId: 'sched-2025-impact',
        parameters: {
          IMPACT_PARK: 10, // 10 EDUs
          IMPACT_ROAD: 10,
        },
        context: inputContext,
      });

      // Verify subtotalCents is an integer >= 0
      expect(Number.isInteger(result.subtotalCents)).toBe(true);
      expect(result.subtotalCents).toBeGreaterThanOrEqual(0);

      // Verify currency
      expect(result.currency).toBe('USD');

      // Verify calculatedAt is ISO 8601
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(result.calculatedAt).toMatch(isoRegex);

      // Verify context is echoed back
      expect(result.context).toEqual(inputContext);
    });

    it('should calculate correct line totals', async () => {
      const result = await service.calculateFees(ctx, {
        feeScheduleId: 'sched-2025-impact',
        parameters: {
          IMPACT_PARK: 5, // 5 EDUs × $500 = $2,500
          IMPACT_ROAD: 5, // 5 EDUs × $750 = $3,750
        },
      });

      // Find lines
      const parkLine = result.lines.find((l) => l.feeItemCode === 'IMPACT_PARK');
      const roadLine = result.lines.find((l) => l.feeItemCode === 'IMPACT_ROAD');

      expect(parkLine?.lineTotalCents).toBe(250000); // $2,500
      expect(roadLine?.lineTotalCents).toBe(375000); // $3,750

      // Subtotal = sum of lines
      expect(result.subtotalCents).toBe(625000); // $6,250
      expect(result.totalCents).toBe(625000); // No discounts
    });

    it('should default quantity to 1 if parameter not provided', async () => {
      const result = await service.calculateFees(ctx, {
        feeScheduleId: 'sched-2025-impact',
        parameters: {}, // No quantities specified
      });

      // Each should be quantity 1
      result.lines.forEach((line) => {
        expect(line.quantity).toBe(1);
      });
    });

    it('should use all active fee items when no schedule specified', async () => {
      const result = await service.calculateFees(ctx, {
        parameters: {
          WATER_TAP_3_4: 1,
          IMPACT_PARK: 2,
          IMPACT_ROAD: 2,
        },
      });

      // Should include all 3 active items
      expect(result.lines).toHaveLength(3);
      expect(result.scheduleId).toBeNull();
    });

    it('should return context as undefined if not provided', async () => {
      const result = await service.calculateFees(ctx, {
        parameters: { IMPACT_PARK: 1 },
      });

      expect(result.context).toBeUndefined();
    });

    it('should throw when fee schedule not found', async () => {
      await expect(
        service.calculateFees(ctx, {
          feeScheduleId: 'nonexistent-schedule',
          parameters: {},
        })
      ).rejects.toThrow('Fee schedule not found for tenant');
    });
  });
});
