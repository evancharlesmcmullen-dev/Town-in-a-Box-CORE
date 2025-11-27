// src/engines/records/__tests__/apra-fee.calculator.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApraFeeCalculator,
  APRA_FEE_CODES,
  DEFAULT_APRA_RATES,
  getDefaultApraFeeItems,
} from '../apra-fee.calculator';
import { TenantContext } from '../../../core/tenancy/tenancy.types';
import { InMemoryFeeService } from '../../fees/in-memory-fee.service';

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
    it('should calculate black & white copy fees', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 100,
      });

      expect(result.summary.totalPages).toBe(100);
      expect(result.summary.totalCents).toBe(100 * DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_BW_PAGE]);
      expect(result.summary.formattedTotal).toBe('$10.00');
      expect(result.calculation.lines).toHaveLength(1);
      expect(result.calculation.lines[0].feeItemCode).toBe(APRA_FEE_CODES.COPY_BW_PAGE);
    });

    it('should calculate color copy fees', async () => {
      const result = await calculator.calculateFees(ctx, {
        colorPages: 20,
      });

      expect(result.summary.totalPages).toBe(20);
      expect(result.summary.totalCents).toBe(20 * DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_COLOR_PAGE]);
      expect(result.summary.formattedTotal).toBe('$5.00');
    });

    it('should calculate combined copy fees', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 50,      // 50 * $0.10 = $5.00
        colorPages: 10,   // 10 * $0.25 = $2.50
        largeFormatPages: 5, // 5 * $0.50 = $2.50
      });

      expect(result.summary.totalPages).toBe(65);
      expect(result.summary.totalCents).toBe(
        50 * DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_BW_PAGE] +
        10 * DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_COLOR_PAGE] +
        5 * DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_LARGE_FORMAT]
      );
      expect(result.summary.formattedTotal).toBe('$10.00');
      expect(result.calculation.lines).toHaveLength(3);
    });

    it('should include mailing fee when required', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 10,
        requiresMailing: true,
      });

      expect(result.calculation.lines).toHaveLength(2);
      const mailingLine = result.calculation.lines.find(
        l => l.feeItemCode === APRA_FEE_CODES.MAILING
      );
      expect(mailingLine).toBeDefined();
      expect(mailingLine?.lineTotalCents).toBe(DEFAULT_APRA_RATES[APRA_FEE_CODES.MAILING]);
    });

    it('should calculate media fees', async () => {
      const result = await calculator.calculateFees(ctx, {
        cdDvdMedia: 2,
        usbMedia: 1,
      });

      expect(result.calculation.lines).toHaveLength(2);
      expect(result.summary.totalCents).toBe(
        2 * DEFAULT_APRA_RATES[APRA_FEE_CODES.MEDIA_CD_DVD] +
        1 * DEFAULT_APRA_RATES[APRA_FEE_CODES.MEDIA_USB]
      );
      expect(result.summary.formattedTotal).toBe('$7.00');
    });

    it('should calculate labor fees for extensive requests', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 500,
        laborHours: 2,
      });

      expect(result.isExtensive).toBe(true);
      const laborLine = result.calculation.lines.find(
        l => l.feeItemCode === APRA_FEE_CODES.LABOR_HOUR
      );
      expect(laborLine).toBeDefined();
      expect(laborLine?.quantity).toBe(2);
      expect(laborLine?.lineTotalCents).toBe(2 * DEFAULT_APRA_RATES[APRA_FEE_CODES.LABOR_HOUR]);
    });

    it('should calculate certification fees', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 10,
        certifications: 3,
      });

      const certLine = result.calculation.lines.find(
        l => l.feeItemCode === APRA_FEE_CODES.CERTIFICATION
      );
      expect(certLine).toBeDefined();
      expect(certLine?.quantity).toBe(3);
      expect(certLine?.lineTotalCents).toBe(3 * DEFAULT_APRA_RATES[APRA_FEE_CODES.CERTIFICATION]);
    });

    it('should return empty result for no fees', async () => {
      const result = await calculator.calculateFees(ctx, {});

      expect(result.summary.totalPages).toBe(0);
      expect(result.summary.totalCents).toBe(0);
      expect(result.summary.formattedTotal).toBe('$0.00');
      expect(result.calculation.lines).toHaveLength(0);
    });

    it('should mark requests over 100 pages as extensive', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 101,
      });

      expect(result.isExtensive).toBe(true);
    });

    it('should mark requests with labor as extensive', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 10,
        laborHours: 0.5,
      });

      expect(result.isExtensive).toBe(true);
    });

    it('should include context in calculation result', async () => {
      const result = await calculator.calculateFees(ctx, {
        bwPages: 10,
        requestId: 'APRA-2025-001',
        requesterName: 'John Doe',
      });

      expect(result.calculation.context?.caseNumber).toBe('APRA-2025-001');
      expect(result.calculation.context?.applicantName).toBe('John Doe');
    });
  });

  describe('calculateFees with FeeService', () => {
    it('should use custom rates from FeeService when available', async () => {
      const feeService = new InMemoryFeeService({
        feeItems: [
          {
            id: 'custom-bw',
            tenantId: 'test-tenant',
            code: APRA_FEE_CODES.COPY_BW_PAGE,
            name: 'Custom B&W Rate',
            category: 'other',
            baseAmountCents: 15, // $0.15 instead of $0.10
            isActive: true,
          },
        ],
      });

      const calculatorWithService = new ApraFeeCalculator(feeService);

      const result = await calculatorWithService.calculateFees(ctx, {
        bwPages: 100,
      });

      expect(result.summary.totalCents).toBe(100 * 15); // Custom rate
      expect(result.summary.formattedTotal).toBe('$15.00');
    });

    it('should fall back to defaults if FeeService has no APRA items', async () => {
      const feeService = new InMemoryFeeService({
        feeItems: [
          {
            id: 'other-fee',
            tenantId: 'test-tenant',
            code: 'NOT_APRA',
            name: 'Other Fee',
            category: 'other',
            baseAmountCents: 1000,
            isActive: true,
          },
        ],
      });

      const calculatorWithService = new ApraFeeCalculator(feeService);

      const result = await calculatorWithService.calculateFees(ctx, {
        bwPages: 100,
      });

      expect(result.summary.totalCents).toBe(100 * DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_BW_PAGE]);
    });
  });

  describe('getDefaultApraFeeItems', () => {
    it('should return default fee items for a tenant', () => {
      const items = getDefaultApraFeeItems('my-tenant');

      expect(items.length).toBeGreaterThan(0);
      expect(items.every(i => i.tenantId === 'my-tenant')).toBe(true);

      // Check for key fee items
      const bwItem = items.find(i => i.code === APRA_FEE_CODES.COPY_BW_PAGE);
      expect(bwItem).toBeDefined();
      expect(bwItem?.baseAmountCents).toBe(DEFAULT_APRA_RATES[APRA_FEE_CODES.COPY_BW_PAGE]);
      expect(bwItem?.isActive).toBe(true);

      // Labor should be inactive by default
      const laborItem = items.find(i => i.code === APRA_FEE_CODES.LABOR_HOUR);
      expect(laborItem).toBeDefined();
      expect(laborItem?.isActive).toBe(false);
    });

    it('should include all standard APRA fee codes', () => {
      const items = getDefaultApraFeeItems('test');
      const codes = items.map(i => i.code);

      expect(codes).toContain(APRA_FEE_CODES.COPY_BW_PAGE);
      expect(codes).toContain(APRA_FEE_CODES.COPY_COLOR_PAGE);
      expect(codes).toContain(APRA_FEE_CODES.COPY_LARGE_FORMAT);
      expect(codes).toContain(APRA_FEE_CODES.MEDIA_CD_DVD);
      expect(codes).toContain(APRA_FEE_CODES.MEDIA_USB);
      expect(codes).toContain(APRA_FEE_CODES.MAILING);
      expect(codes).toContain(APRA_FEE_CODES.LABOR_HOUR);
      expect(codes).toContain(APRA_FEE_CODES.CERTIFICATION);
    });
  });

  describe('realistic scenarios', () => {
    it('should calculate fees for a typical small request', async () => {
      // Citizen requests 25 pages of meeting minutes, mailed
      const result = await calculator.calculateFees(ctx, {
        bwPages: 25,
        requiresMailing: true,
        requesterName: 'Jane Citizen',
      });

      // 25 * $0.10 + $5.00 mailing = $7.50
      expect(result.summary.totalCents).toBe(750);
      expect(result.summary.formattedTotal).toBe('$7.50');
      expect(result.isExtensive).toBe(false);
    });

    it('should calculate fees for a media request', async () => {
      // Reporter requests body cam footage on USB
      const result = await calculator.calculateFees(ctx, {
        usbMedia: 1,
        requesterName: 'News Reporter',
      });

      expect(result.summary.totalCents).toBe(500);
      expect(result.summary.formattedTotal).toBe('$5.00');
    });

    it('should calculate fees for an extensive request', async () => {
      // Researcher requests 500 pages with 4 hours of staff time
      const result = await calculator.calculateFees(ctx, {
        bwPages: 500,      // 500 * $0.10 = $50.00
        colorPages: 50,    // 50 * $0.25 = $12.50
        laborHours: 4,     // 4 * $15.00 = $60.00
        cdDvdMedia: 2,     // 2 * $1.00 = $2.00
        requiresMailing: true, // $5.00
      });

      // Total: $129.50
      expect(result.summary.totalCents).toBe(12950);
      expect(result.summary.formattedTotal).toBe('$129.50');
      expect(result.isExtensive).toBe(true);
    });

    it('should calculate fees for certified copies', async () => {
      // Attorney requests 3 certified copies of a resolution
      const result = await calculator.calculateFees(ctx, {
        bwPages: 5,         // 5 * $0.10 = $0.50
        certifications: 3,  // 3 * $1.00 = $3.00
      });

      expect(result.summary.totalCents).toBe(350);
      expect(result.summary.formattedTotal).toBe('$3.50');
    });
  });
});
