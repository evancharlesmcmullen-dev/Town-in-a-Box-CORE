// Core tenancy & jurisdiction types for Town-in-a-Box Core

export type StateCode = 'IN' | string;

export type LocalGovKind =
  | 'town'
  | 'city'
  | 'township'
  | 'county'
  | 'specialDistrict';

export interface JurisdictionProfile {
  tenantId: string;
  state: StateCode;
  kind: LocalGovKind;
  name: string;             // e.g. "Town of Lapel"
  population?: number;
  countyName?: string;
  formId?: string;          // e.g. 'IN_TOWN'
  authorityTags: string[];  // e.g. ['zoningAuthority', 'utilityOperator']
}

export interface TenantContext {
  tenantId: string;
  jurisdiction: JurisdictionProfile;
  userId?: string;
  roles?: string[];
}
// --- Expanded tenancy config ---

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
 * Config for where a tenant's data lives.
 * Implementation-specific adapters will use this.
 */
export type DataStoreVendor =
  | 'postgres'
  | 'sqlserver'
  | 'mysql'
  | 'sqlite'
  | 'memory'
  | 'external';

export interface DataStoreConfig {
  vendor: DataStoreVendor;
  connectionString?: string;
  databaseName?: string;

  // Optional config bag for adapter-specific settings.
  options?: Record<string, unknown>;
}

/**
 * High-level config tying Tenant to its datastore.
 */
export interface TenantConfig {
  tenant: Tenant;
  dataStore: DataStoreConfig;
}