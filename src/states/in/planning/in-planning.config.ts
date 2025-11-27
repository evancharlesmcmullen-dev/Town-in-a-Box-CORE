// src/states/in/planning/in-planning.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana Planning Configuration
 *
 * Configuration for planning, zoning, and BZA per IC 36-7-4.
 */
export interface INPlanningConfig extends DomainConfig {
  domain: 'planning';

  // Case types supported
  caseTypes: PlanningCaseType[];

  // Use variance criteria (stricter standard)
  useVarianceCriteria: VarianceCriterion[];

  // Development standards variance criteria
  developmentVarianceCriteria: VarianceCriterion[];

  // Notice requirements by case type
  noticeRequirements: Record<string, NoticeRequirement>;

  // Appeal deadlines
  appealDeadlines: AppealDeadline[];
}

/**
 * Planning/BZA case type.
 */
export interface PlanningCaseType {
  code: string;
  name: string;
  description: string;
  decidingBody: 'BZA' | 'PlanCommission' | 'LegislativeBody';
  requiresPublicHearing: boolean;
  citation?: StatutoryCitation;
}

/**
 * Variance criterion.
 */
export interface VarianceCriterion {
  id: string;
  description: string;
  citation?: StatutoryCitation;
}

/**
 * Notice requirement for a case type.
 */
export interface NoticeRequirement {
  mailedNoticeDays: number;
  publishedNoticeDays?: number;
  mailingRadius?: number; // feet
  signPostingRequired?: boolean;
  citation?: StatutoryCitation;
}

/**
 * Appeal deadline.
 */
export interface AppealDeadline {
  fromDecision: string;
  toBody: string;
  deadlineDays: number;
  citation?: StatutoryCitation;
}

/**
 * Default Indiana planning configuration.
 */
export const DEFAULT_IN_PLANNING_CONFIG: INPlanningConfig = {
  domain: 'planning',
  enabled: true,

  caseTypes: [
    {
      code: 'USE_VARIANCE',
      name: 'Use Variance',
      description: 'Variance to allow a use not permitted in the zoning district.',
      decidingBody: 'BZA',
      requiresPublicHearing: true,
      citation: { code: 'IC 36-7-4-918.4' },
    },
    {
      code: 'DEV_STANDARDS_VARIANCE',
      name: 'Development Standards Variance',
      description: 'Variance from setback, height, lot coverage, or other development standards.',
      decidingBody: 'BZA',
      requiresPublicHearing: true,
      citation: { code: 'IC 36-7-4-918.5' },
    },
    {
      code: 'SPECIAL_EXCEPTION',
      name: 'Special Exception',
      description: 'Special exception/conditional use for uses requiring specific approval.',
      decidingBody: 'BZA',
      requiresPublicHearing: true,
      citation: { code: 'IC 36-7-4-918.2' },
    },
    {
      code: 'REZONE',
      name: 'Rezone / Map Amendment',
      description: 'Change of zoning classification for a parcel.',
      decidingBody: 'LegislativeBody',
      requiresPublicHearing: true,
      citation: { code: 'IC 36-7-4-602' },
    },
    {
      code: 'PRIMARY_PLAT',
      name: 'Primary Plat',
      description: 'Primary subdivision plat approval.',
      decidingBody: 'PlanCommission',
      requiresPublicHearing: true,
    },
    {
      code: 'SECONDARY_PLAT',
      name: 'Secondary Plat',
      description: 'Secondary (final) subdivision plat approval.',
      decidingBody: 'PlanCommission',
      requiresPublicHearing: false,
    },
  ],

  useVarianceCriteria: [
    {
      id: 'practical-difficulty',
      description: 'Approval will not be injurious to the public health, safety, morals, and general welfare.',
    },
    {
      id: 'use-consistent',
      description: 'The use and value of adjacent property will not be affected substantially.',
    },
    {
      id: 'strict-application',
      description: 'Strict application of the terms of the zoning ordinance will result in practical difficulties.',
    },
  ],

  developmentVarianceCriteria: [
    {
      id: 'not-injurious',
      description: 'Approval will not be injurious to the public health, safety, morals, and general welfare.',
    },
    {
      id: 'not-affect-adjacent',
      description: 'The use and value of adjacent property will not be affected substantially.',
    },
    {
      id: 'practical-difficulty',
      description: 'Strict application would result in practical difficulties in the use of the property.',
    },
  ],

  noticeRequirements: {
    USE_VARIANCE: {
      mailedNoticeDays: 10,
      mailingRadius: 300,
      signPostingRequired: true,
      citation: { code: 'IC 36-7-4-920' },
    },
    DEV_STANDARDS_VARIANCE: {
      mailedNoticeDays: 10,
      mailingRadius: 300,
      signPostingRequired: true,
    },
    REZONE: {
      mailedNoticeDays: 10,
      publishedNoticeDays: 10,
      mailingRadius: 300,
      signPostingRequired: true,
      citation: { code: 'IC 36-7-4-604' },
    },
    PRIMARY_PLAT: {
      mailedNoticeDays: 10,
      mailingRadius: 300,
    },
  },

  appealDeadlines: [
    {
      fromDecision: 'BZA',
      toBody: 'Circuit Court',
      deadlineDays: 30,
      citation: { code: 'IC 36-7-4-1003' },
    },
    {
      fromDecision: 'PlanCommission',
      toBody: 'Circuit Court',
      deadlineDays: 30,
    },
  ],
};
