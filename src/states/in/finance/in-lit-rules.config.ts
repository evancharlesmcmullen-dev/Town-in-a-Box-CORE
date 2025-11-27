// src/states/in/finance/in-lit-rules.config.ts

import { StatutoryCitation } from '../../../core/state';

/**
 * Indiana Local Income Tax (LIT) Rules Configuration
 *
 * Defines the rules and requirements for Local Income Tax
 * under IC 6-3.6 and related statutes.
 */

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
