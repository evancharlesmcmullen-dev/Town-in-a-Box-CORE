// src/engines/records/__tests__/apra-fee.calculator.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApraFeeCalculator,
  DEFAULT_INDIANA_FEE_SCHEDULE,
} from '../apra-fee.calculator';
import { TenantContext } from '../../../core/tenancy/tenancy.types';

describe('ApraFeeCalculator', () => {
  let calculator: ApraFeeCalculator;
  let ctx: TenantContext;

  beforeEach(() => {
    calculator = new ApraFeeCalculator();
    ctx = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      jurisdiction: {
        tenantId: 'test-tenant',
        state: 'IN',
        kind: 'town',
        name: 'Test Town',
        authorityTags: [],
      },
    };
  });

  describe('calculateFees with default rates', () => {
    it('should calculate black & white copy fees', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 100,
      });

      expect(result.totalPages).toBe(100);
      expect(result.totalCents).toBe(100 * DEFAULT_INDIANA_FEE_SCHEDULE.bwPageCents);
      expect(result.formattedTotal).toBe('$10.00');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].code).toBe('BW_COPY');
    });

    it('should calculate color copy fees', () => {
      const result = calculator.calculateFees(ctx, {
        colorPages: 20,
      });

      expect(result.totalPages).toBe(20);
      expect(result.totalCents).toBe(20 * DEFAULT_INDIANA_FEE_SCHEDULE.colorPageCents);
      expect(result.formattedTotal).toBe('$5.00');
    });

    it('should calculate combined copy fees', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 50,      // 50 * $0.10 = $5.00
        colorPages: 10,   // 10 * $0.25 = $2.50
        largeFormatPages: 5, // 5 * $0.50 = $2.50
      });

      expect(result.totalPages).toBe(65);
      expect(result.totalCents).toBe(
        50 * DEFAULT_INDIANA_FEE_SCHEDULE.bwPageCents +
        10 * DEFAULT_INDIANA_FEE_SCHEDULE.colorPageCents +
        5 * DEFAULT_INDIANA_FEE_SCHEDULE.largeFormatPageCents
      );
      expect(result.formattedTotal).toBe('$10.00');
      expect(result.lines).toHaveLength(3);
    });

    it('should include mailing fee when required', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 10,
        requiresMailing: true,
      });

      expect(result.lines).toHaveLength(2);
      const mailingLine = result.lines.find(l => l.code === 'MAILING');
      expect(mailingLine).toBeDefined();
      expect(mailingLine?.lineTotalCents).toBe(DEFAULT_INDIANA_FEE_SCHEDULE.defaultMailingCents);
    });

    it('should calculate media fees', () => {
      const result = calculator.calculateFees(ctx, {
        cdDvdMedia: 2,
        usbMedia: 1,
      });

      expect(result.lines).toHaveLength(2);
      expect(result.totalCents).toBe(
        2 * DEFAULT_INDIANA_FEE_SCHEDULE.cdDvdCents +
        1 * DEFAULT_INDIANA_FEE_SCHEDULE.usbCents
      );
      expect(result.formattedTotal).toBe('$7.00');
    });

    it('should calculate labor fees only for hours over threshold', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 500,
        laborHours: 4, // 2 hours free, charge for 2
      });

      expect(result.isExtensive).toBe(true);
      const laborLine = result.lines.find(l => l.code === 'LABOR');
      expect(laborLine).toBeDefined();
      expect(laborLine?.quantity).toBe(2); // Only 2 chargeable hours
      expect(laborLine?.lineTotalCents).toBe(2 * DEFAULT_INDIANA_FEE_SCHEDULE.laborHourlyCents);
    });

    it('should not charge labor for requests under threshold', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 50,
        laborHours: 1.5, // Under 2 hour threshold
      });

      expect(result.isExtensive).toBe(false);
      const laborLine = result.lines.find(l => l.code === 'LABOR');
      expect(laborLine).toBeUndefined();
    });

    it('should calculate certification fees', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 10,
        certifications: 3,
      });

      const certLine = result.lines.find(l => l.code === 'CERTIFICATION');
      expect(certLine).toBeDefined();
      expect(certLine?.quantity).toBe(3);
      expect(certLine?.lineTotalCents).toBe(3 * DEFAULT_INDIANA_FEE_SCHEDULE.certificationCents);
    });

    it('should return empty result for no fees', () => {
      const result = calculator.calculateFees(ctx, {});

      expect(result.totalPages).toBe(0);
      expect(result.totalCents).toBe(0);
      expect(result.formattedTotal).toBe('$0.00');
      expect(result.lines).toHaveLength(0);
    });

    it('should include context in result', () => {
      const result = calculator.calculateFees(ctx, {
        bwPages: 10,
        requestId: 'APRA-2025-001',
        requesterName: 'John Doe',
      });

      expect(result.requestId).toBe('APRA-2025-001');
      expect(result.requesterName).toBe('John Doe');
    });
  });

  describe('calculateFees with custom schedule', () => {
    it('should use custom rates when provided', () => {
      const customCalculator = new ApraFeeCalculator({
        ...DEFAULT_INDIANA_FEE_SCHEDULE,
        bwPageCents: 15, // $0.15 instead of $0.10
      });

      const result = customCalculator.calculateFees(ctx, {
        bwPages: 100,
      });

      expect(result.totalCents).toBe(100 * 15);
      expect(result.formattedTotal).toBe('$15.00');
    });
  });

  describe('getSchedule', () => {
    it('should return the current fee schedule', () => {
      const schedule = calculator.getSchedule();

      expect(schedule.bwPageCents).toBe(DEFAULT_INDIANA_FEE_SCHEDULE.bwPageCents);
      expect(schedule.colorPageCents).toBe(DEFAULT_INDIANA_FEE_SCHEDULE.colorPageCents);
    });
  });

  describe('setSchedule', () => {
    it('should allow partial schedule updates', () => {
      calculator.setSchedule({ bwPageCents: 5 }); // Lower fee

      const schedule = calculator.getSchedule();
      expect(schedule.bwPageCents).toBe(5);
      expect(schedule.colorPageCents).toBe(DEFAULT_INDIANA_FEE_SCHEDULE.colorPageCents);
    });
  });

  describe('realistic scenarios', () => {
    it('should calculate fees for a typical small request', () => {
      // Citizen requests 25 pages of meeting minutes, mailed
      const result = calculator.calculateFees(ctx, {
        bwPages: 25,
        requiresMailing: true,
        requesterName: 'Jane Citizen',
      });

      // 25 * $0.10 + $5.00 mailing = $7.50
      expect(result.totalCents).toBe(750);
      expect(result.formattedTotal).toBe('$7.50');
      expect(result.isExtensive).toBe(false);
    });

    it('should calculate fees for a media request', () => {
      // Reporter requests body cam footage on USB
      const result = calculator.calculateFees(ctx, {
        usbMedia: 1,
        requesterName: 'News Reporter',
      });

      expect(result.totalCents).toBe(500);
      expect(result.formattedTotal).toBe('$5.00');
    });

    it('should calculate fees for an extensive request', () => {
      // Researcher requests 500 pages with 4 hours of staff time
      const result = calculator.calculateFees(ctx, {
        bwPages: 500,      // 500 * $0.10 = $50.00
        colorPages: 50,    // 50 * $0.25 = $12.50
        laborHours: 4,     // 2 chargeable hours * $20.00 = $40.00
        cdDvdMedia: 2,     // 2 * $1.00 = $2.00
        requiresMailing: true, // $5.00
      });

      // Total: $109.50
      expect(result.totalCents).toBe(10950);
      expect(result.formattedTotal).toBe('$109.50');
      expect(result.isExtensive).toBe(true);
    });

    it('should calculate fees for certified copies', () => {
      // Attorney requests 3 certified copies of a resolution
      const result = calculator.calculateFees(ctx, {
        bwPages: 5,         // 5 * $0.10 = $0.50
        certifications: 3,  // 3 * $2.00 = $6.00
      });

      expect(result.totalCents).toBe(650);
      expect(result.formattedTotal).toBe('$6.50');
    });
  });
});
