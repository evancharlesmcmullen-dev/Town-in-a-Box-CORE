// src/states/in/finance/__tests__/in-finance-seed.test.ts
//
// Tests for Indiana finance seed helpers

import { describe, it, expect } from 'vitest';
import {
  getDefaultIndianaTownFunds,
  getMinimalIndianaTownFunds,
  getDefaultIndianaTownshipFunds,
  getIndianaTownWithFireDeptFunds,
} from '../in-finance-seed';

describe('getDefaultIndianaTownFunds', () => {
  it('should return a non-empty array of funds', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    expect(funds).toBeDefined();
    expect(funds.length).toBeGreaterThan(0);
  });

  it('should have all funds with the correct tenantId', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    for (const fund of funds) {
      expect(fund.tenantId).toBe('lapel');
    }
  });

  it('should include a General Fund with code 0101 and type GENERAL', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const generalFund = funds.find((f) => f.code === '0101');

    expect(generalFund).toBeDefined();
    expect(generalFund!.name).toContain('General');
    expect(generalFund!.type).toBe('GENERAL');
    expect(generalFund!.isActive).toBe(true);
  });

  it('should include MVH fund', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const mvhFund = funds.find((f) => f.code === '0706');

    expect(mvhFund).toBeDefined();
    expect(mvhFund!.name).toContain('MVH');
    expect(mvhFund!.type).toBe('MVH');
  });

  it('should include Local Road & Street fund', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const lrsFund = funds.find((f) => f.code === '0708');

    expect(lrsFund).toBeDefined();
    expect(lrsFund!.type).toBe('LOCAL_ROAD_AND_STREET');
  });

  it('should include utility operating funds', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const waterFund = funds.find((f) => f.code === '6001');
    const sewerFund = funds.find((f) => f.code === '6002');

    expect(waterFund).toBeDefined();
    expect(waterFund!.type).toBe('UTILITY_OPERATING');
    expect(waterFund!.name).toContain('Water');

    expect(sewerFund).toBeDefined();
    expect(sewerFund!.type).toBe('UTILITY_OPERATING');
    expect(sewerFund!.name).toContain('Sewer');
  });

  it('should include Rainy Day fund', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const rainyDay = funds.find((f) => f.code === '1110');

    expect(rainyDay).toBeDefined();
    expect(rainyDay!.type).toBe('RAINY_DAY');
  });

  it('should have valid timestamps on all funds', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    for (const fund of funds) {
      expect(fund.createdAt).toBeDefined();
      expect(fund.updatedAt).toBeDefined();
      // Should be valid ISO date strings
      expect(() => new Date(fund.createdAt)).not.toThrow();
      expect(() => new Date(fund.updatedAt)).not.toThrow();
    }
  });

  it('should generate unique IDs based on tenantId and code', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const ids = funds.map((f) => f.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);

    // IDs should contain tenantId and code
    for (const fund of funds) {
      expect(fund.id).toContain('lapel');
      expect(fund.id).toContain(fund.code);
    }
  });

  it('should mark General Fund as major fund', () => {
    const funds = getDefaultIndianaTownFunds('lapel');

    const generalFund = funds.find((f) => f.code === '0101');

    expect(generalFund!.isMajorFund).toBe(true);
  });
});

describe('getMinimalIndianaTownFunds', () => {
  it('should return fewer funds than the default', () => {
    const minimal = getMinimalIndianaTownFunds('lapel');
    const full = getDefaultIndianaTownFunds('lapel');

    expect(minimal.length).toBeLessThan(full.length);
    expect(minimal.length).toBe(3);
  });

  it('should include General Fund, MVH, and Local Road & Street', () => {
    const funds = getMinimalIndianaTownFunds('lapel');
    const codes = funds.map((f) => f.code);

    expect(codes).toContain('0101');
    expect(codes).toContain('0706');
    expect(codes).toContain('0708');
  });

  it('should have all funds with the correct tenantId', () => {
    const funds = getMinimalIndianaTownFunds('westfield');

    for (const fund of funds) {
      expect(fund.tenantId).toBe('westfield');
    }
  });
});

describe('getDefaultIndianaTownshipFunds', () => {
  it('should return township-specific funds', () => {
    const funds = getDefaultIndianaTownshipFunds('green-township');

    expect(funds).toBeDefined();
    expect(funds.length).toBeGreaterThan(0);
  });

  it('should have all funds with the correct tenantId', () => {
    const funds = getDefaultIndianaTownshipFunds('green-township');

    for (const fund of funds) {
      expect(fund.tenantId).toBe('green-township');
    }
  });

  it('should include Township Assistance fund', () => {
    const funds = getDefaultIndianaTownshipFunds('green-township');

    const assistanceFund = funds.find((f) => f.name.includes('Assistance'));

    expect(assistanceFund).toBeDefined();
    expect(assistanceFund!.isMajorFund).toBe(true);
  });

  it('should include Township General Fund', () => {
    const funds = getDefaultIndianaTownshipFunds('green-township');

    const generalFund = funds.find((f) => f.name.includes('General'));

    expect(generalFund).toBeDefined();
    expect(generalFund!.type).toBe('GENERAL');
    expect(generalFund!.isMajorFund).toBe(true);
  });

  it('should include Fire Protection Territory fund', () => {
    const funds = getDefaultIndianaTownshipFunds('green-township');

    const fireFund = funds.find((f) => f.type === 'FIRE');

    expect(fireFund).toBeDefined();
  });
});

describe('getIndianaTownWithFireDeptFunds', () => {
  it('should include all base town funds plus fire fund', () => {
    const baseFunds = getDefaultIndianaTownFunds('lapel');
    const withFire = getIndianaTownWithFireDeptFunds('lapel');

    expect(withFire.length).toBe(baseFunds.length + 1);
  });

  it('should include a Fire Fighting Fund', () => {
    const funds = getIndianaTownWithFireDeptFunds('lapel');

    const fireFund = funds.find((f) => f.code === '0703');

    expect(fireFund).toBeDefined();
    expect(fireFund!.type).toBe('FIRE');
    expect(fireFund!.name).toContain('Fire');
  });

  it('should have all funds with the correct tenantId', () => {
    const funds = getIndianaTownWithFireDeptFunds('westfield');

    for (const fund of funds) {
      expect(fund.tenantId).toBe('westfield');
    }
  });
});

describe('Seeding with InMemoryFinanceService', () => {
  // This test validates that the seed data can actually be used
  it('should be able to use seed data with InMemoryFinanceService', async () => {
    // Import the service (we're testing integration, so import here)
    const { InMemoryFinanceService } = await import(
      '../../../../engines/finance/in-memory-finance.service'
    );
    // Import types - use import type for type-only imports
    type JurisdictionProfile = import('../../../../core/tenancy/tenancy.types').JurisdictionProfile;
    type TenantContext = import('../../../../core/tenancy/tenancy.types').TenantContext;

    const jurisdiction: JurisdictionProfile = {
      tenantId: 'lapel',
      state: 'IN',
      kind: 'town',
      name: 'Town of Lapel',
      authorityTags: [],
    };

    const ctx: TenantContext = {
      tenantId: 'lapel',
      jurisdiction,
    };

    const funds = getDefaultIndianaTownFunds('lapel');
    const service = new InMemoryFinanceService({ funds });

    const listedFunds = await service.listFunds(ctx);

    expect(listedFunds.length).toBe(funds.length);
    expect(listedFunds.map((f) => f.code)).toContain('0101');
    expect(listedFunds.map((f) => f.code)).toContain('0706');
  });
});
