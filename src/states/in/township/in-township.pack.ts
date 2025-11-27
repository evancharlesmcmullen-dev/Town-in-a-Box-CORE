// src/states/in/township/in-township.pack.ts

import { TenantIdentity, StateDomainPack } from '../../../core/state/state.types';
import {
  INTownshipConfig,
  TownshipFireModel,
  TownshipModuleId,
  DEFAULT_IN_TOWNSHIP_CONFIG,
} from './in-township.config';

/**
 * Configuration options that can be passed to the Township Pack.
 * These are combined with computed defaults from tenant identity.
 */
export interface InTownshipPackOptions {
  /** Override assistance enabled */
  assistanceEnabled?: boolean;
  /** Override fire service model */
  fireModel?: TownshipFireModel;
  /** Fire territory ID if using TERRITORY model */
  fireTerritoryId?: string;
  /** Contracting provider name if using CONTRACT model */
  fireContractProvider?: string;
  /** Override cemetery enabled */
  cemeteryEnabled?: boolean;
  /** Override fence viewer enabled */
  fenceViewerEnabled?: boolean;
  /** Override weed control enabled */
  weedControlEnabled?: boolean;
  /** Override insurance/bonds enabled */
  insuranceBondsEnabled?: boolean;
  /** Override policies enabled */
  policiesEnabled?: boolean;
  /** Explicit list of enabled modules */
  enabledModules?: TownshipModuleId[];
}

/**
 * Indiana Township Pack
 *
 * This pack "thinks" - it derives configuration from tenant identity
 * using Indiana-specific rules for townships.
 *
 * Key features:
 * - Automatically enables township-specific engines (assistance, fence viewer, etc.)
 * - Provides statutory defaults (72-hour investigation, 10-day appeal)
 * - Configures governance model (trustee as fiscal officer, board approves claims)
 * - All Indiana township-specific logic lives here
 *
 * Usage:
 *   const defaults = InTownshipPack.getDefaultConfig(tenantIdentity);
 *   const config = { ...defaults, ...tenantOverrides };
 *
 * Note: This pack is only applicable when entityClass === 'TOWNSHIP'.
 */
export const InTownshipPack: StateDomainPack<Partial<INTownshipConfig>> = {
  state: 'IN',
  domain: 'township',

  /**
   * Generate default township configuration based on tenant identity.
   *
   * This is where Indiana township-specific logic lives:
   * - All townships provide poor relief (IC 12-20)
   * - All township trustees serve as fence viewers (IC 32-26)
   * - Township trustee is the fiscal officer
   * - Township board approves claims
   *
   * @param identity - Tenant identity with entity class, population, etc.
   * @returns Partial config with computed and default values
   */
  getDefaultConfig(identity: TenantIdentity): Partial<INTownshipConfig> {
    // This pack only applies to townships
    if (identity.entityClass !== 'TOWNSHIP') {
      return {
        domain: 'township',
        enabled: false,
        enabledModules: [],
      };
    }

    // Start with statutory defaults
    const config: Partial<INTownshipConfig> = {
      domain: 'township',
      enabled: true,

      // Assistance - mandatory duty for Indiana townships
      assistanceEnabled: true,
      assistanceInvestigationDays: 3,  // 72 hours per IC 12-20-6-8.5
      assistanceCasesConfidential: true,

      // Fire - most townships contract, but this can vary
      fireModel: 'CONTRACT',

      // Cemetery - common but not universal
      cemeteryEnabled: true,

      // Fence viewer - statutory duty
      fenceViewerEnabled: true,
      fenceViewerAppealDays: 10,

      // Weed control - statutory authority
      weedControlEnabled: true,
      weedControlNoticeDays: 10,

      // Insurance & bonds - statutory requirement
      insuranceBondsEnabled: true,
      trusteeBondRequired: true,
      clerkBondRequired: true,

      // Policies - important for compliance
      policiesEnabled: true,

      // Governance - statutory structure
      trusteeIsFiscalOfficer: true,
      boardApprovesClaims: true,
      boardMemberCount: 3,

      // Enable all township modules
      enabledModules: [
        'township-assistance',
        'fire-contracts',
        'cemeteries',
        'insurance-bonds',
        'fence-viewer',
        'weed-control',
        'policies',
      ],
    };

    return config;
  },
};

/**
 * Helper function to build a complete township config for a tenant.
 *
 * This combines:
 * 1. Computed defaults from InTownshipPack.getDefaultConfig()
 * 2. Tenant-specific overrides
 *
 * @param identity - Tenant identity
 * @param overrides - Tenant-specific configuration overrides
 * @returns Complete INTownshipConfig (partial)
 *
 * @example
 * ```typescript
 * import { buildTownshipConfig } from './in-township.pack';
 *
 * const config = buildTownshipConfig(
 *   { tenantId: 'fall-creek-twp', displayName: 'Fall Creek Township', state: 'IN', entityClass: 'TOWNSHIP' },
 *   { fireModel: 'TERRITORY', fireTerritoryId: 'fall-creek-fire-territory' }
 * );
 *
 * // config.assistanceEnabled === true (statutory default)
 * // config.fireModel === 'TERRITORY' (overridden)
 * // config.fenceViewerEnabled === true (statutory duty)
 * ```
 */
export function buildTownshipConfig(
  identity: TenantIdentity,
  overrides?: InTownshipPackOptions
): Partial<INTownshipConfig> {
  const defaults = InTownshipPack.getDefaultConfig(identity);

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Check if a tenant identity represents a township.
 *
 * @param identity - Tenant identity
 * @returns True if the tenant is a township
 */
export function isTownship(identity: TenantIdentity): boolean {
  return identity.entityClass === 'TOWNSHIP';
}

/**
 * Get a summary of township duties for a tenant.
 * Useful for onboarding wizards and UI display.
 *
 * @param identity - Tenant identity
 * @returns Summary of township statutory duties
 */
export function getTownshipDutiesSummary(identity: TenantIdentity): {
  isTownship: boolean;
  statutoryDuties: string[];
  explanation: string;
} {
  if (identity.entityClass !== 'TOWNSHIP') {
    return {
      isTownship: false,
      statutoryDuties: [],
      explanation: `${identity.displayName} is not a township.`,
    };
  }

  const statutoryDuties = [
    'Provide township assistance (poor relief) per IC 12-20',
    'Serve as fence viewer per IC 32-26',
    'Enforce weed control per IC 15-16-8',
    'Maintain township cemeteries per IC 23-14-68',
    'Provide fire protection services',
    'Post trustee and clerk bonds per IC 5-4-1',
    'Conduct open board meetings per IC 5-14-1.5',
    'Respond to public records requests per IC 5-14-3',
    'Maintain SBOA-compliant financial records',
  ];

  return {
    isTownship: true,
    statutoryDuties,
    explanation:
      `${identity.displayName} is an Indiana township with the following statutory duties and powers.`,
  };
}

/**
 * Get the list of engines/modules a township tenant should have enabled.
 *
 * @param identity - Tenant identity
 * @param overrides - Optional overrides for specific modules
 * @returns Array of module IDs that should be enabled
 */
export function getTownshipEnabledModules(
  identity: TenantIdentity,
  overrides?: { disabledModules?: TownshipModuleId[] }
): TownshipModuleId[] {
  if (identity.entityClass !== 'TOWNSHIP') {
    return [];
  }

  const allModules: TownshipModuleId[] = [
    'township-assistance',
    'fire-contracts',
    'cemeteries',
    'insurance-bonds',
    'fence-viewer',
    'weed-control',
    'policies',
  ];

  if (overrides?.disabledModules) {
    return allModules.filter((m) => !overrides.disabledModules!.includes(m));
  }

  return allModules;
}

// Re-export config types and defaults
export { INTownshipConfig, TownshipFireModel, TownshipModuleId, DEFAULT_IN_TOWNSHIP_CONFIG };
