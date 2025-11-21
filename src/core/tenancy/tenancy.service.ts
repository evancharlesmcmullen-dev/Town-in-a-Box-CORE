// src/core/tenancy/tenancy.service.ts

import {
  Tenant,
  TenantConfig,
} from './tenancy.types';

/**
 * Service interface for resolving tenant configuration and metadata.
 *
 * TenancyService is responsible for:
 * - Knowing which tenants exist,
 * - Providing their TenantConfig (modules enabled, datastore config),
 * - Optionally, simple lookup helpers.
 *
 * It does NOT represent a per-request context – that's TenantContext.
 */
export interface TenancyService {
  /**
   * Return the TenantConfig for a given tenant id, or null if unknown.
   */
  getTenantConfig(tenantId: string): Promise<TenantConfig | null>;

  /**
   * List all known tenants.
   */
  listTenants(): Promise<Tenant[]>;

  /**
   * Optional helper to look up a tenant by name (for admin tooling).
   */
  findTenantByName(name: string): Promise<Tenant | null>;
}