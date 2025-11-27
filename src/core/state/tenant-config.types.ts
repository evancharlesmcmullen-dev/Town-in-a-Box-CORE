// src/core/state/tenant-config.types.ts

import { JurisdictionProfile, DataStoreConfig } from '../tenancy/tenancy.types';
import { USStateCode } from './state.types';

/**
 * Extended tenant configuration with state-specific settings.
 */
export interface StateTenantConfig {
  tenantId: string;
  name: string;
  state: USStateCode;
  jurisdiction: JurisdictionProfile;

  // Data storage configuration
  dataStore: DataStoreConfig;

  // Enabled domain modules
  enabledModules: EnabledModule[];

  // State-specific overrides and preferences
  stateOverrides?: StateOverrides;

  // Integration settings (e.g., Gateway, external systems)
  integrations?: IntegrationConfig[];

  // Contact information
  contacts?: TenantContact[];

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * An enabled module with optional configuration.
 */
export interface EnabledModule {
  moduleId: string;       // e.g., 'finance', 'meetings', 'apra'
  enabled: boolean;
  config?: Record<string, unknown>;
}

/**
 * State-specific overrides for a tenant.
 */
export interface StateOverrides {
  // Custom fiscal year (if different from state default)
  fiscalYearStart?: { month: number; day: number };

  // Custom timezone (if different from state default)
  timezone?: string;

  // Custom deadline adjustments
  deadlineAdjustments?: DeadlineAdjustment[];

  // Custom fund codes or mappings
  customFundMappings?: Record<string, string>;

  // Other state-specific overrides
  [key: string]: unknown;
}

/**
 * Adjustment to a standard deadline.
 */
export interface DeadlineAdjustment {
  deadlineId: string;
  adjustmentDays?: number;
  adjustmentBusinessDays?: number;
  reason: string;
}

/**
 * External integration configuration.
 */
export interface IntegrationConfig {
  integrationId: string;  // e.g., 'gateway', 'gis', 'banking'
  enabled: boolean;
  endpoint?: string;
  credentials?: string;   // Reference to secret, not the actual value
  options?: Record<string, unknown>;
}

/**
 * Contact information for a tenant.
 */
export interface TenantContact {
  role: string;           // e.g., 'clerk-treasurer', 'council-president'
  name: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

/**
 * Factory function type for creating tenant configs.
 */
export type TenantConfigFactory = (
  tenantId: string,
  jurisdiction: JurisdictionProfile,
  options?: Partial<StateTenantConfig>
) => StateTenantConfig;
