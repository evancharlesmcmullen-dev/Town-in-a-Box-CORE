// src/__tests__/tenant-fixtures.ts
//
// Shared test fixtures for tenant contexts across all tests.
// Use these instead of creating local fixtures in each test file.

import { TenantContext } from '../core/tenancy/tenancy.types';
import { TenantIdentity } from '../core/state/state.types';

// =============================================================================
// TENANT IDENTITIES (for Pack testing)
// =============================================================================

/**
 * Sample Indiana Township identity.
 */
export const FALL_CREEK_TWP_IDENTITY: TenantIdentity = {
  tenantId: 'fall-creek-twp',
  displayName: 'Fall Creek Township',
  state: 'IN',
  entityClass: 'TOWNSHIP',
  population: 8500,
  countyName: 'Madison',
};

/**
 * Sample Indiana Township identity (alternate).
 */
export const STONY_CREEK_TWP_IDENTITY: TenantIdentity = {
  tenantId: 'stony-creek-twp',
  displayName: 'Stony Creek Township',
  state: 'IN',
  entityClass: 'TOWNSHIP',
  population: 4200,
  countyName: 'Madison',
};

/**
 * Sample Indiana Town identity.
 */
export const LAPEL_TOWN_IDENTITY: TenantIdentity = {
  tenantId: 'lapel-in',
  displayName: 'Town of Lapel',
  state: 'IN',
  entityClass: 'TOWN',
  population: 2350,
  countyName: 'Madison',
};

/**
 * Sample Indiana City identity.
 */
export const ANDERSON_CITY_IDENTITY: TenantIdentity = {
  tenantId: 'anderson-in',
  displayName: 'City of Anderson',
  state: 'IN',
  entityClass: 'CITY',
  population: 54500,
  countyName: 'Madison',
};

// =============================================================================
// TENANT CONTEXTS (for Engine/Service testing)
// =============================================================================

/**
 * Create a Township tenant context for testing.
 */
export function createTownshipTestContext(
  overrides?: Partial<TenantContext>
): TenantContext {
  return {
    tenantId: 'fall-creek-twp',
    userId: 'test-user',
    jurisdiction: {
      tenantId: 'fall-creek-twp',
      state: 'IN',
      kind: 'township',
      name: 'Fall Creek Township',
      population: 8500,
      countyName: 'Madison',
      authorityTags: ['fenceViewer', 'weedControl', 'poorRelief'],
    },
    ...overrides,
  };
}

/**
 * Create a Town tenant context for testing.
 */
export function createTownTestContext(
  overrides?: Partial<TenantContext>
): TenantContext {
  return {
    tenantId: 'lapel-in',
    userId: 'test-user',
    jurisdiction: {
      tenantId: 'lapel-in',
      state: 'IN',
      kind: 'town',
      name: 'Town of Lapel',
      population: 2350,
      countyName: 'Madison',
      authorityTags: ['zoningAuthority', 'utilityOperator'],
    },
    ...overrides,
  };
}

/**
 * Create a City tenant context for testing.
 */
export function createCityTestContext(
  overrides?: Partial<TenantContext>
): TenantContext {
  return {
    tenantId: 'anderson-in',
    userId: 'test-user',
    jurisdiction: {
      tenantId: 'anderson-in',
      state: 'IN',
      kind: 'city',
      name: 'City of Anderson',
      population: 54500,
      countyName: 'Madison',
      authorityTags: ['zoningAuthority', 'utilityOperator', 'annexationAuthority'],
    },
    ...overrides,
  };
}

/**
 * Create a generic test context (defaults to town).
 * Use createTownshipTestContext() or createTownTestContext() for explicit unit type.
 */
export function createTestContext(
  overrides?: Partial<TenantContext>
): TenantContext {
  return createTownTestContext(overrides);
}

// =============================================================================
// UNIT TYPE CHECK HELPERS
// =============================================================================

/**
 * Check if context is for a township tenant.
 */
export function isTownshipContext(ctx: TenantContext): boolean {
  return ctx.jurisdiction.kind === 'township';
}

/**
 * Check if context is for a town tenant.
 */
export function isTownContext(ctx: TenantContext): boolean {
  return ctx.jurisdiction.kind === 'town';
}

/**
 * Check if context is for a city tenant.
 */
export function isCityContext(ctx: TenantContext): boolean {
  return ctx.jurisdiction.kind === 'city';
}
