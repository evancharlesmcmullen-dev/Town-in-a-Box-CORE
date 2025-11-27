// src/tenants/lapel-in/tenant.config.ts

import { StateTenantConfig, TenantIdentity } from '../../core/state';
import { JurisdictionProfile } from '../../core/tenancy/tenancy.types';
import { InFinancePackOptions } from '../../states/in/finance/in-finance.pack';

/**
 * Town of Lapel, Indiana - Tenant Configuration
 *
 * Example tenant configuration for an Indiana town.
 * Lapel is a town in Madison County, Indiana.
 *
 * Population: ~2,350 (2020 Census)
 * - This means Lapel CANNOT levy its own LIT (threshold is 3,501)
 * - Lapel uses county LIT distributions from Madison County
 */

// =============================================================================
// JURISDICTION PROFILE
// =============================================================================

const lapelJurisdiction: JurisdictionProfile = {
  tenantId: 'lapel-in',
  state: 'IN',
  kind: 'town',
  name: 'Town of Lapel',
  population: 2350, // 2020 Census - IMPORTANT for LIT rules
  countyName: 'Madison',
  formId: 'IN_TOWN',
  authorityTags: [
    'zoningAuthority',
    'utilityOperator',
    'parkAuthority',
  ],
};

// =============================================================================
// TENANT IDENTITY (for use with StateDomainPacks)
// =============================================================================

/**
 * Lapel's tenant identity for use with state packs.
 * This is what gets passed to InFinancePack.getDefaultConfig().
 */
export const lapelIdentity: TenantIdentity = {
  tenantId: 'lapel-in',
  displayName: 'Town of Lapel',
  state: 'IN',
  entityClass: 'TOWN',
  population: 2350, // Critical for LIT rules
  countyName: 'Madison',
};

// =============================================================================
// FINANCE CONFIGURATION OVERRIDES
// =============================================================================

/**
 * Finance-specific overrides for Lapel.
 *
 * The InFinancePack will compute defaults based on population:
 * - canLevyOwnLIT: false (population 2,350 < 3,501 threshold)
 * - usesCountyLIT: true
 *
 * We can override other settings here as needed.
 */
export const lapelFinanceOverrides: InFinancePackOptions = {
  // Lapel operates its own fire department
  fireModel: 'DEPARTMENT',

  // Lapel has water and sewer utilities
  hasUtilityFunds: true,

  // Leave LIT settings to be computed from population by the pack
  // (no need to override canLevyOwnLIT or usesCountyLIT)
};

// =============================================================================
// FULL TENANT CONFIGURATION
// =============================================================================

export const lapelTenantConfig: StateTenantConfig = {
  tenantId: 'lapel-in',
  name: 'Town of Lapel',
  state: 'IN',
  jurisdiction: lapelJurisdiction,

  dataStore: {
    vendor: 'memory', // Use 'postgres' for production
    databaseName: 'lapel_in',
  },

  enabledModules: [
    {
      moduleId: 'finance',
      enabled: true,
      config: { ...lapelFinanceOverrides }, // Finance pack will merge with computed defaults
    },
    { moduleId: 'meetings', enabled: true },
    { moduleId: 'apra', enabled: true },
    { moduleId: 'records', enabled: true },
    { moduleId: 'planning', enabled: true },
    { moduleId: 'utilities', enabled: true },
  ],

  stateOverrides: {
    // Lapel uses calendar year (Indiana default)
    fiscalYearStart: { month: 1, day: 1 },
    timezone: 'America/Indiana/Indianapolis',
  },

  integrations: [
    {
      integrationId: 'gateway',
      enabled: true,
      endpoint: 'https://gateway.ifionline.org',
      options: {
        unitId: 'LAPEL_TOWN',
      },
    },
  ],

  contacts: [
    {
      role: 'clerk-treasurer',
      name: 'Clerk-Treasurer',
      isPrimary: true,
    },
    {
      role: 'council-president',
      name: 'Town Council President',
      isPrimary: false,
    },
  ],

  metadata: {
    established: 1876,
    incorporatedAs: 'town',
    county: 'Madison',
    region: 'Central Indiana',
  },
};

/**
 * Factory function to create Lapel tenant config.
 */
export function createLapelConfig(overrides?: Partial<StateTenantConfig>): StateTenantConfig {
  return {
    ...lapelTenantConfig,
    ...overrides,
  };
}

export default lapelTenantConfig;
