// src/tenants/lapel-in/finance.wiring.ts

/**
 * Finance Pack Wiring Example for Lapel
 *
 * This file demonstrates how to wire a tenant to the Indiana Finance Pack.
 * The pack "thinks" - it derives configuration from tenant identity using
 * Indiana-specific rules (LIT population thresholds, etc.).
 *
 * Key concept: The pack computes defaults, tenant provides overrides.
 */

import {
  InFinancePack,
  buildFinanceConfig,
  getLitSummary,
} from '../../states/in/finance/in-finance.pack';
import { INFinanceConfig } from '../../states/in/finance/in-finance.config';
import { lapelIdentity, lapelFinanceOverrides } from './tenant.config';

// =============================================================================
// EXAMPLE 1: Basic usage - get computed defaults
// =============================================================================

/**
 * Get the default finance config for Lapel.
 * The pack automatically determines LIT eligibility based on population.
 */
export function getLapelFinanceDefaults(): Partial<INFinanceConfig> {
  return InFinancePack.getDefaultConfig(lapelIdentity);
}

// Result:
// {
//   domain: 'finance',
//   enabled: true,
//   canLevyOwnLIT: false,     // <-- Computed: 2,350 < 3,501 threshold
//   usesCountyLIT: true,      // <-- Computed: !canLevyOwnLIT
//   fireModel: 'DEPARTMENT',
//   hasUtilityFunds: false,
//   fiscalYearType: 'calendar',
//   requiresGatewayFiling: true,
//   budgetCycle: 'annual',
//   auditThreshold: 250000,
// }

// =============================================================================
// EXAMPLE 2: Build complete config with tenant overrides
// =============================================================================

/**
 * Build Lapel's complete finance config.
 * Combines computed defaults with tenant-specific overrides.
 */
export function buildLapelFinanceConfig(): Partial<INFinanceConfig> {
  return buildFinanceConfig(lapelIdentity, lapelFinanceOverrides);
}

// Result:
// {
//   domain: 'finance',
//   enabled: true,
//   canLevyOwnLIT: false,     // <-- From pack (computed)
//   usesCountyLIT: true,      // <-- From pack (computed)
//   fireModel: 'DEPARTMENT',  // <-- From tenant override
//   hasUtilityFunds: true,    // <-- From tenant override
//   fiscalYearType: 'calendar',
//   requiresGatewayFiling: true,
//   budgetCycle: 'annual',
//   auditThreshold: 250000,
// }

// =============================================================================
// EXAMPLE 3: Get LIT summary for wizard/UI display
// =============================================================================

/**
 * Get a human-readable summary of Lapel's LIT status.
 * Useful for wizards and configuration UI.
 */
export function getLapelLitStatus() {
  return getLitSummary(lapelIdentity);
}

// Result:
// {
//   canLevyOwnLIT: false,
//   usesCountyLIT: true,
//   population: 2350,
//   threshold: 3501,
//   explanation: "Town of Lapel (pop. 2,350) must use county LIT distributions (population below 3,501 threshold)."
// }

// =============================================================================
// EXAMPLE 4: Compare with a larger municipality
// =============================================================================

import { TenantIdentity } from '../../core/state';

/**
 * Demonstrate how a larger municipality gets different defaults.
 */
export function compareLitEligibility() {
  // Lapel: population 2,350 (below threshold)
  const lapelConfig = InFinancePack.getDefaultConfig(lapelIdentity);

  // Hypothetical larger town: population 5,000 (above threshold)
  const largerTownIdentity: TenantIdentity = {
    tenantId: 'example-larger-town',
    displayName: 'Example Larger Town',
    state: 'IN',
    entityClass: 'TOWN',
    population: 5000,
  };
  const largerTownConfig = InFinancePack.getDefaultConfig(largerTownIdentity);

  return {
    lapel: {
      population: 2350,
      canLevyOwnLIT: lapelConfig.canLevyOwnLIT, // false
      usesCountyLIT: lapelConfig.usesCountyLIT, // true
    },
    largerTown: {
      population: 5000,
      canLevyOwnLIT: largerTownConfig.canLevyOwnLIT, // true
      usesCountyLIT: largerTownConfig.usesCountyLIT, // false
    },
  };
}

// =============================================================================
// EXAMPLE 5: Fire model variations
// =============================================================================

/**
 * Show how different tenants might configure fire service.
 */
export function fireModelExamples() {
  // Town with own fire department
  const ownDepartment = buildFinanceConfig(lapelIdentity, {
    fireModel: 'DEPARTMENT',
  });

  // Town in a fire territory
  const fireTerritory = buildFinanceConfig(lapelIdentity, {
    fireModel: 'TERRITORY',
    fireTerritoryId: 'madison-fire-territory-1',
  });

  // Town contracting fire service from nearby city
  const contractFire = buildFinanceConfig(lapelIdentity, {
    fireModel: 'CONTRACT',
    fireContractUnitId: 'anderson-in',
  });

  return { ownDepartment, fireTerritory, contractFire };
}

// =============================================================================
// EXPORTS for use in other modules
// =============================================================================

export const lapelFinanceConfig = buildLapelFinanceConfig();
