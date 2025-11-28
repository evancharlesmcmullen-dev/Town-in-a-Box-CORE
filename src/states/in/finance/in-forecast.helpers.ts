// src/states/in/finance/in-forecast.helpers.ts

/**
 * Indiana-Specific Forecast Helpers
 *
 * Helper functions for building forecast scenarios that incorporate
 * Indiana-specific assumptions and requirements.
 *
 * These helpers bridge the gap between:
 * - Core forecast engine (state-agnostic)
 * - Indiana finance configuration (state-specific)
 */

import {
  SimpleForecastScenario,
  SimpleRevenueModel,
  SimpleExpenseModel,
  SimpleTimeGranularity,
  SimpleDebtInstrument,
} from '../../../core/finance/forecast/forecast.types';
import { INFinanceConfig } from './in-finance.config';

// ============================================================================
// DEFAULT INDIANA FORECAST ASSUMPTIONS
// ============================================================================

/**
 * Default economic assumptions for Indiana municipal forecasting.
 *
 * These are conservative baseline assumptions that can be overridden
 * per-tenant or per-scenario.
 */
export const IN_DEFAULT_FORECAST_ASSUMPTIONS = {
  /**
   * Default revenue growth rate (2% annually).
   * Conservative assumption based on typical LIT growth and property tax limits.
   */
  defaultRevenueGrowthRate: 0.02,

  /**
   * Default expense growth rate (2.5% annually).
   * Slightly higher than revenue to account for wage and benefit inflation.
   */
  defaultExpenseGrowthRate: 0.025,

  /**
   * LIT revenue growth rate (2% annually).
   * Tied to county-wide income growth, typically 1.5-3%.
   */
  litGrowthRate: 0.02,

  /**
   * Property tax revenue growth rate (2% annually).
   * Limited by assessed value growth and circuit breaker caps.
   */
  propertyTaxGrowthRate: 0.02,

  /**
   * Utility rate increase assumption (3% annually).
   * Utilities typically need to raise rates for infrastructure maintenance.
   */
  utilityRateGrowthRate: 0.03,

  /**
   * Personnel cost growth rate (3% annually).
   * Includes salary increases and benefit inflation.
   */
  personnelGrowthRate: 0.03,

  /**
   * General operating expense growth rate (2% annually).
   * Tied to general inflation.
   */
  operatingExpenseGrowthRate: 0.02,
} as const;

// ============================================================================
// SCENARIO BUILDERS
// ============================================================================

/**
 * Build a default baseline forecast scenario for an Indiana municipality.
 *
 * This creates a conservative scenario using default Indiana assumptions.
 * Use this as a starting point and customize as needed.
 *
 * @param config - Indiana finance configuration for the tenant
 * @param horizonYears - Number of years to project (default: 5)
 * @param options - Optional overrides for scenario parameters
 * @returns SimpleForecastScenario configured for Indiana
 *
 * @example
 * ```typescript
 * const config = buildFinanceConfig(tenantIdentity);
 * const scenario = buildDefaultInForecastScenario(config, 5);
 * const forecast = buildForecast(funds, transactions, asOf, scenario);
 * ```
 */
export function buildDefaultInForecastScenario(
  config: Partial<INFinanceConfig>,
  horizonYears: number = 5,
  options?: {
    id?: string;
    name?: string;
    description?: string;
    granularity?: SimpleTimeGranularity;
    defaultRevenueGrowthRate?: number;
    defaultExpenseGrowthRate?: number;
    revenueModels?: SimpleRevenueModel[];
    expenseModels?: SimpleExpenseModel[];
  }
): SimpleForecastScenario {
  // Adjust growth rates based on LIT configuration
  // Towns using county LIT may have slightly different growth patterns
  const revenueGrowth =
    options?.defaultRevenueGrowthRate ??
    (config.usesCountyLIT
      ? IN_DEFAULT_FORECAST_ASSUMPTIONS.litGrowthRate
      : IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultRevenueGrowthRate);

  // Adjust expense growth if utilities are involved (typically higher)
  const expenseGrowth =
    options?.defaultExpenseGrowthRate ??
    (config.hasUtilityFunds
      ? (IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultExpenseGrowthRate +
          IN_DEFAULT_FORECAST_ASSUMPTIONS.utilityRateGrowthRate) /
        2
      : IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultExpenseGrowthRate);

  return {
    id: options?.id ?? 'IN_DEFAULT_BASELINE',
    name: options?.name ?? 'Indiana Baseline Forecast',
    description:
      options?.description ??
      `${horizonYears}-year baseline forecast using default Indiana growth assumptions.`,
    horizonYears,
    granularity: options?.granularity ?? 'annual',
    defaultRevenueGrowthRate: revenueGrowth,
    defaultExpenseGrowthRate: expenseGrowth,
    revenueModels: options?.revenueModels,
    expenseModels: options?.expenseModels,
  };
}

/**
 * Build an optimistic forecast scenario for Indiana.
 *
 * Uses higher revenue growth and lower expense growth assumptions.
 * Useful for "best case" planning.
 *
 * @param config - Indiana finance configuration
 * @param horizonYears - Number of years to project
 * @returns SimpleForecastScenario with optimistic assumptions
 */
export function buildOptimisticInForecastScenario(
  config: Partial<INFinanceConfig>,
  horizonYears: number = 5
): SimpleForecastScenario {
  return buildDefaultInForecastScenario(config, horizonYears, {
    id: 'IN_OPTIMISTIC',
    name: 'Indiana Optimistic Forecast',
    description: `${horizonYears}-year optimistic forecast with higher revenue growth.`,
    defaultRevenueGrowthRate: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultRevenueGrowthRate + 0.01, // +1%
    defaultExpenseGrowthRate: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultExpenseGrowthRate - 0.005, // -0.5%
  });
}

/**
 * Build a pessimistic forecast scenario for Indiana.
 *
 * Uses lower revenue growth and higher expense growth assumptions.
 * Useful for "stress test" planning.
 *
 * @param config - Indiana finance configuration
 * @param horizonYears - Number of years to project
 * @returns SimpleForecastScenario with pessimistic assumptions
 */
export function buildPessimisticInForecastScenario(
  config: Partial<INFinanceConfig>,
  horizonYears: number = 5
): SimpleForecastScenario {
  return buildDefaultInForecastScenario(config, horizonYears, {
    id: 'IN_PESSIMISTIC',
    name: 'Indiana Pessimistic Forecast',
    description: `${horizonYears}-year pessimistic forecast with lower revenue growth.`,
    defaultRevenueGrowthRate: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultRevenueGrowthRate - 0.01, // -1%
    defaultExpenseGrowthRate: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultExpenseGrowthRate + 0.01, // +1%
  });
}

// ============================================================================
// DEBT SCENARIO BUILDERS
// ============================================================================

/**
 * Build a forecast scenario that includes debt instruments.
 *
 * Takes a base scenario and adds debt instruments for debt service modeling.
 * This is useful for projecting the impact of new bond issuances or
 * analyzing existing debt obligations.
 *
 * @param baseScenario - The base forecast scenario to extend
 * @param instruments - Debt instruments to add to the scenario
 * @returns SimpleForecastScenario with debt instruments included
 *
 * @example
 * ```typescript
 * const baseScenario = buildDefaultInForecastScenario(config, 5);
 * const waterBond: SimpleDebtInstrument = {
 *   id: 'water-bond-2020',
 *   name: '2020 Water Revenue Bonds',
 *   type: 'REVENUE',
 *   tenantId: 'town-1',
 *   fundId: 'debt-service-fund',
 *   principal: 5000000,
 *   annualInterestRate: 0.035,
 *   termYears: 20,
 *   issueYear: 2020,
 *   firstPaymentYear: 2021,
 *   amortizationType: 'LEVEL_DEBT_SERVICE',
 *   pledgedRevenueFundId: 'water-utility-fund',
 *   minCoverageRatio: 1.25,
 * };
 * const debtScenario = buildInDebtScenario(baseScenario, [waterBond]);
 * ```
 */
export function buildInDebtScenario(
  baseScenario: SimpleForecastScenario,
  instruments: SimpleDebtInstrument[]
): SimpleForecastScenario {
  return {
    ...baseScenario,
    id: `${baseScenario.id}_WITH_DEBT`,
    name: `${baseScenario.name} (with Debt Service)`,
    description: baseScenario.description
      ? `${baseScenario.description} Includes ${instruments.length} debt instrument(s).`
      : `Forecast with ${instruments.length} debt instrument(s).`,
    debtInstruments: instruments,
  };
}

/**
 * Create a sample GO (General Obligation) bond for Indiana municipalities.
 *
 * Returns a template debt instrument with typical Indiana GO bond terms.
 * Modify as needed for specific issuances.
 *
 * @param tenantId - The tenant ID
 * @param fundId - The debt service fund ID
 * @param principal - The bond principal amount
 * @param options - Optional overrides for bond terms
 * @returns SimpleDebtInstrument configured for Indiana GO bonds
 *
 * @example
 * ```typescript
 * const goBond = createIndianaGOBond('town-1', 'fund-401', 2000000, {
 *   name: '2024 Street Improvement Bonds',
 *   interestRate: 0.04,
 *   termYears: 15,
 * });
 * ```
 */
export function createIndianaGOBond(
  tenantId: string,
  fundId: string,
  principal: number,
  options?: {
    id?: string;
    name?: string;
    interestRate?: number;
    termYears?: number;
    issueYear?: number;
    firstPaymentYear?: number;
  }
): SimpleDebtInstrument {
  const currentYear = new Date().getFullYear();
  const issueYear = options?.issueYear ?? currentYear;

  return {
    id: options?.id ?? `go-bond-${issueYear}`,
    name: options?.name ?? `${issueYear} General Obligation Bonds`,
    type: 'GENERAL_OBLIGATION',
    tenantId,
    fundId,
    principal,
    annualInterestRate: options?.interestRate ?? 0.04, // 4% typical for municipal GO
    termYears: options?.termYears ?? 15,
    issueYear,
    firstPaymentYear: options?.firstPaymentYear ?? issueYear + 1,
    amortizationType: 'LEVEL_DEBT_SERVICE',
  };
}

/**
 * Create a sample Revenue bond for Indiana utilities.
 *
 * Returns a template debt instrument with typical Indiana revenue bond terms.
 * Includes pledged revenue configuration for coverage ratio tracking.
 *
 * @param tenantId - The tenant ID
 * @param debtServiceFundId - The debt service fund ID (where payments come from)
 * @param pledgedRevenueFundId - The utility fund ID (source of pledged revenue)
 * @param principal - The bond principal amount
 * @param options - Optional overrides for bond terms
 * @returns SimpleDebtInstrument configured for Indiana revenue bonds
 *
 * @example
 * ```typescript
 * const waterBond = createIndianaRevenueBond(
 *   'town-1',
 *   'fund-601',  // Debt service fund
 *   'fund-605',  // Water utility fund
 *   5000000,
 *   {
 *     name: '2024 Water System Improvements',
 *     interestRate: 0.035,
 *     minCoverageRatio: 1.25,
 *   }
 * );
 * ```
 */
export function createIndianaRevenueBond(
  tenantId: string,
  debtServiceFundId: string,
  pledgedRevenueFundId: string,
  principal: number,
  options?: {
    id?: string;
    name?: string;
    interestRate?: number;
    termYears?: number;
    issueYear?: number;
    firstPaymentYear?: number;
    minCoverageRatio?: number;
  }
): SimpleDebtInstrument {
  const currentYear = new Date().getFullYear();
  const issueYear = options?.issueYear ?? currentYear;

  return {
    id: options?.id ?? `revenue-bond-${issueYear}`,
    name: options?.name ?? `${issueYear} Revenue Bonds`,
    type: 'REVENUE',
    tenantId,
    fundId: debtServiceFundId,
    principal,
    annualInterestRate: options?.interestRate ?? 0.035, // 3.5% typical for revenue bonds
    termYears: options?.termYears ?? 20, // Longer terms typical for infrastructure
    issueYear,
    firstPaymentYear: options?.firstPaymentYear ?? issueYear + 1,
    amortizationType: 'LEVEL_DEBT_SERVICE',
    pledgedRevenueFundId,
    minCoverageRatio: options?.minCoverageRatio ?? 1.25, // 125% typical Indiana covenant
  };
}

/**
 * Create a lease-rental debt instrument for Indiana.
 *
 * Lease-rental financing is common in Indiana for buildings, equipment,
 * and other capital purchases. Typically structured as level payments.
 *
 * @param tenantId - The tenant ID
 * @param fundId - The fund making lease payments
 * @param principal - The lease principal amount
 * @param options - Optional overrides for lease terms
 * @returns SimpleDebtInstrument configured for lease-rental
 */
export function createIndianaLeaseRental(
  tenantId: string,
  fundId: string,
  principal: number,
  options?: {
    id?: string;
    name?: string;
    interestRate?: number;
    termYears?: number;
    issueYear?: number;
  }
): SimpleDebtInstrument {
  const currentYear = new Date().getFullYear();
  const issueYear = options?.issueYear ?? currentYear;

  return {
    id: options?.id ?? `lease-${issueYear}`,
    name: options?.name ?? `${issueYear} Lease-Rental Agreement`,
    type: 'LEASE_RENTAL',
    tenantId,
    fundId,
    principal,
    annualInterestRate: options?.interestRate ?? 0.045, // Slightly higher than GO
    termYears: options?.termYears ?? 10, // Typically shorter than bonds
    issueYear,
    firstPaymentYear: issueYear, // Usually starts immediately
    amortizationType: 'LEVEL_DEBT_SERVICE',
  };
}

// ============================================================================
// FUND-SPECIFIC MODEL BUILDERS
// ============================================================================

/**
 * Build revenue models for typical Indiana fund structure.
 *
 * Creates fund-specific revenue models with appropriate growth rates
 * based on fund type:
 * - General Fund: Mix of property tax and LIT
 * - Utility Funds: User fees with higher growth
 * - Special Revenue: Grant-dependent, conservative growth
 *
 * @param fundId - The fund ID
 * @param fundCategory - Fund category (general, utility, special, etc.)
 * @param baseAmount - Optional base annual revenue amount
 * @returns SimpleRevenueModel configured for the fund type
 */
export function buildInRevenueModel(
  fundId: string,
  fundCategory: 'general' | 'utility' | 'special' | 'debt-service' | 'capital' | 'other',
  baseAmount?: number
): SimpleRevenueModel {
  const growthRates: Record<string, number> = {
    general: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultRevenueGrowthRate,
    utility: IN_DEFAULT_FORECAST_ASSUMPTIONS.utilityRateGrowthRate,
    special: 0.01, // Conservative for grant-dependent funds
    'debt-service': IN_DEFAULT_FORECAST_ASSUMPTIONS.propertyTaxGrowthRate,
    capital: 0.01, // Capital funds often have one-time revenue
    other: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultRevenueGrowthRate,
  };

  return {
    fundId,
    baseAmount,
    growthRate: growthRates[fundCategory] ?? IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultRevenueGrowthRate,
    description: `${fundCategory} fund revenue model`,
  };
}

/**
 * Build expense models for typical Indiana fund structure.
 *
 * Creates fund-specific expense models with appropriate growth rates
 * based on fund type:
 * - General Fund: Personnel-heavy, higher growth
 * - Utility Funds: Infrastructure and operations, moderate growth
 * - Debt Service: Fixed payments, no growth
 *
 * @param fundId - The fund ID
 * @param fundCategory - Fund category
 * @param baseAmount - Optional base annual expense amount
 * @returns SimpleExpenseModel configured for the fund type
 */
export function buildInExpenseModel(
  fundId: string,
  fundCategory: 'general' | 'utility' | 'special' | 'debt-service' | 'capital' | 'other',
  baseAmount?: number
): SimpleExpenseModel {
  const growthRates: Record<string, number> = {
    general: IN_DEFAULT_FORECAST_ASSUMPTIONS.personnelGrowthRate, // Personnel-heavy
    utility: IN_DEFAULT_FORECAST_ASSUMPTIONS.utilityRateGrowthRate,
    special: IN_DEFAULT_FORECAST_ASSUMPTIONS.operatingExpenseGrowthRate,
    'debt-service': 0, // Fixed debt payments don't grow (amortization handles this)
    capital: 0.02, // Project costs typically inflating
    other: IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultExpenseGrowthRate,
  };

  return {
    fundId,
    baseAmount,
    growthRate: growthRates[fundCategory] ?? IN_DEFAULT_FORECAST_ASSUMPTIONS.defaultExpenseGrowthRate,
    description: `${fundCategory} fund expense model`,
  };
}

// ============================================================================
// SCENARIO VALIDATION HELPERS
// ============================================================================

/**
 * Validate a forecast scenario against Indiana-specific requirements.
 *
 * Checks for:
 * - Reasonable growth rate assumptions for Indiana
 * - Consistency with LIT/property tax constraints
 * - Utility fund compliance (if applicable)
 *
 * @param scenario - The scenario to validate
 * @param config - Indiana finance configuration
 * @returns Validation result with warnings
 */
export function validateInForecastScenario(
  scenario: SimpleForecastScenario,
  config: Partial<INFinanceConfig>
): {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check revenue growth rate
  const revenueGrowth = scenario.defaultRevenueGrowthRate ?? 0;
  if (revenueGrowth > 0.05) {
    warnings.push(
      `Revenue growth rate of ${(revenueGrowth * 100).toFixed(1)}% may be optimistic for Indiana municipalities.`
    );
    suggestions.push(
      'Consider property tax caps and LIT distribution patterns when projecting revenue.'
    );
  }
  if (revenueGrowth < 0) {
    warnings.push('Negative revenue growth rate may indicate need for additional revenue sources.');
  }

  // Check expense growth rate
  const expenseGrowth = scenario.defaultExpenseGrowthRate ?? 0;
  if (expenseGrowth < IN_DEFAULT_FORECAST_ASSUMPTIONS.personnelGrowthRate - 0.01) {
    warnings.push(
      `Expense growth rate of ${(expenseGrowth * 100).toFixed(1)}% may not account for personnel cost increases.`
    );
    suggestions.push(
      'Indiana municipalities typically see 2.5-3.5% annual personnel cost growth.'
    );
  }

  // Check horizon
  if (scenario.horizonYears > 10) {
    warnings.push(
      `${scenario.horizonYears}-year forecast has high uncertainty. Consider focusing on 5-7 year horizon.`
    );
  }

  // Config-specific checks
  if (config.hasUtilityFunds) {
    const utilityModels = scenario.expenseModels?.filter(
      (m) => m.description?.toLowerCase().includes('utility')
    );
    if (!utilityModels || utilityModels.length === 0) {
      suggestions.push(
        'Consider adding utility-specific models to account for infrastructure and rate adjustments.'
      );
    }
  }

  return {
    isValid: warnings.length === 0 || warnings.every((w) => w.includes('may be')),
    warnings,
    suggestions,
  };
}

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

/**
 * Build a set of three scenarios (baseline, optimistic, pessimistic) for comparison.
 *
 * Useful for presenting leadership with a range of outcomes.
 *
 * @param config - Indiana finance configuration
 * @param horizonYears - Number of years to project
 * @returns Object containing three scenarios
 */
export function buildInScenarioSet(
  config: Partial<INFinanceConfig>,
  horizonYears: number = 5
): {
  baseline: SimpleForecastScenario;
  optimistic: SimpleForecastScenario;
  pessimistic: SimpleForecastScenario;
} {
  return {
    baseline: buildDefaultInForecastScenario(config, horizonYears),
    optimistic: buildOptimisticInForecastScenario(config, horizonYears),
    pessimistic: buildPessimisticInForecastScenario(config, horizonYears),
  };
}
