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

// Import state packs to ensure they're registered
// These imports have side effects: they call registerDomainPack()
// In production, you'd have a bootstrap file that imports all state packs
import '../../states/in/finance';
import '../../states/in/meetings';
import '../../states/in/apra';

// Re-export for convenience (optional - types only)
import type { INFinanceConfig } from '../../states/in/finance/in-finance.config';
import type { INMeetingsConfig } from '../../states/in/meetings/in-meetings.config';
import type { INApraConfig } from '../../states/in/apra/in-apra.config';

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
 * Example: Get meetings configuration for any Indiana tenant.
 *
 * This function demonstrates the generic pattern for the meetings domain.
 * The tenant's identity determines the computed defaults (governing body types,
 * notice channels, etc. based on entity class and population).
 *
 * @param tenantConfig - The tenant's full configuration (StateTenantConfig)
 * @param tenantIdentity - The tenant's identity (TenantIdentity)
 * @returns The resolved meetings config, or undefined if not available
 *
 * @example
 * ```typescript
 * // For any Indiana tenant:
 * const meetingsConfig = getMeetingsConfig(someTenantConfig, someTenantIdentity);
 *
 * if (meetingsConfig) {
 *   // Config is computed based on tenant's identity (entity class, population, etc.)
 *   console.log('Notice hours:', meetingsConfig.regularMeetingNoticeHours);
 *   console.log('Governing bodies:', meetingsConfig.governingBodyTypes);
 *   console.log('Requires minutes:', meetingsConfig.requiresMinutes);
 * }
 * ```
 */
export function getMeetingsConfig(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
): INMeetingsConfig | undefined {
  // Use the generic resolver - it finds the right pack based on state + domain
  return buildDomainConfig<INMeetingsConfig>(tenantConfig, tenantIdentity, 'meetings');
}

/**
 * Example: Get meetings configuration with metadata.
 *
 * Returns additional metadata about the resolution process.
 * Useful for debugging and admin UIs.
 */
export function getMeetingsConfigWithMetadata(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
) {
  return buildDomainConfigWithMetadata<INMeetingsConfig>(
    tenantConfig,
    tenantIdentity,
    'meetings'
  );
}

/**
 * Get APRA (Access to Public Records Act) configuration for any Indiana tenant.
 *
 * This function demonstrates the generic pattern for the APRA domain.
 * The tenant's identity determines the computed defaults (delivery methods,
 * retention periods, etc. based on entity class and population).
 *
 * @param tenantConfig - The tenant's full configuration (StateTenantConfig)
 * @param tenantIdentity - The tenant's identity (TenantIdentity)
 * @returns The resolved APRA config, or undefined if not available
 *
 * @example
 * ```typescript
 * // For any Indiana tenant:
 * const apraConfig = getApraConfig(someTenantConfig, someTenantIdentity);
 *
 * if (apraConfig) {
 *   // Config is computed based on tenant's identity (entity class, population, etc.)
 *   console.log('Response days:', apraConfig.standardResponseDays);
 *   console.log('Delivery methods:', apraConfig.allowedDeliveryMethods);
 *   console.log('Copy fee:', apraConfig.defaultPerPageFee);
 * }
 * ```
 */
export function getApraConfig(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
): INApraConfig | undefined {
  // Use the generic resolver - it finds the right pack based on state + domain
  return buildDomainConfig<INApraConfig>(tenantConfig, tenantIdentity, 'apra');
}

/**
 * Get APRA configuration with metadata.
 *
 * Returns additional metadata about the resolution process.
 * Useful for debugging and admin UIs.
 */
export function getApraConfigWithMetadata(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity
) {
  return buildDomainConfigWithMetadata<INApraConfig>(
    tenantConfig,
    tenantIdentity,
    'apra'
  );
}

/**
 * Example: Get any domain configuration for a tenant.
 *
 * This is the most generic pattern - works with any domain.
 *
 * @param tenantConfig - The tenant's full configuration
 * @param tenantIdentity - The tenant's identity
 * @param domain - The domain to resolve (e.g., 'finance', 'meetings', 'apra')
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
// GATEWAY FUND SUMMARY EXPORTS
// =============================================================================

// Import Gateway types and functions
import { FinanceRepository } from '../finance/finance.repository';
import { GatewayFundSummaryExport } from '../finance/gateway/gateway.types';
import { buildInGatewayFundSummaryExport } from '../../states/in/finance/gateway/in-fund-summary.gateway';

/**
 * Get Gateway Fund Summary for a tenant.
 *
 * This function routes to the appropriate state-specific Gateway export
 * based on the tenant's state. Currently supports Indiana (IN).
 *
 * @param repo - Finance repository for data access
 * @param tenantConfig - The tenant's full configuration
 * @param tenantIdentity - The tenant's identity
 * @param asOf - The "as of" date for the report
 * @returns Promise resolving to the Gateway export, or undefined if state not supported
 *
 * @example
 * ```typescript
 * const repo = new InMemoryFinanceRepository(seedData);
 * const export = await getGatewayFundSummaryForTenant(
 *   repo,
 *   tenantConfig,
 *   tenantIdentity,
 *   new Date('2024-12-31')
 * );
 *
 * if (export) {
 *   console.log('Total funds:', export.rows.length);
 *   console.log('Total ending balance:', export.totalEndingBalance);
 * }
 * ```
 */
export async function getGatewayFundSummaryForTenant(
  repo: FinanceRepository,
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  asOf: Date
): Promise<GatewayFundSummaryExport | undefined> {
  // Check if finance module is enabled
  if (!isDomainAvailable(tenantConfig, tenantIdentity, 'finance')) {
    return undefined;
  }

  // Route to state-specific implementation
  switch (tenantIdentity.state) {
    case 'IN':
      // Indiana - use the Indiana-specific Gateway export
      const result = await buildInGatewayFundSummaryExport(
        repo,
        tenantIdentity,
        asOf,
        { validate: false }
      );
      return result.export;

    default:
      // State not yet supported for Gateway exports
      // Future: Add other states as they're implemented
      return undefined;
  }
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

/**
 * Example showing how any tenant's meetings config is resolved:
 *
 * ```typescript
 * import { StateTenantConfig, TenantIdentity } from '../state';
 * import { getMeetingsConfig } from './domain-config.service';
 *
 * // Any Indiana tenant (small town example)
 * const townIdentity: TenantIdentity = {
 *   tenantId: 'example-town',
 *   displayName: 'Example Town',
 *   state: 'IN',
 *   entityClass: 'TOWN',
 *   population: 2350,
 *   countyName: 'Example County',
 * };
 *
 * const townConfig: StateTenantConfig = {
 *   tenantId: 'example-town',
 *   name: 'Example Town',
 *   state: 'IN',
 *   jurisdiction: { ... },
 *   dataStore: { vendor: 'memory', databaseName: 'example_town' },
 *   enabledModules: [
 *     { moduleId: 'meetings', enabled: true, config: { defaultRegularMeetingDay: 2 } },
 *   ],
 * };
 *
 * const meetingsConfig = getMeetingsConfig(townConfig, townIdentity);
 *
 * // Result:
 * // {
 * //   domain: 'meetings',
 * //   enabled: true,
 * //   regularMeetingNoticeHours: 48,           // <-- Indiana Open Door baseline
 * //   specialMeetingNoticeHours: 48,
 * //   emergencyMeetingNoticeHours: 0,          // <-- Emergency has no advance notice
 * //   governingBodyTypes: ['COUNCIL', 'BOARD', 'PLAN_COMMISSION'],  // <-- Computed for TOWN
 * //   requiresAgendaPosting: true,
 * //   requiresMinutes: true,
 * //   noticeChannels: ['website', 'physicalPosting'],  // <-- Smaller town, no newspaper
 * //   defaultRegularMeetingDay: 2,              // <-- From tenant override (Tuesday)
 * //   minutesRetentionYears: 10,
 * //   ...
 * // }
 *
 * // A city (entityClass: 'CITY') would get different computed values:
 * const cityIdentity: TenantIdentity = {
 *   ...townIdentity,
 *   tenantId: 'example-city',
 *   displayName: 'Example City',
 *   entityClass: 'CITY',
 *   population: 15000,
 * };
 *
 * const cityConfig = getMeetingsConfig(cityTenantConfig, cityIdentity);
 * // cityConfig.governingBodyTypes includes BZA, REDEVELOPMENT, PARKS_BOARD
 * // cityConfig.noticeChannels includes 'newspaper' (larger entity)
 * ```
 */

/**
 * Example showing how any tenant's APRA config is resolved:
 *
 * ```typescript
 * import { StateTenantConfig, TenantIdentity } from '../state';
 * import { getApraConfig } from './domain-config.service';
 *
 * // Any Indiana tenant (small town example)
 * const townIdentity: TenantIdentity = {
 *   tenantId: 'example-town',
 *   displayName: 'Example Town',
 *   state: 'IN',
 *   entityClass: 'TOWN',
 *   population: 2350,
 *   countyName: 'Example County',
 * };
 *
 * const townConfig: StateTenantConfig = {
 *   tenantId: 'example-town',
 *   name: 'Example Town',
 *   state: 'IN',
 *   jurisdiction: { ... },
 *   dataStore: { vendor: 'memory', databaseName: 'example_town' },
 *   enabledModules: [
 *     { moduleId: 'apra', enabled: true, config: { maxSearchTimeWithoutChargeMinutes: 60 } },
 *   ],
 * };
 *
 * const apraConfig = getApraConfig(townConfig, townIdentity);
 *
 * // Result:
 * // {
 * //   domain: 'apra',
 * //   enabled: true,
 * //   standardResponseDays: 7,                 // <-- IC 5-14-3-9 baseline
 * //   businessDaysOnly: true,
 * //   allowCopyFees: true,
 * //   defaultPerPageFee: 0.10,                 // <-- Reasonable fee per IC 5-14-3-8
 * //   allowedDeliveryMethods: ['email', 'postal', 'inPerson'],  // <-- Smaller town, no portal
 * //   maxSearchTimeWithoutChargeMinutes: 60,   // <-- From tenant override
 * //   logRequests: true,
 * //   requestLogRetentionYears: 2,             // <-- Smaller entity retention
 * //   ...
 * // }
 *
 * // A city (entityClass: 'CITY') would get different computed values:
 * const cityIdentity: TenantIdentity = {
 *   ...townIdentity,
 *   tenantId: 'example-city',
 *   displayName: 'Example City',
 *   entityClass: 'CITY',
 *   population: 15000,
 * };
 *
 * const cityConfig = getApraConfig(cityTenantConfig, cityIdentity);
 * // cityConfig.allowedDeliveryMethods includes 'portal' (larger entity)
 * // cityConfig.requestLogRetentionYears === 3 (longer retention for larger entity)
 * ```
 */
