// src/engines/meetings/domain/constants/indiana.constants.ts
//
// Indiana statutory constants for meetings module compliance.
// These constants encode legal requirements from Indiana Code.

/**
 * Indiana timezone constants.
 * Most of Indiana observes Eastern Time, but some northwest and southwest
 * counties observe Central Time. Default to Eastern (Indianapolis).
 */
export const INDIANA_TIMEZONES = {
  /** Eastern Time (majority of state, including Indianapolis). */
  eastern: 'America/Indiana/Indianapolis',
  /** Central Time (northwest and southwest counties). */
  central: 'America/Chicago',
  /** Default timezone for Indiana municipalities. */
  default: 'America/Indiana/Indianapolis',
} as const;

/**
 * Indiana Open Door Law requirements (IC 5-14-1.5).
 */
export const INDIANA_OPEN_DOOR = {
  /** Standard meeting notice hours (48 business hours). */
  standardNoticeHours: 48,

  /** Emergency meeting notice hours (notice ASAP, no minimum). */
  emergencyNoticeHours: 0,

  /** Statute reference for notice requirements. */
  noticeCite: 'IC 5-14-1.5-5',

  /** Statute reference for executive sessions. */
  execSessionCite: 'IC 5-14-1.5-6.1',

  /** Statute reference for minutes requirements. */
  minutesCite: 'IC 5-14-1.5-4',

  /** Default timezone for notice calculations. */
  defaultTimezone: INDIANA_TIMEZONES.default,
} as const;

/**
 * Indiana publication requirements (IC 5-3-1).
 */
export const INDIANA_PUBLICATION = {
  /** Days before general hearing. */
  generalHearingDays: 10,

  /** Number of publications for general hearing. */
  generalPublicationCount: 2,

  /** Days before bond hearing. */
  bondHearingDays: 10,

  /** Number of publications for bond hearing. */
  bondPublicationCount: 2,

  /** Bond publications must be consecutive weeks. */
  bondConsecutiveWeeks: true,

  /** Days before budget hearing. */
  budgetHearingDays: 10,

  /** Days before zoning hearing. */
  zoningHearingDays: 10,

  /** Number of publications for zoning hearing. */
  zoningPublicationCount: 1,

  /** Main publication statute. */
  statutoryCite: 'IC 5-3-1',
} as const;

/**
 * Structured Indiana publication rules for seeding.
 * Each rule defines the statutory notice requirements for a specific type of hearing.
 */
export interface IndianaPublicationRuleDefinition {
  /** Rule type identifier. */
  ruleType: string;
  /** Required number of publications. */
  requiredPublications: number;
  /** Required lead time in days before hearing. */
  requiredLeadDays: number;
  /** Whether publications must be in consecutive weeks. */
  mustBeConsecutive: boolean;
  /** Required publication channels. */
  requiredChannels: string[];
  /** Indiana Code citation. */
  statutoryCite: string;
  /** Human-readable description. */
  description: string;
}

export const INDIANA_PUBLICATION_RULES: readonly IndianaPublicationRuleDefinition[] = [
  {
    ruleType: 'OPEN_DOOR_MEETING',
    requiredPublications: 0,
    requiredLeadDays: 0,
    mustBeConsecutive: false,
    requiredChannels: ['WEBSITE', 'PHYSICAL_POSTING'],
    statutoryCite: 'IC 5-14-1.5-5',
    description: 'Open Door Law meeting notice - 48 hours posting required, no newspaper publication',
  },
  {
    ruleType: 'GENERAL_PUBLIC_HEARING',
    requiredPublications: 2,
    requiredLeadDays: 10,
    mustBeConsecutive: false,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 5-3-1-2(f)',
    description: 'General public hearing requiring two publications at least 10 days before hearing',
  },
  {
    ruleType: 'ZONING_MAP_AMENDMENT',
    requiredPublications: 1,
    requiredLeadDays: 10,
    mustBeConsecutive: false,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 36-7-4-602',
    description: 'Zoning map amendment hearing requiring one publication at least 10 days before',
  },
  {
    ruleType: 'VARIANCE_HEARING',
    requiredPublications: 1,
    requiredLeadDays: 10,
    mustBeConsecutive: false,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 36-7-4-920',
    description: 'BZA variance hearing requiring one publication at least 10 days before',
  },
  {
    ruleType: 'BOND_HEARING',
    requiredPublications: 2,
    requiredLeadDays: 10,
    mustBeConsecutive: true,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 6-1.1-20-3.1',
    description: 'Bond issuance hearing requiring two consecutive weekly publications',
  },
  {
    ruleType: 'BUDGET_HEARING',
    requiredPublications: 2,
    requiredLeadDays: 10,
    mustBeConsecutive: true,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 6-1.1-17-3',
    description: 'Budget adoption hearing requiring two consecutive weekly publications',
  },
  {
    ruleType: 'ANNEXATION_HEARING',
    requiredPublications: 1,
    requiredLeadDays: 20,
    mustBeConsecutive: false,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 36-4-3-2.2',
    description: 'Annexation hearing requiring one publication at least 20 days before',
  },
  {
    ruleType: 'TAX_ABATEMENT_HEARING',
    requiredPublications: 1,
    requiredLeadDays: 10,
    mustBeConsecutive: false,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 6-1.1-12.1-2.5',
    description: 'Tax abatement hearing requiring one publication at least 10 days before',
  },
  {
    ruleType: 'ECONOMIC_DEVELOPMENT_HEARING',
    requiredPublications: 2,
    requiredLeadDays: 10,
    mustBeConsecutive: false,
    requiredChannels: ['NEWSPAPER'],
    statutoryCite: 'IC 36-7-12-10',
    description: 'Economic development area designation hearing',
  },
] as const;

/**
 * Get a publication rule definition by type.
 */
export function getPublicationRule(
  ruleType: string
): IndianaPublicationRuleDefinition | undefined {
  return INDIANA_PUBLICATION_RULES.find((r) => r.ruleType === ruleType);
}

/**
 * Indiana executive session legal bases (IC 5-14-1.5-6.1).
 */
export interface ExecSessionBasis {
  /** Short code for the basis. */
  code: string;
  /** Statutory citation. */
  cite: string;
  /** Human-readable description. */
  description: string;
  /** Subsection of the statute. */
  subsection: string;
}

export const INDIANA_EXEC_SESSION_BASES: readonly ExecSessionBasis[] = [
  {
    code: 'PERSONNEL',
    cite: 'IC 5-14-1.5-6.1(b)(6)',
    subsection: '(b)(6)',
    description:
      'Discussion of job performance evaluation of individual employees',
  },
  {
    code: 'COLLECTIVE_BARGAINING',
    cite: 'IC 5-14-1.5-6.1(b)(4)',
    subsection: '(b)(4)',
    description:
      'Discussion of strategy regarding collective bargaining or labor negotiations',
  },
  {
    code: 'INITIATION_OF_LITIGATION',
    cite: 'IC 5-14-1.5-6.1(b)(2)(B)',
    subsection: '(b)(2)(B)',
    description:
      'Discussion of strategy with respect to initiation of litigation',
  },
  {
    code: 'PENDING_LITIGATION',
    cite: 'IC 5-14-1.5-6.1(b)(2)(B)',
    subsection: '(b)(2)(B)',
    description:
      'Discussion of strategy with respect to litigation that is pending or has been threatened',
  },
  {
    code: 'SECURITY',
    cite: 'IC 5-14-1.5-6.1(b)(7)',
    subsection: '(b)(7)',
    description:
      'Discussion of records classified as confidential by state or federal statute',
  },
  {
    code: 'PURCHASE_LEASE',
    cite: 'IC 5-14-1.5-6.1(b)(2)(D)',
    subsection: '(b)(2)(D)',
    description:
      'Discussion of purchase or lease of real property before competitive or public offering',
  },
  {
    code: 'SCHOOL_SAFETY',
    cite: 'IC 5-14-1.5-6.1(b)(8)',
    subsection: '(b)(8)',
    description:
      'Discussion of school safety and security measures',
  },
  {
    code: 'INDUSTRIAL_PROSPECT',
    cite: 'IC 5-14-1.5-6.1(b)(5)',
    subsection: '(b)(5)',
    description:
      'Receipt of information about prospective employee or industrial/commercial prospect',
  },
  {
    code: 'MISSING_CHILD',
    cite: 'IC 5-14-1.5-6.1(b)(1)',
    subsection: '(b)(1)',
    description: 'Discussion of strategy for missing or exploited children',
  },
] as const;

/**
 * Get an executive session basis by code.
 */
export function getExecSessionBasis(
  code: string
): ExecSessionBasis | undefined {
  return INDIANA_EXEC_SESSION_BASES.find((b) => b.code === code);
}

/**
 * Indiana variance criteria for BZA/planning (IC 36-7-4-918).
 */
export const INDIANA_VARIANCE_CRITERIA = {
  developmentStandards: {
    cite: 'IC 36-7-4-918.5',
    shortTitle: 'Development Standards Variance',
    criteria: [
      'Not injurious to public health, safety, morals, and general welfare',
      'Use and value of adjacent area will not be substantially adversely affected',
      'Strict application results in practical difficulties in use of property',
    ] as const,
  },
  useVariance: {
    cite: 'IC 36-7-4-918.4',
    shortTitle: 'Use Variance',
    criteria: [
      'Not injurious to public health, safety, morals, and general welfare',
      'Use and value of adjacent area will not be substantially adversely affected',
      'Need arises from condition peculiar to property',
      'Strict application results in unnecessary hardship',
      'Will not interfere with or adversely affect comprehensive plan',
    ] as const,
  },
} as const;

/**
 * Detailed findings criteria templates for Indiana variance types.
 * These templates include the full criterion text as used in official findings documents.
 */
export interface FindingsCriterionDefinition {
  criterionNumber: number;
  criterionText: string;
  statutoryCite: string;
  isRequired: boolean;
  guidanceNotes?: string;
}

export interface FindingsTemplateDefinition {
  caseType: string;
  templateName: string;
  statutoryCite: string;
  criteria: FindingsCriterionDefinition[];
}

/**
 * Development Standards Variance criteria per IC 36-7-4-918.5.
 * BZA must find ALL three criteria are met to approve.
 */
export const DEVELOPMENT_VARIANCE_TEMPLATE: FindingsTemplateDefinition = {
  caseType: 'DEVELOPMENT_VARIANCE',
  templateName: 'Indiana Development Standards Variance',
  statutoryCite: 'IC 36-7-4-918.5',
  criteria: [
    {
      criterionNumber: 1,
      criterionText:
        'The approval will not be injurious to the public health, safety, morals, and general welfare of the community.',
      statutoryCite: 'IC 36-7-4-918.5(a)(1)',
      isRequired: true,
      guidanceNotes:
        'Consider impacts on neighboring properties, traffic, noise, lighting, and community character. Document specific evidence supporting the determination.',
    },
    {
      criterionNumber: 2,
      criterionText:
        'The use and value of the area adjacent to the property included in the variance will not be affected in a substantially adverse manner.',
      statutoryCite: 'IC 36-7-4-918.5(a)(2)',
      isRequired: true,
      guidanceNotes:
        'Consider property values, visual impact, compatibility with surrounding uses. May request appraisal or expert testimony.',
    },
    {
      criterionNumber: 3,
      criterionText:
        'The strict application of the terms of the zoning ordinance will result in practical difficulties in the use of the property.',
      statutoryCite: 'IC 36-7-4-918.5(a)(3)',
      isRequired: true,
      guidanceNotes:
        'This is NOT a hardship standard. Practical difficulties means the property cannot be used reasonably for a permitted purpose without the variance. Self-created difficulties may weigh against approval.',
    },
  ],
};

/**
 * Use Variance criteria per IC 36-7-4-918.4.
 * BZA must find ALL five criteria are met to approve.
 * NOTE: Use variances are only available in Advisory or Metropolitan Plan Commission jurisdictions.
 * Area Plan Commissions cannot grant use variances.
 */
export const USE_VARIANCE_TEMPLATE: FindingsTemplateDefinition = {
  caseType: 'USE_VARIANCE',
  templateName: 'Indiana Use Variance',
  statutoryCite: 'IC 36-7-4-918.4',
  criteria: [
    {
      criterionNumber: 1,
      criterionText:
        'The approval will not be injurious to the public health, safety, morals, and general welfare of the community.',
      statutoryCite: 'IC 36-7-4-918.4(a)(1)',
      isRequired: true,
      guidanceNotes:
        'Consider impacts on neighboring properties, traffic, noise, lighting, and community character.',
    },
    {
      criterionNumber: 2,
      criterionText:
        'The use and value of the area adjacent to the property included in the variance will not be affected in a substantially adverse manner.',
      statutoryCite: 'IC 36-7-4-918.4(a)(2)',
      isRequired: true,
      guidanceNotes:
        'Consider property values, visual impact, compatibility with surrounding uses.',
    },
    {
      criterionNumber: 3,
      criterionText:
        'The need for the variance arises from some condition peculiar to the property involved.',
      statutoryCite: 'IC 36-7-4-918.4(a)(3)',
      isRequired: true,
      guidanceNotes:
        'The condition must be unique to this property, not common to the neighborhood. Self-imposed conditions do not satisfy this criterion.',
    },
    {
      criterionNumber: 4,
      criterionText:
        'The strict application of the terms of the zoning ordinance will constitute an unnecessary hardship if applied to the property for which the variance is sought.',
      statutoryCite: 'IC 36-7-4-918.4(a)(4)',
      isRequired: true,
      guidanceNotes:
        'Hardship standard is stricter than practical difficulties. Must show the property cannot yield a reasonable return or be put to beneficial use without the variance.',
    },
    {
      criterionNumber: 5,
      criterionText:
        'The approval does not interfere substantially with the comprehensive plan adopted under the 500 series.',
      statutoryCite: 'IC 36-7-4-918.4(a)(5)',
      isRequired: true,
      guidanceNotes:
        'Review the comprehensive plan land use map and goals. Document how the use variance is or is not consistent with the plan.',
    },
  ],
};

/**
 * Special Exception criteria - these come from local ordinance, not state law.
 * This is an empty template that tenants can customize.
 */
export const SPECIAL_EXCEPTION_TEMPLATE: FindingsTemplateDefinition = {
  caseType: 'SPECIAL_EXCEPTION',
  templateName: 'Special Exception (Local Ordinance)',
  statutoryCite: 'Local Zoning Ordinance',
  criteria: [],
};

/**
 * Subdivision Waiver template - similar to development variance.
 */
export const SUBDIVISION_WAIVER_TEMPLATE: FindingsTemplateDefinition = {
  caseType: 'SUBDIVISION_WAIVER',
  templateName: 'Subdivision Waiver',
  statutoryCite: 'IC 36-7-4-702',
  criteria: [
    {
      criterionNumber: 1,
      criterionText:
        'The waiver will not be injurious to the public health, safety, morals, and general welfare of the community.',
      statutoryCite: 'IC 36-7-4-702',
      isRequired: true,
      guidanceNotes:
        'Consider infrastructure impacts, emergency access, and public safety.',
    },
    {
      criterionNumber: 2,
      criterionText:
        'The waiver will not adversely affect the orderly development of the subdivision or surrounding area.',
      statutoryCite: 'IC 36-7-4-702',
      isRequired: true,
      guidanceNotes:
        'Consider lot layout, access, utilities, and drainage patterns.',
    },
    {
      criterionNumber: 3,
      criterionText:
        'Strict application of the subdivision control ordinance will result in practical difficulties.',
      statutoryCite: 'IC 36-7-4-702',
      isRequired: true,
      guidanceNotes:
        'Document the specific subdivision requirement being waived and why strict compliance is impractical.',
    },
  ],
};

/**
 * All default findings templates.
 */
export const INDIANA_FINDINGS_TEMPLATES: readonly FindingsTemplateDefinition[] = [
  DEVELOPMENT_VARIANCE_TEMPLATE,
  USE_VARIANCE_TEMPLATE,
  SPECIAL_EXCEPTION_TEMPLATE,
  SUBDIVISION_WAIVER_TEMPLATE,
] as const;

/**
 * Get findings template by case type.
 */
export function getFindingsTemplate(
  caseType: string
): FindingsTemplateDefinition | undefined {
  return INDIANA_FINDINGS_TEMPLATES.find((t) => t.caseType === caseType);
}

/**
 * Indiana records retention for meeting documents.
 */
export const INDIANA_RETENTION = {
  /** Minutes retention in years. */
  minutesYears: 10,

  /** Agendas retention in years. */
  agendasYears: 5,

  /** Audio/video recording retention in days. */
  recordingsDays: 90,

  /** Executive session certifications retention in years. */
  execSessionCertsYears: 10,

  /** Reference. */
  cite: 'Indiana Local Government Records Retention Schedule',
} as const;

/**
 * Error codes for meetings compliance violations.
 */
export const MEETINGS_ERROR_CODES = {
  // Validation errors (4xx)
  NOT_FOUND: 'MEETINGS.NOT_FOUND',
  INVALID_TRANSITION: 'MEETINGS.INVALID_TRANSITION',
  INSUFFICIENT_NOTICE: 'MEETINGS.INSUFFICIENT_NOTICE',
  NO_QUORUM: 'MEETINGS.NO_QUORUM',
  EXEC_SESSION_ACTIVE: 'MEETINGS.EXEC_SESSION_ACTIVE',

  // Compliance errors
  OPEN_DOOR_VIOLATION: 'COMPLIANCE.OPEN_DOOR',
  PUBLICATION_DEADLINE_MISSED: 'COMPLIANCE.PUBLICATION',
  FINDINGS_REQUIRED: 'COMPLIANCE.FINDINGS_REQUIRED',
  EXEC_SESSION_UNCERTIFIED: 'COMPLIANCE.EXEC_SESSION_UNCERTIFIED',
  VOTE_DURING_EXEC_SESSION: 'COMPLIANCE.VOTE_DURING_EXEC_SESSION',
  RECUSED_MEMBER_VOTE: 'COMPLIANCE.RECUSED_MEMBER_VOTE',

  // Findings of Fact errors
  FINDINGS_INCOMPLETE: 'COMPLIANCE.FINDINGS_INCOMPLETE',
  FINDINGS_NOT_SUPPORTED: 'COMPLIANCE.FINDINGS_NOT_SUPPORTED',
  FINDINGS_LOCKED: 'COMPLIANCE.FINDINGS_LOCKED',
  FINDINGS_NOT_FOUND: 'FINDINGS.NOT_FOUND',
  CRITERION_NOT_FOUND: 'FINDINGS.CRITERION_NOT_FOUND',

  // Workflow errors
  AGENDA_NOT_PUBLISHED: 'WORKFLOW.AGENDA_NOT_PUBLISHED',
  MINUTES_NOT_APPROVED: 'WORKFLOW.MINUTES_NOT_APPROVED',
  ACTION_REQUIRES_SECOND: 'WORKFLOW.ACTION_REQUIRES_SECOND',
} as const;

export type MeetingsErrorCode =
  (typeof MEETINGS_ERROR_CODES)[keyof typeof MEETINGS_ERROR_CODES];
