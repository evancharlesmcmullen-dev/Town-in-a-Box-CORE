// src/states/in/finance/in-finance.pack.ts

import { JurisdictionProfile } from '../../../core/tenancy/tenancy.types';
import { StatePack, stateRegistry } from '../../../core/state';
import { INFinanceConfig } from './in-finance.config';
import { INFinancialRulesEngine } from './in-financial-rules.engine';

/**
 * Indiana Finance Pack
 *
 * Bundles all finance-related rules, configurations, and engines
 * for Indiana jurisdictions.
 */
export class INFinancePack implements StatePack<INFinanceConfig> {
  readonly state = 'IN' as const;
  readonly domain = 'finance';
  readonly version = '1.0.0';

  config: INFinanceConfig;

  private rulesEngine: INFinancialRulesEngine;

  constructor(config?: Partial<INFinanceConfig>) {
    this.config = {
      domain: 'finance',
      enabled: true,
      ...config,
      // Indiana-specific defaults
      fiscalYearType: config?.fiscalYearType ?? 'calendar',
      requiresGatewayFiling: config?.requiresGatewayFiling ?? true,
      budgetCycle: config?.budgetCycle ?? 'annual',
      auditThreshold: config?.auditThreshold ?? 250000,
    };
    this.rulesEngine = new INFinancialRulesEngine();
  }

  /**
   * Check if this pack applies to the given jurisdiction.
   */
  appliesTo(j: JurisdictionProfile): boolean {
    return j.state === 'IN';
  }

  /**
   * Get the finance rules engine.
   */
  getRulesEngine(): INFinancialRulesEngine {
    return this.rulesEngine;
  }

  /**
   * Get finance rules for a specific jurisdiction.
   */
  getFinanceRules(j: JurisdictionProfile) {
    return this.rulesEngine.getFinanceRules(j);
  }
}

// Create and register the default Indiana finance pack
export const inFinancePack = new INFinancePack();
stateRegistry.registerPack(inFinancePack);
