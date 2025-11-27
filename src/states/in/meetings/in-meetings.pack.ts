// src/states/in/meetings/in-meetings.pack.ts

import { TenantIdentity, StateDomainPack } from '../../../core/state/state.types';
import {
  INMeetingsConfig,
  GoverningBodyType,
  NoticeChannel,
  DEFAULT_IN_MEETINGS_CONFIG,
} from './in-meetings.config';

/**
 * Configuration options that can be passed to the meetings config builder.
 * These are combined with computed defaults from tenant identity.
 */
export interface InMeetingsPackOptions {
  /** Override the default regular meeting notice hours */
  regularMeetingNoticeHours?: number;
  /** Override the default special meeting notice hours */
  specialMeetingNoticeHours?: number;
  /** Override the default emergency meeting notice hours */
  emergencyMeetingNoticeHours?: number;
  /** Override the default regular meeting day (0-6) */
  defaultRegularMeetingDay?: number;
  /** Override the default regular meeting time */
  defaultRegularMeetingTime?: string;
  /** Whether remote participation is supported */
  supportsRemoteParticipation?: boolean;
  /** Override governing body types */
  governingBodyTypes?: GoverningBodyType[];
  /** Override notice channels */
  noticeChannels?: NoticeChannel[];
  /** Override minutes retention years */
  minutesRetentionYears?: number;
  /** Override recording retention days */
  recordingRetentionDays?: number;
}

/**
 * Indiana Meetings Pack
 *
 * This pack "thinks" - it derives configuration from tenant identity
 * using Indiana Open Door Law rules (IC 5-14-1.5).
 *
 * Key features:
 * - All Indiana entities have 48-hour notice requirement (baseline)
 * - Governing body types are inferred from entity class
 * - Provides sensible defaults for meeting patterns and notice channels
 * - All Indiana-specific meetings logic lives here, not scattered across the codebase
 *
 * Usage:
 *   const defaults = InMeetingsPack.getDefaultConfig(tenantIdentity);
 *   const config = { ...defaults, ...tenantOverrides };
 */
export const InMeetingsPack: StateDomainPack<Partial<INMeetingsConfig>> = {
  state: 'IN',
  domain: 'meetings',

  /**
   * Generate default meetings configuration based on tenant identity.
   *
   * This is where Indiana-specific logic lives:
   * - All entities: 48-hour notice for regular/special meetings (IC 5-14-1.5-5)
   * - Emergency meetings: 0 hours notice (IC 5-14-1.5-5(d))
   * - Governing body types vary by entity class
   * - Cities may have more complex board structures
   *
   * @param identity - Tenant identity with entity class, population, etc.
   * @returns Partial config with computed and default values
   */
  getDefaultConfig(identity: TenantIdentity): Partial<INMeetingsConfig> {
    // Determine governing body types based on entity class
    const governingBodyTypes = getDefaultGoverningBodies(identity.entityClass);

    // Determine if larger entity (cities often have more complex requirements)
    const isLargerEntity = (identity.population ?? 0) >= 10000;

    return {
      domain: 'meetings',
      enabled: true,

      // Notice requirements per IC 5-14-1.5-5
      // 48 hours is the baseline for all Indiana entities
      regularMeetingNoticeHours: 48,
      specialMeetingNoticeHours: 48,
      emergencyMeetingNoticeHours: 0, // Emergency has no advance notice per IC 5-14-1.5-5(d)

      // Meeting patterns - no default day/time, tenant sets these
      defaultRegularMeetingDay: undefined,
      defaultRegularMeetingTime: undefined,

      // Remote participation - default to false, tenant enables as needed
      // (Indiana has specific rules about electronic meetings)
      supportsRemoteParticipation: false,

      // Governing bodies derived from entity class
      governingBodyTypes,

      // Agenda and minutes requirements (per IC 5-14-1.5-4)
      requiresAgendaPosting: true,
      requiresMinutes: true,

      // Notice channels - basic setup for all entities
      // Larger entities may want to add newspaper, social media
      noticeChannels: isLargerEntity
        ? ['website', 'physicalPosting', 'newspaper']
        : ['website', 'physicalPosting'],

      // Electronic posting is standard for modern entities
      electronicPostingEnabled: true,

      // Default posting locations
      defaultPostingLocations: [
        {
          id: 'municipal-building',
          name: getMunicipalBuildingName(identity.entityClass),
          type: 'physical',
          isPrimary: true,
        },
      ],

      // Retention defaults based on Indiana records schedules
      minutesRetentionYears: 10,
      recordingRetentionDays: 90,

      // Minutes requirements per IC 5-14-1.5-4
      minutesRequirements: {
        requiresMemoranda: true,
        retentionYears: 10,
        mustRecordVotes: true,
        mustRecordAbsences: true,
      },

      // Executive session topics - same for all Indiana entities per IC 5-14-1.5-6.1
      allowedExecSessionTopics: DEFAULT_IN_MEETINGS_CONFIG.allowedExecSessionTopics,

      // Quorum rules - majority is standard
      quorumRules: {
        minimumForQuorum: 'majority',
        countsAbsentees: false,
      },
    };
  },
};

/**
 * Get default governing body types based on entity class.
 *
 * Different entity types have different typical boards:
 * - Towns: Town Council, possibly Plan Commission
 * - Cities: City Council, often BZA, Redevelopment, etc.
 * - Townships: Township Board, Township Trustee meetings
 * - Counties: County Council, Commissioners, various boards
 *
 * @param entityClass - The entity classification
 * @returns Array of governing body types
 */
function getDefaultGoverningBodies(
  entityClass: TenantIdentity['entityClass']
): GoverningBodyType[] {
  switch (entityClass) {
    case 'TOWN':
      // Small towns typically have council and basic boards
      return ['COUNCIL', 'BOARD', 'PLAN_COMMISSION'];

    case 'CITY':
      // Cities often have more complex governance structures
      return [
        'COUNCIL',
        'BOARD',
        'BZA',
        'PLAN_COMMISSION',
        'REDEVELOPMENT',
        'PARKS_BOARD',
      ];

    case 'TOWNSHIP':
      // Townships have trustee and board
      return ['BOARD'];

    case 'COUNTY':
      // Counties have commissioners, council, and many boards
      return [
        'COUNCIL',
        'BOARD',
        'COMMISSION',
        'PLAN_COMMISSION',
        'BZA',
        'REDEVELOPMENT',
      ];

    case 'SPECIAL_DISTRICT':
      // Special districts typically have a single governing board
      return ['BOARD'];

    default:
      // Fallback to basic structure
      return ['COUNCIL', 'BOARD'];
  }
}

/**
 * Get the appropriate municipal building name based on entity class.
 *
 * @param entityClass - The entity classification
 * @returns Appropriate building name for posting location
 */
function getMunicipalBuildingName(
  entityClass: TenantIdentity['entityClass']
): string {
  switch (entityClass) {
    case 'TOWN':
      return 'Town Hall Bulletin Board';
    case 'CITY':
      return 'City Hall Bulletin Board';
    case 'TOWNSHIP':
      return 'Township Office Bulletin Board';
    case 'COUNTY':
      return 'County Courthouse Bulletin Board';
    case 'SPECIAL_DISTRICT':
      return 'District Office Bulletin Board';
    default:
      return 'Municipal Building Bulletin Board';
  }
}

/**
 * Helper function to build a complete meetings config for a tenant.
 *
 * This combines:
 * 1. Computed defaults from InMeetingsPack.getDefaultConfig()
 * 2. Tenant-specific overrides
 *
 * @param identity - Tenant identity
 * @param overrides - Tenant-specific configuration overrides
 * @returns Complete INMeetingsConfig (partial - tenant may override more)
 *
 * @example
 * ```typescript
 * import { buildMeetingsConfig } from './in-meetings.pack';
 *
 * const config = buildMeetingsConfig(
 *   { tenantId: 'example-town', displayName: 'Example Town', state: 'IN', entityClass: 'TOWN', population: 2350 },
 *   { defaultRegularMeetingDay: 2, defaultRegularMeetingTime: '19:00' }
 * );
 *
 * // config.regularMeetingNoticeHours === 48 (Indiana baseline)
 * // config.governingBodyTypes includes 'COUNCIL', 'BOARD', 'PLAN_COMMISSION'
 * // config.defaultRegularMeetingDay === 2 (Tuesday, from override)
 * ```
 */
export function buildMeetingsConfig(
  identity: TenantIdentity,
  overrides?: InMeetingsPackOptions
): Partial<INMeetingsConfig> {
  const defaults = InMeetingsPack.getDefaultConfig(identity);

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Get a summary of Open Door Law requirements for a tenant.
 * Useful for wizards and UI display.
 *
 * @param identity - Tenant identity
 * @returns Summary of meeting requirements
 */
export function getMeetingRequirementsSummary(identity: TenantIdentity): {
  regularNoticeHours: number;
  specialNoticeHours: number;
  emergencyNoticeHours: number;
  governingBodyTypes: GoverningBodyType[];
  requiresMinutes: boolean;
  requiresAgendaPosting: boolean;
  explanation: string;
} {
  const config = InMeetingsPack.getDefaultConfig(identity) as Partial<INMeetingsConfig>;

  return {
    regularNoticeHours: config.regularMeetingNoticeHours ?? 48,
    specialNoticeHours: config.specialMeetingNoticeHours ?? 48,
    emergencyNoticeHours: config.emergencyMeetingNoticeHours ?? 0,
    governingBodyTypes: config.governingBodyTypes ?? ['COUNCIL', 'BOARD'],
    requiresMinutes: config.requiresMinutes ?? true,
    requiresAgendaPosting: config.requiresAgendaPosting ?? true,
    explanation:
      `${identity.displayName} must provide 48 hours notice for regular and special meetings per IC 5-14-1.5-5. ` +
      `Emergency meetings may be called without advance notice under IC 5-14-1.5-5(d).`,
  };
}
