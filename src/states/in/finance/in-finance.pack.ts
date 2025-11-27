// src/states/in/finance/in-finance.pack.ts

import { TenantIdentity, StateDomainPack } from '../../../core/state/state.types';
import { INFinanceConfig, FireServiceModel } from './in-finance.config';
import { InLitRules } from './in-lit-rules.config';

/**
 * Configuration options that can be passed to the Indiana Finance Pack.
 * These are combined with computed defaults from tenant identity.
 */
export interface InFinancePackOptions {
  /** Override the computed canLevyOwnLIT value */
  canLevyOwnLIT?: boolean;
  /** Override the computed usesCountyLIT value */
  usesCountyLIT?: boolean;
  /** Fire service delivery model */
  fireModel?: FireServiceModel;
  /** Fire territory ID if using TERRITORY model */
  fireTerritoryId?: string;
  /** Contracting unit ID if using CONTRACT model */
  fireContractUnitId?: string;
  /** Whether municipality has utility enterprise funds */
  hasUtilityFunds?: boolean;
  /** Override fiscal year type */
  fiscalYearType?: 'calendar' | 'fiscal-july';
  /** Override Gateway filing requirement */
  requiresGatewayFiling?: boolean;
  /** Override budget cycle */
  budgetCycle?: 'annual' | 'biennial';
  /** Override audit threshold */
  auditThreshold?: number;
}

/**
 * Indiana Finance Pack
 *
 * This pack "thinks" - it derives configuration from tenant identity
 * using Indiana-specific rules (LIT population thresholds, fire models, etc.).
 *
 * Key features:
 * - Automatically determines LIT eligibility based on population (< 3,501 uses county LIT)
 * - Provides sensible defaults for fire service model
 * - All Indiana-specific finance logic lives here, not scattered across the codebase
 *
 * Usage:
 *   const defaults = InFinancePack.getDefaultConfig(tenantIdentity);
 *   const config = { ...defaults, ...tenantOverrides };
 */
export const InFinancePack: StateDomainPack<Partial<INFinanceConfig>> = {
  state: 'IN',
  domain: 'finance',

  /**
   * Generate default finance configuration based on tenant identity.
   *
   * This is where Indiana-specific logic lives:
   * - Population < 3,501: Cannot levy own LIT, uses county LIT distributions
   * - Population >= 3,501: Can levy own LIT
   * - Fire model defaults to DEPARTMENT (most common for small towns)
   *
   * @param identity - Tenant identity with population, entity class, etc.
   * @returns Partial config with computed and default values
   */
  getDefaultConfig(identity: TenantIdentity): Partial<INFinanceConfig> {
    const population = identity.population ?? 0;

    // Apply LIT rules based on population
    const canLevyOwnLIT = InLitRules.canLevyOwnLIT(population);

    return {
      domain: 'finance',
      enabled: true,

      // LIT configuration derived from population
      canLevyOwnLIT,
      usesCountyLIT: !canLevyOwnLIT,

      // Fire service defaults - tenant can override
      // DEPARTMENT is most common for small Indiana towns
      fireModel: 'DEPARTMENT',

      // Utility funds - default to false, tenant enables as needed
      hasUtilityFunds: false,

      // Standard Indiana defaults
      fiscalYearType: 'calendar',
      requiresGatewayFiling: true,
      budgetCycle: 'annual',
      auditThreshold: 250000,
    };
  },
};

/**
 * Helper function to build a complete finance config for a tenant.
 *
 * This combines:
 * 1. Computed defaults from InFinancePack.getDefaultConfig()
 * 2. Tenant-specific overrides
 *
 * @param identity - Tenant identity
 * @param overrides - Tenant-specific configuration overrides
 * @returns Complete INFinanceConfig
 *
 * @example
 * ```typescript
 * import { buildFinanceConfig } from './in-finance.pack';
 *
 * const config = buildFinanceConfig(
 *   { tenantId: 'example-town', displayName: 'Example Town', state: 'IN', entityClass: 'TOWN', population: 2350 },
 *   { fireModel: 'TERRITORY', hasUtilityFunds: true }
 * );
 *
 * // config.canLevyOwnLIT === false (population < 3501)
 * // config.usesCountyLIT === true
 * // config.fireModel === 'TERRITORY' (overridden)
 * ```
 */
export function buildFinanceConfig(
  identity: TenantIdentity,
  overrides?: InFinancePackOptions
): Partial<INFinanceConfig> {
  const defaults = InFinancePack.getDefaultConfig(identity);

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get a summary of LIT status for a tenant.
 * Useful for wizards and UI display.
 */
export function getLitSummary(identity: TenantIdentity): {
  canLevyOwnLIT: boolean;
  usesCountyLIT: boolean;
  population: number;
  threshold: number;
  explanation: string;
} {
  const population = identity.population ?? 0;
  const canLevyOwnLIT = InLitRules.canLevyOwnLIT(population);
  const threshold = InLitRules.getLitPopulationThreshold();

  return {
    canLevyOwnLIT,
    usesCountyLIT: !canLevyOwnLIT,
    population,
    threshold,
    explanation: canLevyOwnLIT
      ? `${identity.displayName} (pop. ${population.toLocaleString()}) may levy its own Local Income Tax.`
      : `${identity.displayName} (pop. ${population.toLocaleString()}) must use county LIT distributions (population below ${threshold.toLocaleString()} threshold).`,
  };
}

// Re-export the rules for direct access if needed
export { InLitRules } from './in-lit-rules.config';
