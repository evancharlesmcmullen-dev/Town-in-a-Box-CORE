// src/core/state/state.types.ts

import { JurisdictionProfile } from '../tenancy/tenancy.types';

/**
 * Supported US state codes.
 * IN (Indiana) is the first; others will be added as we expand.
 */
export type USStateCode = 'IN' | 'OH' | 'IL' | 'MI' | 'KY' | string;

/**
 * Metadata about a supported state.
 */
export interface StateMetadata {
  code: USStateCode;
  name: string;
  timezone: string;
  fiscalYearStart: { month: number; day: number };

  // Oversight agencies (e.g., SBOA, DLGF for Indiana)
  oversightAgencies: OversightAgency[];

  // Supported local government kinds in this state
  supportedGovKinds: SupportedGovKind[];
}

/**
 * State oversight agency (e.g., Indiana SBOA, DLGF).
 */
export interface OversightAgency {
  code: string;           // e.g., 'SBOA', 'DLGF'
  name: string;           // e.g., 'State Board of Accounts'
  url?: string;
  contactEmail?: string;
}

/**
 * A local government kind supported by a state, with metadata.
 */
export interface SupportedGovKind {
  kind: string;           // 'town' | 'city' | 'township' | 'county' | etc.
  formId: string;         // e.g., 'IN_TOWN', 'IN_TOWNSHIP'
  displayName: string;    // e.g., 'Indiana Town'
  description?: string;
}

/**
 * A "pack" bundles domain-specific rules and configs for a state.
 * Each domain (finance, meetings, records, etc.) has its own pack.
 */
export interface StatePack<TConfig = unknown> {
  readonly state: USStateCode;
  readonly domain: string;          // e.g., 'finance', 'meetings', 'records'
  readonly version: string;         // semver for the pack

  config: TConfig;

  // Check if this pack applies to a given jurisdiction
  appliesTo(j: JurisdictionProfile): boolean;
}

/**
 * Base interface for domain-specific configuration.
 * Each domain will extend this with its own fields.
 */
export interface DomainConfig {
  domain: string;
  enabled: boolean;
  notes?: string;
}

/**
 * Statutory citation reference.
 */
export interface StatutoryCitation {
  code: string;           // e.g., 'IC 5-14-3-4'
  title?: string;
  section?: string;
  url?: string;
  notes?: string;
}

/**
 * A legal opinion or interpretation tied to a specific domain.
 */
export interface LegalOpinion {
  id: string;
  domain: string;
  topic: string;
  question: string;
  answer: string;
  citations: StatutoryCitation[];
  effectiveDate?: string;
  supersededBy?: string;
  tags?: string[];
}

/**
 * Rule evaluation result.
 */
export interface RuleEvaluationResult {
  ruleId: string;
  passed: boolean;
  message?: string;
  citations?: StatutoryCitation[];
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Minimal tenant identity for use in pack configuration.
 * This is passed to getDefaultConfig() to derive state-specific defaults.
 */
export interface TenantIdentity {
  tenantId: string;
  displayName: string;
  state: USStateCode;
  entityClass: 'TOWN' | 'CITY' | 'TOWNSHIP' | 'COUNTY' | 'SPECIAL_DISTRICT';
  population?: number;
  countyName?: string;
}

/**
 * A domain pack that can generate default configurations based on tenant identity.
 * This is the new pattern for state packs that "think" - deriving config from rules.
 */
export interface StateDomainPack<TConfig = unknown> {
  readonly state: USStateCode;
  readonly domain: string;

  /**
   * Generate default configuration based on tenant identity.
   * This is where state-specific logic lives (e.g., population thresholds for LIT).
   */
  getDefaultConfig(identity: TenantIdentity): Partial<TConfig>;
}
