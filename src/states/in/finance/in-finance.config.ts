// src/states/in/finance/in-finance.config.ts

import { DomainConfig } from '../../../core/state';

/**
 * Indiana Finance Configuration
 *
 * Configuration options specific to Indiana municipal finance.
 */
export interface INFinanceConfig extends DomainConfig {
  domain: 'finance';

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

  // Optional: LIT (Local Income Tax) configuration
  litConfig?: INLitConfig;

  // Optional: utility-specific finance settings
  utilityFinanceConfig?: INUtilityFinanceConfig;
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
