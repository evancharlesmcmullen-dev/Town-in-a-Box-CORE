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

  // Workflow errors
  AGENDA_NOT_PUBLISHED: 'WORKFLOW.AGENDA_NOT_PUBLISHED',
  MINUTES_NOT_APPROVED: 'WORKFLOW.MINUTES_NOT_APPROVED',
  ACTION_REQUIRES_SECOND: 'WORKFLOW.ACTION_REQUIRES_SECOND',
} as const;

export type MeetingsErrorCode =
  (typeof MEETINGS_ERROR_CODES)[keyof typeof MEETINGS_ERROR_CODES];
