// src/states/in/finance/in-lit-rules.config.ts

import { StatutoryCitation } from '../../../core/state';

/**
 * Indiana Local Income Tax (LIT) Rules Configuration
 *
 * Defines the rules and requirements for Local Income Tax
 * under IC 6-3.6 and related statutes.
 *
 * KEY RULE: Municipalities under 3,501 population cannot levy their own LIT;
 * they must participate in county LIT distributions.
 */

// =============================================================================
// PURE RULE FUNCTIONS (no dependencies on tenants - just logic)
// =============================================================================

/**
 * Pure rules interface for LIT eligibility.
 * These functions take raw values and return boolean/computed results.
 */
export interface InLitRuleSet {
  /**
   * Can this municipality levy its own Local Income Tax?
   * Per IC 6-3.6, municipalities must have population >= 3,501.
   */
  canLevyOwnLIT(population: number): boolean;

  /**
   * Get the population threshold for LIT levy authority.
   */
  getLitPopulationThreshold(): number;
}

/**
 * Indiana LIT Rules - pure functions for determining LIT eligibility.
 *
 * IMPORTANT: This is where "under 3,500 uses county LIT" becomes a single
 * line of logic instead of being duplicated across wizard, UI, and engine.
 */
export const InLitRules: InLitRuleSet = {
  canLevyOwnLIT(population: number): boolean {
    // IC 6-3.6 requires population >= 3,501 to levy own LIT
    return population >= 3501;
  },

  getLitPopulationThreshold(): number {
    return 3501;
  },
};

// =============================================================================
// LIT TYPE DEFINITIONS
// =============================================================================

/**
 * LIT rate limits by type.
 */
export interface LitRateLimit {
  type: string;
  maxRate: number;
  citation: StatutoryCitation;
}

/**
 * LIT adoption requirements.
 */
export interface LitAdoptionRequirement {
  id: string;
  description: string;
  deadlineDescription: string;
  citation: StatutoryCitation;
}

/**
 * Indiana LIT rate limits per IC 6-3.6.
 */
export const IN_LIT_RATE_LIMITS: LitRateLimit[] = [
  {
    type: 'expenditure',
    maxRate: 0.0295, // 2.95%
    citation: {
      code: 'IC 6-3.6-6-2.5',
      title: 'Local Income Tax',
      notes: 'Maximum combined LIT rate cap.',
    },
  },
  {
    type: 'property-tax-relief',
    maxRate: 0.0125, // 1.25%
    citation: {
      code: 'IC 6-3.6-5',
      title: 'Property Tax Relief LIT',
    },
  },
  {
    type: 'public-safety',
    maxRate: 0.0025, // 0.25%
    citation: {
      code: 'IC 6-3.6-6',
      title: 'Public Safety LIT',
    },
  },
  {
    type: 'economic-development',
    maxRate: 0.0050, // 0.50%
    citation: {
      code: 'IC 6-3.6-6',
      title: 'Economic Development LIT',
    },
  },
];

/**
 * LIT adoption deadlines and requirements.
 */
export const IN_LIT_ADOPTION_REQUIREMENTS: LitAdoptionRequirement[] = [
  {
    id: 'LIT_ADOPTION_DEADLINE',
    description:
      'County council must adopt LIT ordinance by November 1 to take effect the following year.',
    deadlineDescription: 'November 1 of the year prior to effect',
    citation: {
      code: 'IC 6-3.6-3-3',
      title: 'LIT Adoption',
    },
  },
  {
    id: 'LIT_DLGF_CERTIFICATION',
    description:
      'DLGF must certify LIT distributions to each adopting unit.',
    deadlineDescription: 'Per DLGF schedule',
    citation: {
      code: 'IC 6-3.6-9',
      title: 'LIT Distribution',
    },
  },
];

/**
 * Get LIT rules for a jurisdiction.
 */
export function getINLitRules() {
  return {
    rateLimits: IN_LIT_RATE_LIMITS,
    adoptionRequirements: IN_LIT_ADOPTION_REQUIREMENTS,
  };
}
