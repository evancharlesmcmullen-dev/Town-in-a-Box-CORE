// src/states/in/meetings/in-meetings.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana Meetings Configuration
 *
 * Configuration for Open Door Law compliance per IC 5-14-1.5.
 * This config is derived from tenant identity + state rules via InMeetingsPack.
 */
export interface INMeetingsConfig extends DomainConfig {
  domain: 'meetings';

  // ==========================================================================
  // Notice Lead Times (per IC 5-14-1.5-5)
  // ==========================================================================

  /**
   * Hours of advance notice required for regular meetings.
   * Indiana Open Door Law: 48 hours for most governing bodies.
   */
  regularMeetingNoticeHours: number;

  /**
   * Hours of advance notice required for special meetings.
   * Typically same as regular meetings per IC 5-14-1.5-5.
   */
  specialMeetingNoticeHours: number;

  /**
   * Hours of advance notice required for emergency meetings.
   * Emergency meetings have reduced/no notice requirements per IC 5-14-1.5-5(d).
   */
  emergencyMeetingNoticeHours: number;

  // ==========================================================================
  // Default Meeting Patterns
  // ==========================================================================

  /**
   * Default day of week for regular meetings (0=Sunday through 6=Saturday).
   * E.g., 1 for Monday, 2 for Tuesday.
   */
  defaultRegularMeetingDay?: number;

  /**
   * Default time for regular meetings in 24-hour format (e.g., "18:30").
   */
  defaultRegularMeetingTime?: string;

  /**
   * Whether this governing body supports remote/virtual participation.
   * Future-proofing for post-pandemic meeting flexibility.
   */
  supportsRemoteParticipation?: boolean;

  // ==========================================================================
  // Governing Body Types and Open Door Applicability
  // ==========================================================================

  /**
   * Types of governing bodies subject to Open Door Law.
   * Common Indiana types: COUNCIL, BOARD, COMMISSION, BZA, PLAN_COMMISSION, REDEVELOPMENT
   */
  governingBodyTypes: GoverningBodyType[];

  /**
   * Whether agendas must be posted per IC 5-14-1.5-4.
   */
  requiresAgendaPosting: boolean;

  /**
   * Whether minutes are required per IC 5-14-1.5-4.
   */
  requiresMinutes: boolean;

  // ==========================================================================
  // Public Notice Channels
  // ==========================================================================

  /**
   * Channels through which meeting notices must be published.
   */
  noticeChannels: NoticeChannel[];

  /**
   * Default posting locations for notices.
   */
  defaultPostingLocations: PostingLocation[];

  /**
   * Whether electronic posting is enabled.
   */
  electronicPostingEnabled: boolean;

  // ==========================================================================
  // Records / Retention
  // ==========================================================================

  /**
   * How many years meeting minutes must be retained.
   */
  minutesRetentionYears?: number;

  /**
   * How many days meeting recordings must be retained.
   */
  recordingRetentionDays?: number;

  /**
   * Detailed minutes requirements.
   */
  minutesRequirements: MinutesRequirements;

  // ==========================================================================
  // Executive Sessions (IC 5-14-1.5-6.1)
  // ==========================================================================

  /**
   * Allowed executive session topics per IC 5-14-1.5-6.1.
   */
  allowedExecSessionTopics: ExecSessionTopic[];

  // ==========================================================================
  // Quorum Rules
  // ==========================================================================

  /**
   * Quorum rules for meetings.
   */
  quorumRules: QuorumRules;

  // ==========================================================================
  // Extension Support
  // ==========================================================================

  /**
   * Allow extension for future fields.
   */
  [key: string]: unknown;
}

/**
 * Type of governing body subject to Open Door Law.
 */
export type GoverningBodyType =
  | 'COUNCIL'
  | 'BOARD'
  | 'COMMISSION'
  | 'BZA'
  | 'PLAN_COMMISSION'
  | 'REDEVELOPMENT'
  | 'PARKS_BOARD'
  | 'UTILITY_BOARD'
  | string; // Allow custom types

/**
 * Channel for publishing meeting notices.
 */
export type NoticeChannel =
  | 'website'
  | 'physicalPosting'
  | 'newspaper'
  | 'email'
  | 'socialMedia'
  | string; // Allow custom channels

/**
 * A location where meeting notices are posted.
 */
export interface PostingLocation {
  id: string;
  name: string;
  type: 'physical' | 'electronic';
  address?: string;
  url?: string;
  isPrimary: boolean;
}

/**
 * Executive session topic allowed under IC 5-14-1.5-6.1.
 */
export interface ExecSessionTopic {
  code: string;
  description: string;
  citation: StatutoryCitation;
}

/**
 * Minutes requirements per IC 5-14-1.5-4.
 */
export interface MinutesRequirements {
  requiresMemoranda: boolean;
  retentionYears: number;
  mustRecordVotes: boolean;
  mustRecordAbsences: boolean;
}

/**
 * Quorum rules for meetings.
 */
export interface QuorumRules {
  minimumForQuorum: 'majority' | 'two-thirds' | 'specific';
  specificNumber?: number;
  countsAbsentees: boolean;
}

/**
 * Default Indiana meetings configuration.
 * This provides baseline values that InMeetingsPack.getDefaultConfig() may override.
 */
export const DEFAULT_IN_MEETINGS_CONFIG: INMeetingsConfig = {
  domain: 'meetings',
  enabled: true,

  // Notice lead times per IC 5-14-1.5-5
  regularMeetingNoticeHours: 48,
  specialMeetingNoticeHours: 48,
  emergencyMeetingNoticeHours: 0, // Emergency meetings have no notice requirement

  // Default meeting patterns - typically set per entity
  defaultRegularMeetingDay: undefined,
  defaultRegularMeetingTime: undefined,
  supportsRemoteParticipation: false,

  // Governing bodies - baseline for all Indiana entities
  governingBodyTypes: ['COUNCIL', 'BOARD'],
  requiresAgendaPosting: true,
  requiresMinutes: true,

  // Notice channels
  noticeChannels: ['website', 'physicalPosting'],
  defaultPostingLocations: [
    {
      id: 'municipal-building',
      name: 'Municipal Building Bulletin Board',
      type: 'physical',
      isPrimary: true,
    },
  ],
  electronicPostingEnabled: true,

  // Retention defaults (based on Indiana records retention schedules)
  minutesRetentionYears: 10,
  recordingRetentionDays: 90,

  minutesRequirements: {
    requiresMemoranda: true,
    retentionYears: 10,
    mustRecordVotes: true,
    mustRecordAbsences: true,
  },

  // Executive session topics per IC 5-14-1.5-6.1
  allowedExecSessionTopics: [
    {
      code: 'PERSONNEL',
      description:
        'Discussion of job performance evaluation of individual employees.',
      citation: { code: 'IC 5-14-1.5-6.1(b)(6)' },
    },
    {
      code: 'LITIGATION',
      description:
        'Strategy discussion with respect to initiation or pending litigation.',
      citation: { code: 'IC 5-14-1.5-6.1(b)(2)(B)' },
    },
    {
      code: 'NEGOTIATIONS',
      description:
        'Discussion of strategy regarding collective bargaining or labor negotiations.',
      citation: { code: 'IC 5-14-1.5-6.1(b)(4)' },
    },
    {
      code: 'REAL_ESTATE',
      description:
        'Discussion of purchase or lease of real property (before competitive or public offering).',
      citation: { code: 'IC 5-14-1.5-6.1(b)(2)(D)' },
    },
    {
      code: 'SECURITY',
      description:
        'Discussion of records classified as confidential by state or federal statute.',
      citation: { code: 'IC 5-14-1.5-6.1(b)(7)' },
    },
  ],

  // Quorum rules
  quorumRules: {
    minimumForQuorum: 'majority',
    countsAbsentees: false,
  },
};
