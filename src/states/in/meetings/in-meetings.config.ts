// src/states/in/meetings/in-meetings.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana Meetings Configuration
 *
 * Configuration for Open Door Law compliance per IC 5-14-1.5.
 */
export interface INMeetingsConfig extends DomainConfig {
  domain: 'meetings';

  // Default posting locations for notices
  defaultPostingLocations: PostingLocation[];

  // Whether electronic posting is enabled
  electronicPostingEnabled: boolean;

  // Allowed executive session topics
  allowedExecSessionTopics: ExecSessionTopic[];

  // Meeting minutes requirements
  minutesRequirements: MinutesRequirements;

  // Quorum rules
  quorumRules: QuorumRules;
}

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
 * Minutes requirements.
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
 */
export const DEFAULT_IN_MEETINGS_CONFIG: INMeetingsConfig = {
  domain: 'meetings',
  enabled: true,

  defaultPostingLocations: [
    {
      id: 'town-hall',
      name: 'Town Hall Bulletin Board',
      type: 'physical',
      isPrimary: true,
    },
  ],

  electronicPostingEnabled: true,

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

  minutesRequirements: {
    requiresMemoranda: true,
    retentionYears: 10,
    mustRecordVotes: true,
    mustRecordAbsences: true,
  },

  quorumRules: {
    minimumForQuorum: 'majority',
    countsAbsentees: false,
  },
};
