// src/core/tenancy/types.ts

/**
 * Basic state code; we’ll start with IN but support others.
 */
export type StateCode = 'IN' | string;

/**
 * Kind of local government unit.
 */
export type LocalGovKind =
  | 'town'
  | 'city'
  | 'township'
  | 'county'
  | 'specialDistrict'
  | 'other';

/**
 * Profile describing the jurisdiction for a tenant.
 */
export interface JurisdictionProfile {
  tenantId: string;

  state: StateCode;
  kind: LocalGovKind;

  name: string;             // e.g. "Town of Lapel", "Green Township"
  population?: number;
  countyName?: string;

  formId?: string;          // e.g. "IN_TOWN", "IN_TOWNSHIP"
  authorityTags: string[];  // e.g. ['zoningAuthority', 'utilityOperator']
}

/**
 * Per-request context that all engines receive.
 */
export interface TenantContext {
  tenantId: string;
  jurisdiction: JurisdictionProfile;

  userId?: string;
  roles?: string[];
}

/**
 * A logical tenant (town, township, city, etc.).
 */
export interface Tenant {
  id: string;
  name: string;

  jurisdiction: JurisdictionProfile;

  // Enabled modules/engines, e.g. ['finance', 'apra', 'meetings'].
  modulesEnabled: string[];

  // Optional metadata for display or integrations.
  metadata?: Record<string, unknown>;
}

/**
 * Supported datastore vendors for tenant data.
 */
export type DataStoreVendor =
  | 'postgres'
  | 'sqlserver'
  | 'mysql'
  | 'sqlite'
  | 'memory'
  | 'external';

/**
 * Config for where/how a tenant's data is stored.
 * Concrete adapters will interpret this.
 */
export interface DataStoreConfig {
  vendor: DataStoreVendor;
  connectionString?: string;
  databaseName?: string;

  // Optional adapter-specific settings.
  options?: Record<string, unknown>;
}

/**
 * Combined tenant + datastore config.
 */
export interface TenantConfig {
  tenant: Tenant;
  dataStore: DataStoreConfig;
}