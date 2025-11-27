// src/states/in/utilities/in-utilities.pack.ts

import { JurisdictionProfile } from '../../../core/tenancy/tenancy.types';
import { StatePack, stateRegistry } from '../../../core/state';
import { INUtilitiesConfig, DEFAULT_IN_UTILITIES_CONFIG } from './in-utilities.config';

/**
 * Indiana Utilities Pack
 *
 * Bundles utility regulation and operations rules
 * for Indiana municipal utilities per IC 8-1.5.
 */
export class INUtilitiesPack implements StatePack<INUtilitiesConfig> {
  readonly state = 'IN' as const;
  readonly domain = 'utilities';
  readonly version = '1.0.0';

  config: INUtilitiesConfig;

  constructor(config?: Partial<INUtilitiesConfig>) {
    this.config = {
      ...DEFAULT_IN_UTILITIES_CONFIG,
      ...config,
    };
  }

  /**
   * Check if this pack applies to the given jurisdiction.
   */
  appliesTo(j: JurisdictionProfile): boolean {
    return j.state === 'IN' && j.authorityTags?.includes('utilityOperator');
  }

  /**
   * Get utility types operated by this jurisdiction.
   */
  getUtilityTypes() {
    return this.config.utilityTypes;
  }

  /**
   * Get rate-setting requirements.
   */
  getRateSettingRequirements(utilityType: string) {
    return this.config.rateSettingRequirements[utilityType];
  }

  /**
   * Get disconnection rules.
   */
  getDisconnectionRules() {
    return this.config.disconnectionRules;
  }

  /**
   * Check if IURC jurisdiction applies.
   */
  isIurcJurisdiction(utilityType: string): boolean {
    const req = this.config.rateSettingRequirements[utilityType];
    return req?.iurcJurisdiction ?? false;
  }
}

// Create and register the default Indiana utilities pack
export const inUtilitiesPack = new INUtilitiesPack();
stateRegistry.registerPack(inUtilitiesPack);
