// src/states/in/meetings/in-meetings.pack.ts

import { JurisdictionProfile } from '../../../core/tenancy/tenancy.types';
import { StatePack, stateRegistry } from '../../../core/state';
import { INMeetingsConfig, DEFAULT_IN_MEETINGS_CONFIG } from './in-meetings.config';

/**
 * Indiana Meetings Pack
 *
 * Bundles Open Door Law rules and meeting requirements
 * for Indiana jurisdictions per IC 5-14-1.5.
 */
export class INMeetingsPack implements StatePack<INMeetingsConfig> {
  readonly state = 'IN' as const;
  readonly domain = 'meetings';
  readonly version = '1.0.0';

  config: INMeetingsConfig;

  constructor(config?: Partial<INMeetingsConfig>) {
    this.config = {
      ...DEFAULT_IN_MEETINGS_CONFIG,
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
   * Get notice requirements for a meeting type.
   */
  getNoticeRequirements(meetingType: 'regular' | 'special' | 'emergency') {
    return {
      regular: {
        noticePeriodHours: 48,
        excludesWeekends: true,
        excludesHolidays: true,
        postingLocations: this.config.defaultPostingLocations,
      },
      special: {
        noticePeriodHours: 48,
        excludesWeekends: true,
        excludesHolidays: true,
        postingLocations: this.config.defaultPostingLocations,
      },
      emergency: {
        noticePeriodHours: 0,
        excludesWeekends: false,
        excludesHolidays: false,
        postingLocations: this.config.defaultPostingLocations,
        requiresEmergencyJustification: true,
      },
    }[meetingType];
  }

  /**
   * Get allowed executive session topics per IC 5-14-1.5-6.1.
   */
  getExecutiveSessionTopics() {
    return this.config.allowedExecSessionTopics;
  }
}

// Create and register the default Indiana meetings pack
export const inMeetingsPack = new INMeetingsPack();
stateRegistry.registerPack(inMeetingsPack);
