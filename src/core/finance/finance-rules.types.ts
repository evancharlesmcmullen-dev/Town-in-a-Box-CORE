// src/core/finance/finance-rules.types.ts

import { JurisdictionProfile } from '../tenancy/tenancy.types';

/**
 * High-level category of a fund for rule purposes.
 */
export type FundCategory =
  | 'general'
  | 'road'
  | 'utility'
  | 'capital'
  | 'debtService'
  | 'grant'
  | 'specialRevenue'
  | 'other';

/**
 * A canonical fund definition for Indiana units.
 * This is not the live Fund entity, but the rule/catalog entry.
 */
export interface FundDefinition {
  code: string;              // e.g. "101"
  name: string;              // e.g. "General Fund"
  category: FundCategory;

  // Optional flags for special behavior or oversight.
  isRestricted?: boolean;    // e.g. utility funds, CCD, cumulative funds
  description?: string;

  // Allowed use tags for high-level guardrails (e.g. "operations", "roads", "cemeteries").
  allowedUseTags?: string[];
}

/**
 * Rules around appropriations and spending.
 */
export interface AppropriationRuleSet {
  // True if spending generally may not exceed appropriation (Indiana IC 6-1.1-18, SBOA rules).
  enforceAppropriationLimit: boolean;

  // Whether additional appropriations are allowed mid-year and basic note for process.
  allowsAdditionalAppropriations: boolean;
  additionalAppropriationNotes?: string;

  // Whether encumbrance accounting is expected for this unit.
  supportsEncumbrances: boolean;
}

/**
 * A reporting requirement tied to finance, budgets, or funds
 * (e.g., AFR, Gateway budget file, special fund reports).
 */
export type ReportingFrequency = 'annual' | 'monthly' | 'quarterly' | 'adHoc';

export interface FinanceReportingRequirement {
  id: string;                     // e.g. "AFR", "BUDGET_GW", "TA7", "FOOD_BEV_REPORT"
  name: string;                   // human-friendly
  description?: string;

  frequency: ReportingFrequency;
  dueDescription?: string;        // e.g. "Due 60 days after year end", "Due by March 1"
  statutoryCitation?: string;     // e.g. "IC 5-11-1-4", "IC 36-7-32.5-14.5"

  // e.g. ["Gateway AFR upload", "SBOA AFR", "Township Form 15"]
  formCodes?: string[];

  overseenBy?: ('SBOA' | 'DLGF' | 'LegislativeBody' | 'Other')[];
}

/**
 * Aggregated rule set for finance for a given jurisdiction.
 */
export interface FinanceRuleSet {
  jurisdiction: JurisdictionProfile;

  fundCatalog: FundDefinition[];
  appropriationRules: AppropriationRuleSet;
  reportingRequirements: FinanceReportingRequirement[];
}
