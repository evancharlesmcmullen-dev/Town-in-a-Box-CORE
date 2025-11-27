// src/core/state/config-resolver.ts

import { StateDomainPack, TenantIdentity } from './state.types';
import { StateTenantConfig } from './tenant-config.types';
import { getDomainPack } from './state-registry';

/**
 * Generic domain configuration resolver.
 *
 * This is the production pattern for resolving domain-specific configurations.
 * It replaces tenant-specific wiring files with a generic pipeline:
 *
 * 1. Look up the StateDomainPack for the tenant's state + domain
 * 2. Call pack.getDefaultConfig(identity) to get computed defaults
 * 3. Merge with tenant's enabledModules[].config overrides
 * 4. Return a fully typed config object
 *
 * Key design principles:
 * - Tenants never import state packs directly
 * - All state-specific logic lives in packs under src/states/**
 * - This resolver is the only code that knows about pack registration
 *
 * @example
 * ```typescript
 * import { buildDomainConfig } from '../../core/state/config-resolver';
 * import { INFinanceConfig } from '../../states/in/finance/in-finance.config';
 *
 * // Given any tenant config and identity
 * const financeConfig = buildDomainConfig<INFinanceConfig>(
 *   tenantConfig,
 *   tenantIdentity,
 *   'finance'
 * );
 * ```
 */

/**
 * Result of domain configuration resolution.
 */
export interface DomainConfigResult<TConfig = unknown> {
  /** The resolved configuration (defaults merged with overrides) */
  config: TConfig;
  /** Whether the module is enabled for this tenant */
  enabled: boolean;
  /** The state this config was resolved for */
  state: string;
  /** The domain this config was resolved for */
  domain: string;
}

/**
 * Build domain configuration for a tenant.
 *
 * This function:
 * 1. Looks up the StateDomainPack for the tenant's state + domain
 * 2. Calls pack.getDefaultConfig(identity) to derive state-specific defaults
 * 3. Merges with tenant's module config overrides
 * 4. Returns the complete typed configuration
 *
 * @param tenant - The tenant's full configuration (StateTenantConfig)
 * @param identity - The tenant's identity (TenantIdentity)
 * @param domain - The domain to resolve (e.g., 'finance', 'meetings')
 * @returns The resolved configuration, or undefined if pack not found or module disabled
 *
 * @example
 * ```typescript
 * const financeConfig = buildDomainConfig<INFinanceConfig>(
 *   tenantConfig,
 *   tenantIdentity,
 *   'finance'
 * );
 *
 * if (financeConfig) {
 *   console.log('LIT status:', financeConfig.canLevyOwnLIT);
 * }
 * ```
 */
export function buildDomainConfig<TConfig = unknown>(
  tenant: StateTenantConfig,
  identity: TenantIdentity,
  domain: string
): TConfig | undefined {
  // Look up the pack for this state + domain
  const pack = getDomainPack(identity.state, domain) as StateDomainPack<TConfig> | undefined;

  if (!pack) {
    return undefined;
  }

  // Find the module entry in tenant config
  const moduleEntry = tenant.enabledModules.find((m) => m.moduleId === domain);

  // If module not found or disabled, return undefined
  if (!moduleEntry || !moduleEntry.enabled) {
    return undefined;
  }

  // Get computed defaults from the pack
  const defaults = pack.getDefaultConfig(identity);

  // Get tenant overrides (if any)
  const overrides = (moduleEntry.config ?? {}) as Partial<TConfig>;

  // Merge: defaults from pack + overrides from tenant
  return { ...defaults, ...overrides } as TConfig;
}

/**
 * Build domain configuration with full result metadata.
 *
 * Similar to buildDomainConfig but returns additional metadata about
 * the resolution process. Useful for debugging and admin UIs.
 *
 * @param tenant - The tenant's full configuration
 * @param identity - The tenant's identity
 * @param domain - The domain to resolve
 * @returns Full result with config and metadata, or undefined if not resolvable
 */
export function buildDomainConfigWithMetadata<TConfig = unknown>(
  tenant: StateTenantConfig,
  identity: TenantIdentity,
  domain: string
): DomainConfigResult<TConfig> | undefined {
  const config = buildDomainConfig<TConfig>(tenant, identity, domain);

  if (!config) {
    return undefined;
  }

  const moduleEntry = tenant.enabledModules.find((m) => m.moduleId === domain);

  return {
    config,
    enabled: moduleEntry?.enabled ?? false,
    state: identity.state,
    domain,
  };
}

/**
 * Check if a domain is available for a tenant.
 *
 * A domain is available if:
 * 1. A pack exists for the tenant's state + domain
 * 2. The module is enabled in the tenant's configuration
 *
 * @param tenant - The tenant's configuration
 * @param identity - The tenant's identity
 * @param domain - The domain to check
 * @returns true if domain is available, false otherwise
 */
export function isDomainAvailable(
  tenant: StateTenantConfig,
  identity: TenantIdentity,
  domain: string
): boolean {
  const pack = getDomainPack(identity.state, domain);

  if (!pack) {
    return false;
  }

  const moduleEntry = tenant.enabledModules.find((m) => m.moduleId === domain);
  return moduleEntry?.enabled ?? false;
}

/**
 * Get all available domains for a tenant.
 *
 * Returns a list of domains that:
 * 1. Have registered packs for the tenant's state
 * 2. Are enabled in the tenant's configuration
 *
 * @param tenant - The tenant's configuration
 * @param identity - The tenant's identity
 * @returns Array of available domain names
 */
export function getAvailableDomains(
  tenant: StateTenantConfig,
  identity: TenantIdentity
): string[] {
  return tenant.enabledModules
    .filter((m) => m.enabled && getDomainPack(identity.state, m.moduleId))
    .map((m) => m.moduleId);
}
