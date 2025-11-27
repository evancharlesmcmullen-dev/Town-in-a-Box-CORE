// src/states/in/apra/in-apra.pack.ts

import { JurisdictionProfile } from '../../../core/tenancy/tenancy.types';
import { StatePack, stateRegistry } from '../../../core/state';
import { INApraConfig, DEFAULT_IN_APRA_CONFIG } from './in-apra.config';

/**
 * Indiana APRA (Access to Public Records Act) Pack
 *
 * Bundles public records access rules for Indiana jurisdictions
 * per IC 5-14-3.
 */
export class INApraPack implements StatePack<INApraConfig> {
  readonly state = 'IN' as const;
  readonly domain = 'apra';
  readonly version = '1.0.0';

  config: INApraConfig;

  constructor(config?: Partial<INApraConfig>) {
    this.config = {
      ...DEFAULT_IN_APRA_CONFIG,
      ...config,
    };
  }

  /**
   * Check if this pack applies to the given jurisdiction.
   */
  appliesTo(j: JurisdictionProfile): boolean {
    return j.state === 'IN';
  }

  /**
   * Get response deadline in business days.
   */
  getResponseDeadline(): number {
    return this.config.responseDeadlineBusinessDays;
  }

  /**
   * Get all exemptions.
   */
  getExemptions() {
    return this.config.exemptions;
  }

  /**
   * Check if a specific exemption applies.
   */
  getExemption(exemptionCode: string) {
    return this.config.exemptions.find((e) => e.code === exemptionCode);
  }

  /**
   * Get fee schedule.
   */
  getFeeSchedule() {
    return this.config.feeSchedule;
  }

  /**
   * Get denial reasons.
   */
  getDenialReasons() {
    return this.config.denialReasons;
  }
}

// Create and register the default Indiana APRA pack
export const inApraPack = new INApraPack();
stateRegistry.registerPack(inApraPack);
