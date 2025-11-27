// src/core/tenancy/domain-config.service.ts

/**
 * Domain Configuration Service
 *
 * This service demonstrates the production pattern for resolving domain-specific
 * configurations for any tenant. It uses the generic config resolver pipeline:
 *
 * 1. Given a StateTenantConfig and TenantIdentity
 * 2. Look up the StateDomainPack for the tenant's state + domain
 * 3. Call pack.getDefaultConfig(identity) to compute state-specific defaults
 * 4. Merge with tenant's enabledModules[].config overrides
 * 5. Return the fully typed configuration
 *
 * Key design principle: Tenants never import state packs directly.
 * All state-specific logic lives in packs under src/states/**.
 * Only this resolver layer knows about pack registration.
 */

import {
  buildDomainConfig,
  buildDomainConfigWithMetadata,
  getAvailableDomains,
  isDomainAvailable,
  StateTenantConfig,
  TenantIdentity,
} from '../state';

// Import the Indiana finance pack to ensure it's registered
// This import has a side effect: it calls registerDomainPack(InFinancePack)
// In production, you'd have a bootstrap file that imports all state packs
import '../../states/in/finance';

// Re-export for convenience (optional - types only)
import type { INFinanceConfig } from '../../states/in/finance/in-finance.config';

/**
 * Example: Get finance configuration for any Indiana tenant.
 *
 * This function demonstrates the generic pattern - it works with ANY tenant,
 * not just a specific one. The tenant's identity determines the computed defaults.
 *
 * @param tenantConfig - The tenant's full configuration (StateTenantConfig)
 * @param tenantIdentity - The tenant's identity (TenantIdentity)
 * @returns The resolved finance config, or undefined if not available
 *
 * @example
 * ```typescript
 * // For any Indiana tenant:
 * const financeConfig = getFinanceConfig(someTenantConfig, someTenantIdentity);
 *
 * if (financeConfig) {
 *   // Config is computed based on tenant's identity (population, entity class, etc.)
 *   console.log('Can levy own LIT:', financeConfig.canLevyOwnLIT);
 *   console.log('Uses county LIT:', financeConfig.usesCountyLIT);
 *   console.log('Fire model:', financeConfig.fireModel);
 * }
 * ```
 */
export function getFinanceConfig(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
): INFinanceConfig | undefined {
  // Use the generic resolver - it finds the right pack based on state + domain
  return buildDomainConfig<INFinanceConfig>(tenantConfig, tenantIdentity, 'finance');
}

/**
 * Example: Get finance configuration with metadata.
 *
 * Returns additional metadata about the resolution process.
 * Useful for debugging and admin UIs.
 */
export function getFinanceConfigWithMetadata(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
) {
  return buildDomainConfigWithMetadata<INFinanceConfig>(
    tenantConfig,
    tenantIdentity,
    'finance'
  );
}

/**
 * Example: Get any domain configuration for a tenant.
 *
 * This is the most generic pattern - works with any domain.
 *
 * @param tenantConfig - The tenant's full configuration
 * @param tenantIdentity - The tenant's identity
 * @param domain - The domain to resolve (e.g., 'finance', 'meetings')
 * @returns The resolved config, or undefined if not available
 */
export function getDomainConfig<TConfig = unknown>(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  domain: string
): TConfig | undefined {
  return buildDomainConfig<TConfig>(tenantConfig, tenantIdentity, domain);
}

/**
 * Example: List all available domains for a tenant.
 *
 * Returns domains that are both:
 * 1. Enabled in the tenant's configuration
 * 2. Have registered packs for the tenant's state
 */
export function listAvailableDomains(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
): string[] {
  return getAvailableDomains(tenantConfig, tenantIdentity);
}

/**
 * Example: Check if a domain is available for a tenant.
 */
export function checkDomainAvailable(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  domain: string
): boolean {
  return isDomainAvailable(tenantConfig, tenantIdentity, domain);
}

// =============================================================================
// Usage Example (for documentation purposes)
// =============================================================================

/**
 * Example showing how any tenant's finance config is resolved:
 *
 * ```typescript
 * import { StateTenantConfig, TenantIdentity } from '../state';
 * import { getFinanceConfig } from './domain-config.service';
 *
 * // Any Indiana tenant (small town example - population 2,350)
 * const smallTownIdentity: TenantIdentity = {
 *   tenantId: 'example-town',
 *   displayName: 'Example Small Town',
 *   state: 'IN',
 *   entityClass: 'TOWN',
 *   population: 2350,
 *   countyName: 'Example County',
 * };
 *
 * const smallTownConfig: StateTenantConfig = {
 *   tenantId: 'example-town',
 *   name: 'Example Small Town',
 *   state: 'IN',
 *   jurisdiction: { ... },
 *   dataStore: { vendor: 'memory', databaseName: 'example_town' },
 *   enabledModules: [
 *     { moduleId: 'finance', enabled: true, config: { fireModel: 'DEPARTMENT' } },
 *   ],
 * };
 *
 * const financeConfig = getFinanceConfig(smallTownConfig, smallTownIdentity);
 *
 * // Result:
 * // {
 * //   domain: 'finance',
 * //   enabled: true,
 * //   canLevyOwnLIT: false,     // <-- Computed: 2,350 < 3,501 threshold
 * //   usesCountyLIT: true,      // <-- Computed: !canLevyOwnLIT
 * //   fireModel: 'DEPARTMENT',  // <-- From tenant override
 * //   hasUtilityFunds: false,   // <-- Default from pack
 * //   fiscalYearType: 'calendar',
 * //   requiresGatewayFiling: true,
 * //   budgetCycle: 'annual',
 * //   auditThreshold: 250000,
 * // }
 *
 * // A larger town (population 5,000) would get different computed values:
 * const largerTownIdentity: TenantIdentity = {
 *   ...smallTownIdentity,
 *   tenantId: 'larger-town',
 *   displayName: 'Example Larger Town',
 *   population: 5000,
 * };
 *
 * const largerConfig = getFinanceConfig(largerTownConfig, largerTownIdentity);
 * // largerConfig.canLevyOwnLIT === true  (population >= 3,501)
 * // largerConfig.usesCountyLIT === false
 * ```
 */
