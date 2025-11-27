// src/states/in/township/index.ts

/**
 * Indiana Township Pack
 *
 * Provides township-specific configuration and logic for Indiana townships.
 * This pack enables township-specific engines and provides statutory defaults.
 *
 * Key features:
 * - Township assistance (poor relief) per IC 12-20
 * - Fence viewer services per IC 32-26
 * - Weed control per IC 15-16-8
 * - Cemetery management per IC 23-14-68
 * - Fire contract management
 * - Insurance and bond tracking per IC 5-4-1
 * - Policy/resolution registry
 *
 * Usage:
 * ```typescript
 * import { InTownshipPack, buildTownshipConfig, isTownship } from './states/in/township';
 *
 * if (isTownship(tenantIdentity)) {
 *   const config = buildTownshipConfig(tenantIdentity, { fireModel: 'TERRITORY' });
 *   // Initialize township engines...
 * }
 * ```
 */

// Main pack and builder functions
export {
  InTownshipPack,
  buildTownshipConfig,
  isTownship,
  getTownshipDutiesSummary,
  getTownshipEnabledModules,
} from './in-township.pack';

// Configuration types
export type {
  INTownshipConfig,
  TownshipFireModel,
  TownshipModuleId,
  InTownshipPackOptions,
} from './in-township.pack';

// Default config
export { DEFAULT_IN_TOWNSHIP_CONFIG } from './in-township.config';

// Register the pack with the global registry
import { registerDomainPack } from '../../../core/state/state-registry';
import { InTownshipPack } from './in-township.pack';

registerDomainPack(InTownshipPack);
