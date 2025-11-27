// src/tenants/lapel-in/index.ts

/**
 * Lapel tenant exports.
 *
 * NOTE: This file only exports static configuration data.
 * All domain-specific logic (finance, meetings, etc.) is resolved
 * using the generic buildDomainConfig() from core/state.
 *
 * Example usage:
 *   import { buildDomainConfig } from '../../core/state';
 *   import { lapelTenantConfig, lapelIdentity } from './';
 *
 *   const financeConfig = buildDomainConfig(lapelTenantConfig, lapelIdentity, 'finance');
 */

export {
  lapelTenantConfig,
  createLapelConfig,
  lapelIdentity,
  lapelFinanceOverrides,
} from './tenant.config';
