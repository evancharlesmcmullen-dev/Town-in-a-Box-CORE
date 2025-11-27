// src/states/in/apra/in-apra.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana APRA (Access to Public Records Act) Configuration
 *
 * Configuration for public records access per IC 5-14-3.
 */
export interface INApraConfig extends DomainConfig {
  domain: 'apra';

  // Response deadline in business days
  responseDeadlineBusinessDays: number;

  // Whether reasonable particularity is required
  requiresReasonableParticularity: boolean;

  // Exemptions from disclosure
  exemptions: ApraExemption[];

  // Fee schedule
  feeSchedule: ApraFeeSchedule;

  // Denial reasons
  denialReasons: DenialReason[];

  // Public Access Counselor contact
  pacContact?: PacContact;
}

/**
 * APRA exemption from disclosure.
 */
export interface ApraExemption {
  code: string;
  category: 'confidential' | 'discretionary';
  description: string;
  citation: StatutoryCitation;
  notes?: string;
}

/**
 * Fee schedule for records requests.
 */
export interface ApraFeeSchedule {
  copyFeePerPage: number;
  certificationFee?: number;
  searchFeePerHour?: number;
  electronicMediaFee?: number;
  notes?: string;
}

/**
 * Reason for denial of a records request.
 */
export interface DenialReason {
  code: string;
  description: string;
  citation?: StatutoryCitation;
}

/**
 * Public Access Counselor contact.
 */
export interface PacContact {
  name: string;
  phone?: string;
  email?: string;
  url?: string;
}

/**
 * Default Indiana APRA configuration.
 */
export const DEFAULT_IN_APRA_CONFIG: INApraConfig = {
  domain: 'apra',
  enabled: true,

  responseDeadlineBusinessDays: 7,
  requiresReasonableParticularity: true,

  exemptions: [
    {
      code: 'CONFIDENTIAL_STATUTE',
      category: 'confidential',
      description: 'Records declared confidential by state statute, rule, or federal law.',
      citation: { code: 'IC 5-14-3-4(a)' },
    },
    {
      code: 'INVESTIGATORY',
      category: 'discretionary',
      description: 'Investigatory records of a law enforcement agency.',
      citation: { code: 'IC 5-14-3-4(b)(1)' },
    },
    {
      code: 'DELIBERATIVE',
      category: 'discretionary',
      description: 'Intra-agency or interagency advisory communications.',
      citation: { code: 'IC 5-14-3-4(b)(6)' },
    },
    {
      code: 'PERSONNEL_FILE',
      category: 'discretionary',
      description: 'Personnel files except name, compensation, job title, etc.',
      citation: { code: 'IC 5-14-3-4(b)(8)' },
    },
    {
      code: 'ATTORNEY_CLIENT',
      category: 'confidential',
      description: 'Attorney-client privileged communications.',
      citation: { code: 'IC 5-14-3-4(a)(4)' },
    },
    {
      code: 'WORK_PRODUCT',
      category: 'confidential',
      description: 'Attorney work product.',
      citation: { code: 'IC 5-14-3-4(a)(5)' },
    },
    {
      code: 'SOCIAL_SECURITY',
      category: 'confidential',
      description: 'Social Security numbers.',
      citation: { code: 'IC 5-14-3-4(a)(12)' },
    },
  ],

  feeSchedule: {
    copyFeePerPage: 0.10,
    certificationFee: 5.00,
    notes:
      'Fees may be waived if furnishing information is in the public interest. Electronic records may be provided at cost of media.',
  },

  denialReasons: [
    {
      code: 'NO_RECORDS_EXIST',
      description: 'No records responsive to the request exist.',
    },
    {
      code: 'EXEMPT_CONFIDENTIAL',
      description: 'Records are exempt as confidential under IC 5-14-3-4(a).',
    },
    {
      code: 'EXEMPT_DISCRETIONARY',
      description: 'Records are exempt under IC 5-14-3-4(b) and agency elects to withhold.',
    },
    {
      code: 'LACKS_PARTICULARITY',
      description: 'Request does not reasonably describe the records sought.',
    },
    {
      code: 'UNREASONABLE_BURDEN',
      description: 'Request would create an unreasonable burden on the agency.',
    },
  ],

  pacContact: {
    name: 'Indiana Public Access Counselor',
    url: 'https://www.in.gov/pac/',
    email: 'pac@oag.in.gov',
  },
};
