// src/core/finance/finance-rules.engine.ts

import { JurisdictionProfile } from '../tenancy/tenancy.types';
import { FinanceRuleSet } from './finance-rules.types';

/**
 * State-aware provider of finance/legal rule sets.
 *
 * Implementations (e.g. INFinancialRulesEngine) provide:
 * - Fund catalog for that jurisdiction type
 * - Appropriation control rules
 * - Reporting requirements (AFR, Gateway budget, special fund reports)
 */
export interface FinancialRulesEngine {
  getFinanceRules(jurisdiction: JurisdictionProfile): FinanceRuleSet;
}
