// src/tenants/lapel-in/tenant.config.ts

import { StateTenantConfig } from '../../core/state';
import { JurisdictionProfile } from '../../core/tenancy/tenancy.types';

/**
 * Town of Lapel, Indiana - Tenant Configuration
 *
 * Example tenant configuration for an Indiana town.
 * Lapel is a town in Madison County, Indiana.
 */

const lapelJurisdiction: JurisdictionProfile = {
  tenantId: 'lapel-in',
  state: 'IN',
  kind: 'town',
  name: 'Town of Lapel',
  population: 2500, // Approximate
  countyName: 'Madison',
  formId: 'IN_TOWN',
  authorityTags: [
    'zoningAuthority',
    'utilityOperator',
    'parkAuthority',
  ],
};

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
    { moduleId: 'finance', enabled: true },
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
