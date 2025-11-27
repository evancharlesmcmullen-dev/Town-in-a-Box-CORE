// src/states/in/planning/in-planning.pack.ts

import { JurisdictionProfile } from '../../../core/tenancy/tenancy.types';
import { StatePack, stateRegistry } from '../../../core/state';
import { INPlanningConfig, DEFAULT_IN_PLANNING_CONFIG } from './in-planning.config';

/**
 * Indiana Planning Pack
 *
 * Bundles planning, zoning, and BZA rules
 * for Indiana jurisdictions per IC 36-7-4.
 */
export class INPlanningPack implements StatePack<INPlanningConfig> {
  readonly state = 'IN' as const;
  readonly domain = 'planning';
  readonly version = '1.0.0';

  config: INPlanningConfig;

  constructor(config?: Partial<INPlanningConfig>) {
    this.config = {
      ...DEFAULT_IN_PLANNING_CONFIG,
      ...config,
    };
  }

  /**
   * Check if this pack applies to the given jurisdiction.
   */
  appliesTo(j: JurisdictionProfile): boolean {
    return j.state === 'IN' && j.authorityTags?.includes('zoningAuthority');
  }

  /**
   * Get case types supported for this jurisdiction.
   */
  getCaseTypes() {
    return this.config.caseTypes;
  }

  /**
   * Get variance criteria.
   */
  getVarianceCriteria(varianceType: 'use' | 'development-standards') {
    if (varianceType === 'use') {
      return this.config.useVarianceCriteria;
    }
    return this.config.developmentVarianceCriteria;
  }

  /**
   * Get notice requirements for a case type.
   */
  getNoticeRequirements(caseType: string) {
    return this.config.noticeRequirements[caseType];
  }
}

// Create and register the default Indiana planning pack
export const inPlanningPack = new INPlanningPack();
stateRegistry.registerPack(inPlanningPack);
