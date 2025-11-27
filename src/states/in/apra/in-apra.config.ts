// src/states/in/apra/in-apra.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana APRA (Access to Public Records Act) Configuration
 *
 * Configuration for public records access per IC 5-14-3.
 * This config is derived from tenant identity + state rules via InApraPack.
 */
export interface INApraConfig extends DomainConfig {
  domain: 'apra';

  // ==========================================================================
  // Deadlines / Timing
  // ==========================================================================

  /**
   * Standard response deadline in days (per IC 5-14-3-9(a)).
   * Default is 7 business days.
   */
  standardResponseDays: number;

  /**
   * Extension response deadline in days if allowed.
   * Some agencies may have additional time for complex requests.
   */
  extensionResponseDays?: number;

  /**
   * Whether deadlines are counted in business days only (excludes weekends/holidays).
   * Default is true per IC 5-14-3-9(a).
   */
  businessDaysOnly?: boolean;

  // ==========================================================================
  // Fee Schedule Hooks
  // ==========================================================================

  /**
   * Whether copy fees are permitted per IC 5-14-3-8.
   */
  allowCopyFees: boolean;

  /**
   * Default per-page fee for copies in dollars.
   * IC 5-14-3-8 allows "reasonable" copying fees.
   */
  defaultPerPageFee?: number;

  /**
   * Whether fees for electronic copies are permitted.
   */
  allowElectronicCopyFees?: boolean;

  /**
   * Minutes of search time provided without charge.
   * Beyond this, search fees may apply.
   */
  maxSearchTimeWithoutChargeMinutes?: number;

  /**
   * Certification fee for certified copies.
   */
  certificationFee?: number;

  /**
   * Fee schedule notes (e.g., waiver policies).
   */
  feeScheduleNotes?: string;

  // ==========================================================================
  // Delivery Methods
  // ==========================================================================

  /**
   * Allowed delivery methods for records fulfillment.
   */
  allowedDeliveryMethods: ('email' | 'postal' | 'inPerson' | 'portal' | string)[];

  /**
   * Whether inspection-only requests (viewing without copying) are allowed.
   * Per IC 5-14-3-3, requesters have the right to inspect records.
   */
  allowInspectionOnlyRequests?: boolean;

  // ==========================================================================
  // Exemption / Redaction Handling
  // ==========================================================================

  /**
   * Whether a detailed redaction log is required when withholding portions.
   */
  requiresRedactionLog?: boolean;

  /**
   * Whether sensitive fields should be masked by default (SSN, etc.).
   */
  maskSensitiveFieldsByDefault?: boolean;

  /**
   * Whether requests must reasonably identify the record (IC 5-14-3-3(a)).
   */
  requiresReasonableParticularity: boolean;

  /**
   * Exemptions from disclosure per IC 5-14-3-4.
   */
  exemptions: ApraExemption[];

  /**
   * Standard denial reasons.
   */
  denialReasons: DenialReason[];

  // ==========================================================================
  // Retention / Logging Hooks
  // ==========================================================================

  /**
   * Whether APRA requests should be logged for tracking and compliance.
   */
  logRequests: boolean;

  /**
   * How many years to retain request logs.
   */
  requestLogRetentionYears?: number;

  // ==========================================================================
  // Public Access Counselor
  // ==========================================================================

  /**
   * Public Access Counselor contact for appeals/complaints.
   */
  pacContact?: PacContact;

  // ==========================================================================
  // Extensibility
  // ==========================================================================

  /** Allow extension for future fields */
  [key: string]: unknown;
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
 * Default Indiana APRA exemptions per IC 5-14-3-4.
 */
export const DEFAULT_APRA_EXEMPTIONS: ApraExemption[] = [
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
];

/**
 * Default APRA denial reasons.
 */
export const DEFAULT_APRA_DENIAL_REASONS: DenialReason[] = [
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
];

/**
 * Default Public Access Counselor contact.
 */
export const DEFAULT_PAC_CONTACT: PacContact = {
  name: 'Indiana Public Access Counselor',
  url: 'https://www.in.gov/pac/',
  email: 'pac@oag.in.gov',
};

/**
 * Default Indiana APRA configuration.
 * Used as fallback when no pack-computed defaults are available.
 */
export const DEFAULT_IN_APRA_CONFIG: INApraConfig = {
  domain: 'apra',
  enabled: true,

  // Deadlines per IC 5-14-3-9(a)
  standardResponseDays: 7,
  extensionResponseDays: 14,
  businessDaysOnly: true,

  // Fees per IC 5-14-3-8
  allowCopyFees: true,
  defaultPerPageFee: 0.10,
  certificationFee: 5.00,
  allowElectronicCopyFees: false,
  maxSearchTimeWithoutChargeMinutes: 30,
  feeScheduleNotes:
    'Fees may be waived if furnishing information is in the public interest. Electronic records may be provided at cost of media.',

  // Delivery
  allowedDeliveryMethods: ['email', 'postal', 'inPerson'],
  allowInspectionOnlyRequests: true,

  // Exemptions and redaction
  requiresReasonableParticularity: true,
  requiresRedactionLog: true,
  maskSensitiveFieldsByDefault: true,
  exemptions: DEFAULT_APRA_EXEMPTIONS,
  denialReasons: DEFAULT_APRA_DENIAL_REASONS,

  // Logging
  logRequests: true,
  requestLogRetentionYears: 3,

  // PAC contact
  pacContact: DEFAULT_PAC_CONTACT,
};
