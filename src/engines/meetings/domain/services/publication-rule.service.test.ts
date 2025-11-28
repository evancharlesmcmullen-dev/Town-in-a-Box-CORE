// src/engines/meetings/domain/services/publication-rule.service.test.ts
//
// Unit tests for PublicationRuleService.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PublicationRuleService,
  InMemoryPublicationRuleStore,
  getDefaultIndianaRule,
  requiresNewspaperPublication,
  getMinimumLeadDays,
} from './publication-rule.service';
import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import { INDIANA_PUBLICATION_RULES } from '../constants/indiana.constants';

describe('PublicationRuleService', () => {
  let service: PublicationRuleService;
  let store: InMemoryPublicationRuleStore;
  let ctx: TenantContext;

  beforeEach(() => {
    store = new InMemoryPublicationRuleStore();
    service = new PublicationRuleService(store);
    ctx = {
      tenantId: 'tenant-1',
      jurisdiction: {
        tenantId: 'tenant-1',
        state: 'IN',
        kind: 'township',
        name: 'Test Township',
        authorityTags: [],
      },
      userId: 'user-1',
    };
  });

  describe('seedDefaultRules', () => {
    it('should seed all Indiana publication rules', async () => {
      await service.seedDefaultRules(ctx);

      const rules = await service.getRulesForTenant(ctx);
      expect(rules.length).toBe(INDIANA_PUBLICATION_RULES.length);
    });

    it('should not duplicate rules on subsequent seed calls', async () => {
      await service.seedDefaultRules(ctx);
      await service.seedDefaultRules(ctx);

      const rules = await service.getRulesForTenant(ctx);
      expect(rules.length).toBe(INDIANA_PUBLICATION_RULES.length);
    });

    it('should create rules with correct statutory citations', async () => {
      await service.seedDefaultRules(ctx);

      const bondRule = await service.getRuleForReason(ctx, 'BOND_HEARING');
      expect(bondRule).not.toBeNull();
      expect(bondRule?.statutoryCite).toBe('IC 6-1.1-20-3.1');
    });

    it('should create consecutive publication requirement for bond hearing', async () => {
      await service.seedDefaultRules(ctx);

      const bondRule = await service.getRuleForReason(ctx, 'BOND_HEARING');
      expect(bondRule?.requiredPublications).toBe(2);
      expect(bondRule?.mustBeConsecutive).toBe(true);
    });

    it('should create annexation rule with 20-day lead time', async () => {
      await service.seedDefaultRules(ctx);

      const annexationRule = await service.getRuleForReason(
        ctx,
        'ANNEXATION_HEARING'
      );
      expect(annexationRule?.requiredLeadDays).toBe(20);
    });
  });

  describe('getRuleForReason', () => {
    beforeEach(async () => {
      await service.seedDefaultRules(ctx);
    });

    it('should return rule for valid reason', async () => {
      const rule = await service.getRuleForReason(ctx, 'VARIANCE_HEARING');
      expect(rule).not.toBeNull();
      expect(rule?.ruleType).toBe('VARIANCE_HEARING');
    });

    it('should return null for unknown reason', async () => {
      const rule = await service.getRuleForReason(
        ctx,
        'UNKNOWN_REASON' as any
      );
      expect(rule).toBeNull();
    });

    it('should return rules specific to tenant', async () => {
      const otherCtx = { ...ctx, tenantId: 'tenant-2' };

      const rule = await service.getRuleForReason(otherCtx, 'BOND_HEARING');
      expect(rule).toBeNull();
    });
  });

  describe('getRulesForTenant', () => {
    it('should return empty array for tenant with no rules', async () => {
      const rules = await service.getRulesForTenant(ctx);
      expect(rules).toEqual([]);
    });

    it('should return all rules after seeding', async () => {
      await service.seedDefaultRules(ctx);

      const rules = await service.getRulesForTenant(ctx);
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('createRule', () => {
    it('should create a custom rule', async () => {
      const rule = await service.createRule(ctx, {
        ruleType: 'GENERAL_PUBLIC_HEARING',
        requiredPublications: 3,
        requiredLeadDays: 14,
        mustBeConsecutive: false,
        requiredChannels: ['NEWSPAPER'],
        statutoryCite: 'Custom IC',
        description: 'Custom rule',
      });

      expect(rule.id).toBeDefined();
      expect(rule.requiredPublications).toBe(3);
      expect(rule.requiredLeadDays).toBe(14);
    });
  });
});

describe('Helper Functions', () => {
  describe('getDefaultIndianaRule', () => {
    it('should return rule for valid reason', () => {
      const rule = getDefaultIndianaRule('BOND_HEARING');
      expect(rule).toBeDefined();
      expect(rule?.statutoryCite).toBe('IC 6-1.1-20-3.1');
    });

    it('should return undefined for invalid reason', () => {
      const rule = getDefaultIndianaRule('INVALID' as any);
      expect(rule).toBeUndefined();
    });
  });

  describe('requiresNewspaperPublication', () => {
    it('should return true for bond hearing', () => {
      expect(requiresNewspaperPublication('BOND_HEARING')).toBe(true);
    });

    it('should return false for open door meeting', () => {
      expect(requiresNewspaperPublication('OPEN_DOOR_MEETING')).toBe(false);
    });

    it('should return true for general public hearing', () => {
      expect(requiresNewspaperPublication('GENERAL_PUBLIC_HEARING')).toBe(true);
    });
  });

  describe('getMinimumLeadDays', () => {
    it('should return 10 for bond hearing', () => {
      expect(getMinimumLeadDays('BOND_HEARING')).toBe(10);
    });

    it('should return 20 for annexation hearing', () => {
      expect(getMinimumLeadDays('ANNEXATION_HEARING')).toBe(20);
    });

    it('should return 0 for open door meeting', () => {
      expect(getMinimumLeadDays('OPEN_DOOR_MEETING')).toBe(0);
    });

    it('should return 0 for unknown reason', () => {
      expect(getMinimumLeadDays('UNKNOWN' as any)).toBe(0);
    });
  });
});
