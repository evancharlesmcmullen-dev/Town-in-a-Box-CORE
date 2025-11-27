// src/states/in/finance/in-fund-structure.config.ts

import { StatutoryCitation } from '../../../core/state';

/**
 * Indiana Fund Structure Configuration
 *
 * Defines the standard fund numbering and categories used by
 * Indiana local governments per SBOA Uniform Chart of Accounts.
 */

/**
 * Fund category definition.
 */
export interface FundCategory {
  id: string;
  name: string;
  codeRange: { start: number; end: number };
  description: string;
  citation?: StatutoryCitation;
}

/**
 * Standard fund definition with Indiana-specific metadata.
 */
export interface INFundDefinition {
  code: string;
  name: string;
  category: string;
  isRestricted: boolean;
  isRequired: boolean;
  description: string;
  allowedUseTags: string[];
  citation?: StatutoryCitation;
  applicableTo?: ('town' | 'city' | 'township' | 'county')[];
}

/**
 * Indiana fund categories per SBOA guidance.
 */
export const IN_FUND_CATEGORIES: FundCategory[] = [
  {
    id: 'general',
    name: 'General Funds',
    codeRange: { start: 100, end: 199 },
    description: 'General operating funds for unrestricted use.',
  },
  {
    id: 'road',
    name: 'Highway and Street Funds',
    codeRange: { start: 200, end: 299 },
    description: 'Restricted funds for road, street, and highway purposes.',
  },
  {
    id: 'park',
    name: 'Park Funds',
    codeRange: { start: 300, end: 399 },
    description: 'Funds for park and recreation purposes.',
  },
  {
    id: 'debt',
    name: 'Debt Service Funds',
    codeRange: { start: 400, end: 499 },
    description: 'Funds for debt service and bond payments.',
  },
  {
    id: 'capital',
    name: 'Capital Project Funds',
    codeRange: { start: 500, end: 599 },
    description: 'Funds for capital improvements and projects.',
  },
  {
    id: 'utility',
    name: 'Utility Funds',
    codeRange: { start: 600, end: 699 },
    description: 'Enterprise funds for utility operations.',
  },
  {
    id: 'special',
    name: 'Special Revenue Funds',
    codeRange: { start: 700, end: 799 },
    description: 'Special purpose and restricted revenue funds.',
  },
  {
    id: 'trust',
    name: 'Trust and Agency Funds',
    codeRange: { start: 800, end: 899 },
    description: 'Fiduciary funds held in trust.',
  },
  {
    id: 'tif',
    name: 'TIF Funds',
    codeRange: { start: 900, end: 999 },
    description: 'Tax Increment Financing allocation areas.',
  },
];

/**
 * Standard Indiana funds for towns.
 */
export const IN_TOWN_STANDARD_FUNDS: INFundDefinition[] = [
  {
    code: '101',
    name: 'General Fund',
    category: 'general',
    isRestricted: false,
    isRequired: true,
    description: 'Primary operating fund for general town operations.',
    allowedUseTags: ['operations', 'admin', 'publicSafety', 'parks', 'general'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },
  {
    code: '201',
    name: 'Motor Vehicle Highway (MVH)',
    category: 'road',
    isRestricted: true,
    isRequired: true,
    description: 'State-distributed motor vehicle highway funds.',
    allowedUseTags: ['roads', 'streets', 'highways', 'maintenance'],
    citation: { code: 'IC 8-14-1', title: 'Motor Vehicle Highway Account' },
    applicableTo: ['town', 'city', 'county'],
  },
  {
    code: '202',
    name: 'Local Road and Street (LRS)',
    category: 'road',
    isRestricted: true,
    isRequired: true,
    description: 'Local road and street fund from state distributions.',
    allowedUseTags: ['roads', 'streets', 'localRoads', 'maintenance'],
    citation: { code: 'IC 8-14-2', title: 'Local Road and Street Fund' },
    applicableTo: ['town', 'city'],
  },
  {
    code: '301',
    name: 'Park Fund',
    category: 'park',
    isRestricted: true,
    isRequired: false,
    description: 'Park and recreation operations and maintenance.',
    allowedUseTags: ['parks', 'recreation', 'maintenance'],
    applicableTo: ['town', 'city'],
  },
  {
    code: '601',
    name: 'Water Utility Operating',
    category: 'utility',
    isRestricted: true,
    isRequired: false,
    description: 'Water utility enterprise operating fund.',
    allowedUseTags: ['water', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
  },
  {
    code: '602',
    name: 'Sewer Utility Operating',
    category: 'utility',
    isRestricted: true,
    isRequired: false,
    description: 'Sewer utility enterprise operating fund.',
    allowedUseTags: ['sewer', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
  },
  {
    code: '603',
    name: 'Stormwater Utility Operating',
    category: 'utility',
    isRestricted: true,
    isRequired: false,
    description: 'Stormwater utility enterprise operating fund.',
    allowedUseTags: ['stormwater', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
  },
  {
    code: '701',
    name: 'Cumulative Capital Development (CCD)',
    category: 'special',
    isRestricted: true,
    isRequired: false,
    description: 'Cumulative capital development fund for capital projects.',
    allowedUseTags: ['capital', 'equipment', 'buildings'],
    citation: { code: 'IC 36-9-15.5', title: 'Cumulative Capital Development Fund' },
    applicableTo: ['town', 'city'],
  },
  {
    code: '702',
    name: 'Cumulative Capital Improvement (CCI)',
    category: 'special',
    isRestricted: true,
    isRequired: false,
    description: 'Cumulative capital improvement fund.',
    allowedUseTags: ['capital', 'improvements'],
    applicableTo: ['town', 'city'],
  },
];

/**
 * Get standard funds for a jurisdiction type.
 */
export function getStandardFundsFor(kind: string): INFundDefinition[] {
  return IN_TOWN_STANDARD_FUNDS.filter(
    (f) => !f.applicableTo || f.applicableTo.includes(kind as any)
  );
}

/**
 * Get fund category by code.
 */
export function getFundCategory(fundCode: string): FundCategory | undefined {
  const codeNum = parseInt(fundCode, 10);
  return IN_FUND_CATEGORIES.find(
    (c) => codeNum >= c.codeRange.start && codeNum <= c.codeRange.end
  );
}
