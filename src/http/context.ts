// src/http/context.ts
//
// Request context extraction for HTTP layer.
// In dev mode, reads from headers; in production, replace with real auth.

import { Request } from 'express';
import { TenantContext, JurisdictionProfile, LocalGovKind } from '../index';
import { UnitType } from '../core/state/state.types';
import { unitTypeToLocalGovKind } from '../core/state/unit-type';

/**
 * Demo tenant configurations for development.
 * In production, these would come from a database.
 */
export interface DemoTenantConfig {
  tenantId: string;
  name: string;
  state: 'IN';
  kind: LocalGovKind;
  unitType: UnitType;
  population?: number;
  countyName?: string;
  authorityTags: string[];
}

/**
 * Demo tenants for development and testing.
 * Add new tenants here to test different unit types.
 */
const DEMO_TENANTS: Record<string, DemoTenantConfig> = {
  // Example Town
  'lapel-in': {
    tenantId: 'lapel-in',
    name: 'Town of Lapel',
    state: 'IN',
    kind: 'town',
    unitType: 'TOWN',
    population: 2350,
    countyName: 'Madison',
    authorityTags: ['zoningAuthority', 'utilityOperator'],
  },
  // Example Township
  'fall-creek-twp': {
    tenantId: 'fall-creek-twp',
    name: 'Fall Creek Township',
    state: 'IN',
    kind: 'township',
    unitType: 'TOWNSHIP',
    population: 8500,
    countyName: 'Madison',
    authorityTags: ['fenceViewer', 'weedControl', 'poorRelief'],
  },
  // Example City
  'anderson-in': {
    tenantId: 'anderson-in',
    name: 'City of Anderson',
    state: 'IN',
    kind: 'city',
    unitType: 'CITY',
    population: 54500,
    countyName: 'Madison',
    authorityTags: ['zoningAuthority', 'utilityOperator', 'annexationAuthority'],
  },
  // Additional Township Example
  'stony-creek-twp': {
    tenantId: 'stony-creek-twp',
    name: 'Stony Creek Township',
    state: 'IN',
    kind: 'township',
    unitType: 'TOWNSHIP',
    population: 4200,
    countyName: 'Madison',
    authorityTags: ['fenceViewer', 'weedControl', 'poorRelief'],
  },
};

/**
 * Get the demo tenant configuration for a tenant ID.
 * Returns a default "town" config if tenant not found.
 */
export function getDemoTenant(tenantId: string): DemoTenantConfig {
  return DEMO_TENANTS[tenantId] ?? {
    tenantId,
    name: tenantId,
    state: 'IN',
    kind: 'town',
    unitType: 'TOWN',
    authorityTags: [],
  };
}

/**
 * Check if a tenant ID represents a township.
 */
export function isTenantTownship(tenantId: string): boolean {
  const tenant = getDemoTenant(tenantId);
  return tenant.unitType === 'TOWNSHIP';
}

/**
 * Check if a tenant ID represents a town.
 */
export function isTenantTown(tenantId: string): boolean {
  const tenant = getDemoTenant(tenantId);
  return tenant.unitType === 'TOWN';
}

/**
 * Check if a tenant ID represents a city.
 */
export function isTenantCity(tenantId: string): boolean {
  const tenant = getDemoTenant(tenantId);
  return tenant.unitType === 'CITY';
}

/**
 * Get the unit type for a tenant ID.
 */
export function getTenantUnitType(tenantId: string): UnitType {
  return getDemoTenant(tenantId).unitType;
}

/**
 * Build TenantContext from an HTTP request.
 *
 * For development/demo, reads tenant and user from headers:
 * - x-tenant-id: Tenant identifier (default: 'lapel-in')
 * - x-user-id: User identifier (default: 'system')
 *
 * The unit type is determined by the tenant configuration.
 * Use x-tenant-id: 'fall-creek-twp' for township endpoints.
 *
 * In production, replace this with JWT/SAML token validation
 * and real tenant/user lookup.
 */
export function buildTenantContext(req: Request): TenantContext {
  const tenantId = req.header('x-tenant-id') ?? 'lapel-in';
  const userId = req.header('x-user-id') ?? 'system';

  // Look up tenant config
  const tenantConfig = getDemoTenant(tenantId);

  const jurisdiction: JurisdictionProfile = {
    tenantId,
    state: tenantConfig.state,
    kind: tenantConfig.kind,
    name: tenantConfig.name,
    population: tenantConfig.population,
    countyName: tenantConfig.countyName,
    authorityTags: tenantConfig.authorityTags,
  };

  return { tenantId, userId, jurisdiction };
}

/**
 * Express middleware to attach TenantContext to request.
 * Access via req.ctx in route handlers.
 */
export function tenantContextMiddleware(
  req: Request & { ctx?: TenantContext },
  _res: unknown,
  next: () => void
): void {
  req.ctx = buildTenantContext(req);
  next();
}

/**
 * Get a list of all demo tenants.
 * Useful for testing and API documentation.
 */
export function getAllDemoTenants(): DemoTenantConfig[] {
  return Object.values(DEMO_TENANTS);
}

/**
 * Get demo tenants filtered by unit type.
 */
export function getDemoTenantsByUnitType(unitType: UnitType): DemoTenantConfig[] {
  return Object.values(DEMO_TENANTS).filter((t) => t.unitType === unitType);
}
