// src/states/in/finance/in-finance.config.ts

import { DomainConfig } from '../../../core/state';

/**
 * Fire service delivery model for Indiana municipalities.
 * This affects fund structure, levies, and budget requirements.
 */
export type FireServiceModel = 'TERRITORY' | 'DEPARTMENT' | 'CONTRACT';

/**
 * Indiana Finance Configuration
 *
 * Configuration options specific to Indiana municipal finance.
 * This config is derived from tenant identity + state rules via InFinancePack.
 */
export interface INFinanceConfig extends DomainConfig {
  domain: 'finance';

  // ==========================================================================
  // LIT (Local Income Tax) Configuration - derived from population rules
  // ==========================================================================

  /**
   * Whether this municipality can levy its own LIT.
   * Derived from population >= 3,501 per IC 6-3.6.
   */
  canLevyOwnLIT?: boolean;

  /**
   * Whether this municipality uses county LIT distributions.
   * True if canLevyOwnLIT is false (population < 3,501).
   */
  usesCountyLIT?: boolean;

  // ==========================================================================
  // Fire Service Configuration
  // ==========================================================================

  /**
   * How fire service is provided:
   * - TERRITORY: Part of a fire territory (multiple units share costs)
   * - DEPARTMENT: Municipality operates its own fire department
   * - CONTRACT: Contracts with another unit for fire service
   */
  fireModel?: FireServiceModel;

  /**
   * If fireModel is TERRITORY, the territory ID.
   */
  fireTerritoryId?: string;

  /**
   * If fireModel is CONTRACT, the contracting unit ID.
   */
  fireContractUnitId?: string;

  // ==========================================================================
  // Utility Funds Configuration
  // ==========================================================================

  /**
   * Whether this municipality has utility enterprise funds.
   * Affects fund structure and reporting requirements.
   */
  hasUtilityFunds?: boolean;

  // ==========================================================================
  // Standard Indiana Finance Settings
  // ==========================================================================

  // Fiscal year type (Indiana uses calendar year)
  fiscalYearType: 'calendar' | 'fiscal-july';

  // Whether Gateway filing is required
  requiresGatewayFiling: boolean;

  // Budget cycle
  budgetCycle: 'annual' | 'biennial';

  // Audit threshold (units below this may have less frequent audits)
  auditThreshold: number;

  // Optional: custom fund codes enabled for this tenant
  customFundsEnabled?: boolean;

  // Optional: LIT (Local Income Tax) detailed configuration
  litConfig?: INLitConfig;

  // Optional: utility-specific finance settings
  utilityFinanceConfig?: INUtilityFinanceConfig;

  // Allow extension for future fields
  [key: string]: unknown;
}

/**
 * Local Income Tax (LIT) Configuration
 */
export interface INLitConfig {
  hasLit: boolean;
  litRate?: number;           // e.g., 0.015 for 1.5%
  litTypes?: LitType[];
  certifiedDistributions?: boolean;
}

export type LitType =
  | 'expenditure'
  | 'property-tax-relief'
  | 'public-safety'
  | 'economic-development'
  | 'correctional-facility'
  | 'special-purpose';

/**
 * Utility Finance Configuration
 */
export interface INUtilityFinanceConfig {
  hasWaterUtility: boolean;
  hasSewerUtility: boolean;
  hasStormwaterUtility: boolean;
  hasElectricUtility: boolean;
  hasGasUtility: boolean;

  // Rate-setting authority (IURC vs local)
  waterRateAuthority?: 'iurc' | 'local';
  sewerRateAuthority?: 'iurc' | 'local';
}

/**
 * Default Indiana finance configuration.
 */
export const DEFAULT_IN_FINANCE_CONFIG: INFinanceConfig = {
  domain: 'finance',
  enabled: true,
  fiscalYearType: 'calendar',
  requiresGatewayFiling: true,
  budgetCycle: 'annual',
  auditThreshold: 250000,
};
