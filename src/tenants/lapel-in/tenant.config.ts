// src/tenants/lapel-in/tenant.config.ts

import { StateTenantConfig, TenantIdentity } from '../../core/state';
import { JurisdictionProfile } from '../../core/tenancy/tenancy.types';

/**
 * Town of Lapel, Indiana - Tenant Configuration
 *
 * Example tenant configuration for an Indiana town.
 * Lapel is a town in Madison County, Indiana.
 *
 * Population: ~2,350 (2020 Census)
 * - This means Lapel CANNOT levy its own LIT (threshold is 3,501)
 * - Lapel uses county LIT distributions from Madison County
 *
 * NOTE: This file only contains static configuration data.
 * All state-specific logic (LIT rules, fire model defaults, etc.) is handled
 * by the generic config resolver using the registered Indiana Finance Pack.
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
// TENANT IDENTITY (for use with config resolver)
// =============================================================================

/**
 * Lapel's tenant identity for use with state domain packs.
 * This is passed to buildDomainConfig() which calls the appropriate pack.
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
 * These are plain data overrides that will be merged with computed defaults
 * by the generic config resolver. The resolver will:
 * 1. Look up the finance pack for Indiana (state: 'IN', domain: 'finance')
 * 2. Call pack.getDefaultConfig(identity) to compute LIT eligibility
 * 3. Merge these overrides on top of the computed defaults
 *
 * NOTE: This is a plain data object with no type dependency on state packs.
 * The types are kept generic to ensure tenants don't import from src/states/**.
 */
export const lapelFinanceOverrides: Record<string, unknown> = {
  // Lapel operates its own fire department
  fireModel: 'DEPARTMENT',

  // Lapel has water and sewer utilities
  hasUtilityFunds: true,

  // LIT settings are computed automatically from population by the pack:
  // - canLevyOwnLIT: false (population 2,350 < 3,501 threshold)
  // - usesCountyLIT: true
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
