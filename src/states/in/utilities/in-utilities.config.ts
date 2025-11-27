// src/states/in/utilities/in-utilities.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana Utilities Configuration
 *
 * Configuration for municipal utility operations per IC 8-1.5.
 */
export interface INUtilitiesConfig extends DomainConfig {
  domain: 'utilities';

  // Utility types operated
  utilityTypes: UtilityType[];

  // Rate-setting requirements by utility type
  rateSettingRequirements: Record<string, RateSettingRequirement>;

  // Disconnection rules
  disconnectionRules: DisconnectionRules;

  // Billing requirements
  billingRequirements: BillingRequirements;
}

/**
 * Type of utility.
 */
export interface UtilityType {
  code: string;
  name: string;
  description: string;
  fundCode?: string;
  citation?: StatutoryCitation;
}

/**
 * Rate-setting requirement.
 */
export interface RateSettingRequirement {
  utilityType: string;
  iurcJurisdiction: boolean;
  requiresPublicHearing: boolean;
  noticeDays: number;
  approvalBody: 'council' | 'iurc' | 'utility-board';
  citation?: StatutoryCitation;
}

/**
 * Disconnection rules.
 */
export interface DisconnectionRules {
  minimumNoticeDays: number;
  winterMoratorium?: WinterMoratorium;
  medicalCertificateRules?: MedicalCertificateRules;
  reconnectionFee?: number;
  citation?: StatutoryCitation;
}

/**
 * Winter moratorium on disconnections.
 */
export interface WinterMoratorium {
  enabled: boolean;
  startMonth: number;
  endMonth: number;
  temperatureThreshold?: number;
  notes?: string;
}

/**
 * Medical certificate rules.
 */
export interface MedicalCertificateRules {
  allowsDelay: boolean;
  delayDays: number;
  maxExtensions: number;
}

/**
 * Billing requirements.
 */
export interface BillingRequirements {
  billDueMinimumDays: number;
  lateFeeMaxPercent: number;
  depositMaxMonths: number;
}

/**
 * Default Indiana utilities configuration.
 */
export const DEFAULT_IN_UTILITIES_CONFIG: INUtilitiesConfig = {
  domain: 'utilities',
  enabled: true,

  utilityTypes: [
    {
      code: 'water',
      name: 'Water Utility',
      description: 'Municipal water supply and distribution.',
      fundCode: '601',
      citation: { code: 'IC 8-1.5-3' },
    },
    {
      code: 'sewer',
      name: 'Sewer Utility',
      description: 'Municipal wastewater collection and treatment.',
      fundCode: '602',
      citation: { code: 'IC 8-1.5-3' },
    },
    {
      code: 'stormwater',
      name: 'Stormwater Utility',
      description: 'Stormwater management and drainage.',
      fundCode: '603',
      citation: { code: 'IC 8-1.5-5' },
    },
    {
      code: 'electric',
      name: 'Electric Utility',
      description: 'Municipal electric generation and distribution.',
      fundCode: '610',
    },
    {
      code: 'gas',
      name: 'Gas Utility',
      description: 'Municipal natural gas distribution.',
      fundCode: '620',
    },
  ],

  rateSettingRequirements: {
    water: {
      utilityType: 'water',
      iurcJurisdiction: false, // Municipal utilities typically local
      requiresPublicHearing: true,
      noticeDays: 10,
      approvalBody: 'council',
      citation: { code: 'IC 8-1.5-3-8' },
    },
    sewer: {
      utilityType: 'sewer',
      iurcJurisdiction: false,
      requiresPublicHearing: true,
      noticeDays: 10,
      approvalBody: 'council',
      citation: { code: 'IC 8-1.5-3-8' },
    },
    stormwater: {
      utilityType: 'stormwater',
      iurcJurisdiction: false,
      requiresPublicHearing: true,
      noticeDays: 10,
      approvalBody: 'council',
      citation: { code: 'IC 8-1.5-5' },
    },
    electric: {
      utilityType: 'electric',
      iurcJurisdiction: true, // IURC may have jurisdiction
      requiresPublicHearing: true,
      noticeDays: 30,
      approvalBody: 'iurc',
    },
  },

  disconnectionRules: {
    minimumNoticeDays: 14,
    winterMoratorium: {
      enabled: true,
      startMonth: 12, // December
      endMonth: 3,    // March
      temperatureThreshold: 32,
      notes: 'Disconnection restricted when temperature is below 32°F.',
    },
    medicalCertificateRules: {
      allowsDelay: true,
      delayDays: 30,
      maxExtensions: 2,
    },
    reconnectionFee: 25.00,
    citation: { code: 'IC 8-1-2-121' },
  },

  billingRequirements: {
    billDueMinimumDays: 21,
    lateFeeMaxPercent: 10,
    depositMaxMonths: 2,
  },
};
