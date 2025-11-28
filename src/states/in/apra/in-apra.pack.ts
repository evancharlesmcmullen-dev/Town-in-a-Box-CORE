// src/states/in/apra/in-apra.pack.ts

import { TenantIdentity, StateDomainPack } from '../../../core/state/state.types';
import {
  INApraConfig,
  ApraExemption,
  DEFAULT_APRA_EXEMPTIONS,
  DEFAULT_APRA_DENIAL_REASONS,
  DEFAULT_PAC_CONTACT,
} from './in-apra.config';
import {
  computeApraDeadline,
  addBusinessDays,
  getIndianaStateHolidays,
} from '../../../core/calendar/open-door.calendar';

/**
 * Configuration options that can be passed to the APRA config builder.
 * These are combined with computed defaults from tenant identity.
 */
export interface InApraPackOptions {
  /** Override standard response days */
  standardResponseDays?: number;
  /** Override extension response days */
  extensionResponseDays?: number;
  /** Override business days only setting */
  businessDaysOnly?: boolean;
  /** Override copy fees allowed */
  allowCopyFees?: boolean;
  /** Override default per-page fee */
  defaultPerPageFee?: number;
  /** Override electronic copy fees allowed */
  allowElectronicCopyFees?: boolean;
  /** Override max search time without charge */
  maxSearchTimeWithoutChargeMinutes?: number;
  /** Override allowed delivery methods */
  allowedDeliveryMethods?: ('email' | 'postal' | 'inPerson' | 'portal' | string)[];
  /** Override inspection-only requests allowed */
  allowInspectionOnlyRequests?: boolean;
  /** Override requires redaction log */
  requiresRedactionLog?: boolean;
  /** Override mask sensitive fields by default */
  maskSensitiveFieldsByDefault?: boolean;
  /** Override log requests */
  logRequests?: boolean;
  /** Override request log retention years */
  requestLogRetentionYears?: number;
}

/**
 * Indiana APRA (Access to Public Records Act) Pack
 *
 * This pack "thinks" - it derives configuration from tenant identity
 * using Indiana APRA rules per IC 5-14-3.
 *
 * Key features:
 * - All Indiana entities have 7 business day response requirement (IC 5-14-3-9)
 * - Fee schedules and delivery methods vary by entity size
 * - Exemptions from IC 5-14-3-4 apply uniformly
 * - All Indiana-specific APRA logic lives here, not scattered across the codebase
 *
 * Usage:
 *   const defaults = InApraPack.getDefaultConfig(tenantIdentity);
 *   const config = { ...defaults, ...tenantOverrides };
 */
export const InApraPack: StateDomainPack<Partial<INApraConfig>> = {
  state: 'IN',
  domain: 'apra',

  /**
   * Generate default APRA configuration based on tenant identity.
   *
   * This is where Indiana-specific logic lives:
   * - All entities: 7 business day response deadline (IC 5-14-3-9)
   * - Larger entities may have portal delivery option
   * - Fee schedules are uniform but may be waived
   *
   * @param identity - Tenant identity with population, entity class, etc.
   * @returns Partial config with computed and default values
   */
  getDefaultConfig(identity: TenantIdentity): Partial<INApraConfig> {
    // Determine if larger entity (population >= 10,000 or city class)
    const isLargerEntity =
      (identity.population ?? 0) >= 10000 || identity.entityClass === 'CITY';

    // Determine delivery methods based on entity size
    // Larger entities often have online portals; smaller ones may not
    const allowedDeliveryMethods: ('email' | 'postal' | 'inPerson' | 'portal')[] =
      isLargerEntity
        ? ['email', 'postal', 'inPerson', 'portal']
        : ['email', 'postal', 'inPerson'];

    return {
      domain: 'apra',
      enabled: true,

      // =======================================================================
      // Deadlines per IC 5-14-3-9
      // =======================================================================
      standardResponseDays: 7,
      extensionResponseDays: 14,
      businessDaysOnly: true,

      // =======================================================================
      // Fee Schedule per IC 5-14-3-8
      // =======================================================================
      allowCopyFees: true,
      defaultPerPageFee: 0.10,
      certificationFee: 5.00,
      allowElectronicCopyFees: false, // Most Indiana entities don't charge for electronic
      maxSearchTimeWithoutChargeMinutes: 30, // Common practice
      feeScheduleNotes:
        'Fees may be waived if furnishing information is in the public interest. ' +
        'Electronic records may be provided at cost of media.',

      // =======================================================================
      // Delivery Methods
      // =======================================================================
      allowedDeliveryMethods,
      allowInspectionOnlyRequests: true, // Per IC 5-14-3-3

      // =======================================================================
      // Exemption / Redaction Handling
      // =======================================================================
      requiresReasonableParticularity: true, // Per IC 5-14-3-3(a)
      requiresRedactionLog: true,
      maskSensitiveFieldsByDefault: true,
      exemptions: DEFAULT_APRA_EXEMPTIONS,
      denialReasons: DEFAULT_APRA_DENIAL_REASONS,

      // =======================================================================
      // Logging / Retention
      // =======================================================================
      logRequests: true,
      requestLogRetentionYears: isLargerEntity ? 3 : 2, // Larger entities may need longer retention

      // =======================================================================
      // Public Access Counselor
      // =======================================================================
      pacContact: DEFAULT_PAC_CONTACT,
    };
  },
};

/**
 * Helper function to build a complete APRA config for a tenant.
 *
 * This combines:
 * 1. Computed defaults from InApraPack.getDefaultConfig()
 * 2. Tenant-specific overrides
 *
 * @param identity - Tenant identity
 * @param overrides - Tenant-specific configuration overrides
 * @returns Complete INApraConfig (partial - tenant may override more)
 *
 * @example
 * ```typescript
 * import { buildApraConfig } from './in-apra.pack';
 *
 * const config = buildApraConfig(
 *   { tenantId: 'example-town', displayName: 'Example Town', state: 'IN', entityClass: 'TOWN', population: 2350 },
 *   { maxSearchTimeWithoutChargeMinutes: 60 }
 * );
 *
 * // config.standardResponseDays === 7 (Indiana baseline)
 * // config.allowedDeliveryMethods includes email, postal, inPerson (smaller entity)
 * // config.maxSearchTimeWithoutChargeMinutes === 60 (from override)
 * ```
 */
export function buildApraConfig(
  identity: TenantIdentity,
  overrides?: InApraPackOptions
): Partial<INApraConfig> {
  const defaults = InApraPack.getDefaultConfig(identity);

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get a summary of APRA requirements for a tenant.
 * Useful for wizards and UI display.
 *
 * @param identity - Tenant identity
 * @returns Summary of APRA requirements
 */
export function getApraRequirementsSummary(identity: TenantIdentity): {
  standardResponseDays: number;
  businessDaysOnly: boolean;
  allowCopyFees: boolean;
  defaultPerPageFee: number;
  allowedDeliveryMethods: string[];
  explanation: string;
} {
  const config = InApraPack.getDefaultConfig(identity) as Partial<INApraConfig>;

  return {
    standardResponseDays: config.standardResponseDays ?? 7,
    businessDaysOnly: config.businessDaysOnly ?? true,
    allowCopyFees: config.allowCopyFees ?? true,
    defaultPerPageFee: config.defaultPerPageFee ?? 0.10,
    allowedDeliveryMethods: config.allowedDeliveryMethods ?? ['email', 'postal', 'inPerson'],
    explanation:
      `${identity.displayName} must respond to public records requests within 7 business days ` +
      `per IC 5-14-3-9(a). Reasonable copying fees are permitted under IC 5-14-3-8.`,
  };
}

// =============================================================================
// DEADLINE CALCULATION HELPERS
// =============================================================================

/**
 * Result of deadline calculation.
 */
export interface ApraDeadlineResult {
  /** The computed deadline date */
  deadline: Date;
  /** ISO string of the deadline */
  deadlineIso: string;
  /** Number of business days from received date */
  businessDays: number;
  /** Whether the deadline includes an extension */
  isExtended: boolean;
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Calculate the statutory deadline for an APRA request.
 *
 * Uses Indiana calendar with state holidays to compute the proper
 * 7 business day deadline per IC 5-14-3-9(a).
 *
 * @param receivedAt - When the request was received
 * @param options - Optional configuration
 * @returns Deadline calculation result
 *
 * @example
 * ```typescript
 * import { calculateApraDeadline } from './in-apra.pack';
 *
 * const result = calculateApraDeadline(new Date('2025-01-06T09:00:00'));
 * console.log(result.deadlineIso); // "2025-01-15T09:00:00.000Z" (7 business days)
 * console.log(result.explanation); // "Response due by January 15, 2025..."
 * ```
 */
export function calculateApraDeadline(
  receivedAt: Date,
  options?: {
    /** Whether to use extended deadline (14 days instead of 7) */
    useExtension?: boolean;
    /** Additional holidays beyond Indiana state holidays */
    additionalHolidays?: string[];
  }
): ApraDeadlineResult {
  const year = receivedAt.getFullYear();
  const holidays = getIndianaStateHolidays(year);

  // Include next year's holidays if near end of year
  if (receivedAt.getMonth() >= 10) {
    holidays.push(...getIndianaStateHolidays(year + 1));
  }

  // Add any custom holidays
  if (options?.additionalHolidays) {
    holidays.push(...options.additionalHolidays);
  }

  const businessDays = options?.useExtension ? 14 : 7;
  const deadline = addBusinessDays(receivedAt, businessDays, { holidays });

  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    deadline,
    deadlineIso: deadline.toISOString(),
    businessDays,
    isExtended: options?.useExtension ?? false,
    explanation: options?.useExtension
      ? `Extended response due by ${formatter.format(deadline)} (14 business days from receipt).`
      : `Response due by ${formatter.format(deadline)} per IC 5-14-3-9(a) (7 business days from receipt).`,
  };
}

/**
 * Check if a response would be timely for an APRA request.
 *
 * @param receivedAt - When the request was received
 * @param respondedAt - When the response was/will be sent
 * @param useExtension - Whether extension was granted
 * @returns Whether the response is timely and details
 *
 * @example
 * ```typescript
 * const result = checkApraTimeliness(
 *   new Date('2025-01-06'),
 *   new Date('2025-01-14')
 * );
 * console.log(result.isTimely); // true (before 7 business day deadline)
 * ```
 */
export function checkApraTimeliness(
  receivedAt: Date,
  respondedAt: Date,
  useExtension = false
): {
  isTimely: boolean;
  deadline: Date;
  daysRemaining: number;
  explanation: string;
} {
  const { deadline, businessDays } = calculateApraDeadline(receivedAt, { useExtension });
  const isTimely = respondedAt <= deadline;

  // Calculate rough days remaining (simplified)
  const msRemaining = deadline.getTime() - respondedAt.getTime();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  return {
    isTimely,
    deadline,
    daysRemaining: Math.max(0, daysRemaining),
    explanation: isTimely
      ? `Response is timely (within ${businessDays} business day requirement).`
      : `Response is OVERDUE. Deadline was ${deadline.toLocaleDateString()}.`,
  };
}

// =============================================================================
// ENTITY-CLASS BASED HELPERS
// =============================================================================

/**
 * Common record types by entity class.
 * Helps staff identify what records to search for based on request type.
 */
export type CommonRecordType =
  | 'meeting_minutes'
  | 'ordinances'
  | 'resolutions'
  | 'contracts'
  | 'emails'
  | 'personnel_files'
  | 'financial_records'
  | 'permits'
  | 'zoning_records'
  | 'police_reports'
  | 'utility_records'
  | 'property_records'
  | 'court_records'
  | 'election_records'
  | 'tax_records';

/**
 * Get common record types for an entity class.
 *
 * Different entity types maintain different records. This helper
 * returns the typical record categories for each entity class.
 *
 * @param entityClass - The entity classification
 * @returns Array of common record types
 *
 * @example
 * ```typescript
 * const recordTypes = getCommonRecordTypes('TOWN');
 * // ['meeting_minutes', 'ordinances', 'resolutions', 'contracts', ...]
 * ```
 */
export function getCommonRecordTypes(
  entityClass: TenantIdentity['entityClass']
): CommonRecordType[] {
  const baseRecords: CommonRecordType[] = [
    'meeting_minutes',
    'ordinances',
    'resolutions',
    'contracts',
    'emails',
    'personnel_files',
    'financial_records',
  ];

  switch (entityClass) {
    case 'TOWN':
      return [
        ...baseRecords,
        'permits',
        'zoning_records',
        'utility_records',
      ];

    case 'CITY':
      return [
        ...baseRecords,
        'permits',
        'zoning_records',
        'police_reports',
        'utility_records',
        'property_records',
      ];

    case 'TOWNSHIP':
      return [
        'meeting_minutes',
        'resolutions',
        'financial_records',
        'property_records',
        'contracts',
      ];

    case 'COUNTY':
      return [
        ...baseRecords,
        'permits',
        'zoning_records',
        'police_reports',
        'court_records',
        'election_records',
        'tax_records',
        'property_records',
      ];

    case 'SPECIAL_DISTRICT':
      return [
        'meeting_minutes',
        'resolutions',
        'contracts',
        'financial_records',
      ];

    default:
      return baseRecords;
  }
}

/**
 * Get the designated records custodian title for an entity class.
 *
 * @param entityClass - The entity classification
 * @returns The typical title of the records custodian
 */
export function getRecordsCustodianTitle(
  entityClass: TenantIdentity['entityClass']
): string {
  switch (entityClass) {
    case 'TOWN':
      return 'Clerk-Treasurer';
    case 'CITY':
      return 'City Clerk';
    case 'TOWNSHIP':
      return 'Township Trustee';
    case 'COUNTY':
      return 'County Clerk';
    case 'SPECIAL_DISTRICT':
      return 'District Administrator';
    default:
      return 'Records Custodian';
  }
}

// =============================================================================
// FEE ESTIMATION HELPERS
// =============================================================================

/**
 * Input for fee estimation.
 */
export interface FeeEstimateInput {
  /** Number of pages to copy */
  pages?: number;
  /** Whether copies are color */
  isColor?: boolean;
  /** Number of certified copies needed */
  certifications?: number;
  /** Whether mailing is required */
  requiresMailing?: boolean;
  /** Estimated search hours (beyond free threshold) */
  searchHours?: number;
}

/**
 * Result of fee estimation.
 */
export interface FeeEstimateResult {
  /** Estimated total in dollars */
  estimatedTotalDollars: number;
  /** Formatted total (e.g., "$15.50") */
  formattedTotal: string;
  /** Line item breakdown */
  breakdown: { item: string; amount: number }[];
  /** Whether fees might be waived */
  waiverNote: string;
}

/**
 * Estimate APRA copying fees based on config defaults.
 *
 * This is a simplified estimator for UI purposes. For actual billing,
 * use the ApraFeeCalculator from the engine layer.
 *
 * @param identity - Tenant identity (for config lookup)
 * @param input - Fee estimation input
 * @returns Fee estimate result
 *
 * @example
 * ```typescript
 * const estimate = estimateApraFees(townIdentity, {
 *   pages: 50,
 *   isColor: false,
 *   requiresMailing: true,
 * });
 * console.log(estimate.formattedTotal); // "$10.00"
 * ```
 */
export function estimateApraFees(
  identity: TenantIdentity,
  input: FeeEstimateInput
): FeeEstimateResult {
  const config = InApraPack.getDefaultConfig(identity) as Partial<INApraConfig>;
  const breakdown: { item: string; amount: number }[] = [];
  let total = 0;

  // Per-page fees
  if (input.pages && input.pages > 0) {
    const perPage = input.isColor ? 0.25 : (config.defaultPerPageFee ?? 0.10);
    const pageAmount = input.pages * perPage;
    breakdown.push({
      item: `${input.pages} ${input.isColor ? 'color' : 'B&W'} pages @ $${perPage.toFixed(2)}`,
      amount: pageAmount,
    });
    total += pageAmount;
  }

  // Certification fees
  if (input.certifications && input.certifications > 0) {
    const certFee = config.certificationFee ?? 5.0;
    const certAmount = input.certifications * certFee;
    breakdown.push({
      item: `${input.certifications} certification(s) @ $${certFee.toFixed(2)}`,
      amount: certAmount,
    });
    total += certAmount;
  }

  // Mailing
  if (input.requiresMailing) {
    const mailingFee = 5.0; // Standard estimate
    breakdown.push({ item: 'Mailing/postage (estimated)', amount: mailingFee });
    total += mailingFee;
  }

  // Search time (only if over threshold)
  const freeMinutes = config.maxSearchTimeWithoutChargeMinutes ?? 30;
  if (input.searchHours && input.searchHours > freeMinutes / 60) {
    const chargeableHours = input.searchHours - freeMinutes / 60;
    const laborRate = 20.0; // Standard rate
    const laborAmount = chargeableHours * laborRate;
    breakdown.push({
      item: `${chargeableHours.toFixed(1)} hrs search time @ $${laborRate.toFixed(2)}/hr`,
      amount: laborAmount,
    });
    total += laborAmount;
  }

  return {
    estimatedTotalDollars: total,
    formattedTotal: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(total),
    breakdown,
    waiverNote:
      'Fees may be waived if furnishing the information is in the public interest. ' +
      'Contact the records custodian to request a fee waiver.',
  };
}

// =============================================================================
// EXEMPTION HELPERS
// =============================================================================

/**
 * Get exemptions applicable to a specific record type.
 *
 * Helps staff identify which exemptions might apply based on
 * the type of record being requested.
 *
 * @param recordType - Type of record being requested
 * @returns Applicable exemptions
 *
 * @example
 * ```typescript
 * const exemptions = getExemptionsForRecordType('personnel_files');
 * // Returns exemptions related to personnel records (IC 5-14-3-4(b)(8), etc.)
 * ```
 */
export function getExemptionsForRecordType(
  recordType: CommonRecordType
): ApraExemption[] {
  const exemptionsByType: Record<CommonRecordType, string[]> = {
    meeting_minutes: [], // Generally public
    ordinances: [], // Generally public
    resolutions: [], // Generally public
    contracts: [], // Generally public
    emails: ['DELIBERATIVE'], // May contain advisory communications
    personnel_files: ['PERSONNEL_FILE', 'SOCIAL_SECURITY'],
    financial_records: [], // Generally public
    permits: [], // Generally public
    zoning_records: [], // Generally public
    police_reports: ['INVESTIGATORY', 'CONFIDENTIAL_STATUTE'],
    utility_records: ['SOCIAL_SECURITY'], // May contain customer SSNs
    property_records: [], // Generally public
    court_records: ['ATTORNEY_CLIENT', 'WORK_PRODUCT'],
    election_records: [], // Generally public
    tax_records: ['CONFIDENTIAL_STATUTE', 'SOCIAL_SECURITY'],
  };

  const applicableCodes = exemptionsByType[recordType] ?? [];
  return DEFAULT_APRA_EXEMPTIONS.filter((e) => applicableCodes.includes(e.code));
}

/**
 * Generate a denial letter template for a specific exemption.
 *
 * @param exemption - The exemption being cited
 * @param entityName - Name of the denying entity
 * @returns Draft denial letter text
 */
export function generateDenialTemplate(
  exemption: ApraExemption,
  entityName: string
): string {
  return `Dear Requester,

${entityName} has received your public records request. After careful review, we must deny access to [specific records] based on the following exemption:

Exemption: ${exemption.description}
Citation: ${exemption.citation.code}

This is a ${exemption.category} exemption under the Indiana Access to Public Records Act (IC 5-14-3-4).

${exemption.notes ? `Note: ${exemption.notes}\n\n` : ''}You have the right to appeal this decision to the Indiana Public Access Counselor:
- Website: https://www.in.gov/pac/
- Email: pac@oag.in.gov

Sincerely,
[Records Custodian Name]
${entityName}`;
}

// Re-export calendar utilities for convenience
export {
  computeApraDeadline,
  addBusinessDays,
  getIndianaStateHolidays,
} from '../../../core/calendar/open-door.calendar';
