// src/states/in/apra/in-apra.pack.ts

import { TenantIdentity, StateDomainPack } from '../../../core/state/state.types';
import {
  INApraConfig,
  DEFAULT_APRA_EXEMPTIONS,
  DEFAULT_APRA_DENIAL_REASONS,
  DEFAULT_PAC_CONTACT,
} from './in-apra.config';

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
