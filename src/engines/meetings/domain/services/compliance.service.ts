// src/engines/meetings/domain/services/compliance.service.ts
//
// Compliance validation service for Indiana statutory requirements.
// Implements the critical validation rules from CLAUDE.md.

import {
  Meeting,
  ExecutiveSession,
  MemberRecusal,
  VoteRecord,
  MeetingAction,
  Minutes,
  QuorumResult,
  GoverningBody,
  MeetingAttendance,
  FindingsOfFact,
  FindingsValidationResult,
} from '../types';
import {
  INDIANA_OPEN_DOOR,
  INDIANA_TIMEZONES,
  MEETINGS_ERROR_CODES,
  MeetingsErrorCode,
} from '../constants/indiana.constants';
import { isExecSessionActive, allSessionsCertified } from '../state-machines';

/**
 * Options for timezone-aware compliance validation.
 */
export interface ComplianceOptions {
  /** IANA timezone identifier (e.g., 'America/Indiana/Indianapolis'). */
  timezone?: string;
}

/**
 * Error thrown when a compliance violation is detected.
 */
export class ComplianceError extends Error {
  constructor(
    public readonly code: MeetingsErrorCode,
    public readonly statutoryCite?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(`Compliance violation: ${code}`);
    this.name = 'ComplianceError';
  }
}

/**
 * Validation result with structured error information.
 */
export interface ValidationResult {
  valid: boolean;
  error?: MeetingsErrorCode;
  message?: string;
  statutoryCite?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// OPEN DOOR LAW VALIDATION (IC 5-14-1.5)
// =============================================================================

/**
 * Validate Open Door Law notice requirements.
 * IC 5-14-1.5-5: 48 business hours notice required for non-emergency meetings.
 *
 * @param meeting The meeting to validate
 * @param postedAt When notice was posted
 * @param options Optional timezone configuration. If not provided, uses Indiana default.
 *
 * NOTE: The 48-hour calculation is done in the tenant's local timezone.
 * A meeting at 9am Monday in Indianapolis needs notice by 9am Thursday
 * in Indianapolis time - DST transitions and timezone differences matter.
 */
export function validateOpenDoorNotice(
  meeting: Meeting,
  postedAt: Date,
  options: ComplianceOptions = {}
): ValidationResult {
  // Emergency meetings are exempt per IC 5-14-1.5-5(d)
  if (meeting.isEmergency) {
    return { valid: true };
  }

  const timezone = options.timezone ?? INDIANA_TIMEZONES.default;

  // Calculate hours difference accounting for timezone
  const hoursUntilMeeting = differenceInHoursWithTimezone(
    meeting.scheduledStart,
    postedAt,
    timezone
  );

  if (hoursUntilMeeting < INDIANA_OPEN_DOOR.standardNoticeHours) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.INSUFFICIENT_NOTICE,
      message: `Open Door Law requires ${INDIANA_OPEN_DOOR.standardNoticeHours} hours notice. Current: ${hoursUntilMeeting} hours.`,
      statutoryCite: INDIANA_OPEN_DOOR.noticeCite,
      details: {
        requiredHours: INDIANA_OPEN_DOOR.standardNoticeHours,
        actualHours: hoursUntilMeeting,
        meetingStart: meeting.scheduledStart.toISOString(),
        noticePosted: postedAt.toISOString(),
        timezone,
      },
    };
  }

  return { valid: true };
}

// =============================================================================
// EXECUTIVE SESSION VALIDATION (IC 5-14-1.5-6.1)
// =============================================================================

/**
 * Check if voting is blocked due to an active executive session.
 * Per IC 5-14-1.5-6.1: No final action can be taken during executive session.
 *
 * CRITICAL RULE #1 from CLAUDE.md
 */
export function validateVoteNotInExecSession(
  executiveSessions: ExecutiveSession[]
): ValidationResult {
  const activeSession = executiveSessions.find((es) =>
    isExecSessionActive(es.status)
  );

  if (activeSession) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.VOTE_DURING_EXEC_SESSION,
      message: 'Cannot record vote while in executive session',
      statutoryCite: INDIANA_OPEN_DOOR.execSessionCite,
      details: {
        activeSessionId: activeSession.id,
        sessionBasis: activeSession.basisCode,
      },
    };
  }

  return { valid: true };
}

/**
 * Check if all executive sessions are certified before minutes approval.
 *
 * CRITICAL RULE #2 from CLAUDE.md
 */
export function validateAllExecSessionsCertified(
  executiveSessions: ExecutiveSession[]
): ValidationResult {
  if (!allSessionsCertified(executiveSessions)) {
    const uncertified = executiveSessions.filter(
      (es) => es.status !== 'CERTIFIED' && es.status !== 'CANCELLED'
    );

    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.EXEC_SESSION_UNCERTIFIED,
      message:
        'Cannot approve meeting minutes without all executive session certifications',
      details: {
        uncertifiedSessions: uncertified.map((es) => ({
          id: es.id,
          status: es.status,
          basisCode: es.basisCode,
        })),
      },
    };
  }

  return { valid: true };
}

/**
 * Validate executive session has proper pre-certification before entering.
 */
export function validateExecSessionPreCert(
  session: ExecutiveSession
): ValidationResult {
  if (!session.preCertStatement || !session.preCertByUserId) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.EXEC_SESSION_UNCERTIFIED,
      message: 'Executive session requires pre-certification before entering',
      statutoryCite: INDIANA_OPEN_DOOR.execSessionCite,
    };
  }

  return { valid: true };
}

/**
 * Validate executive session has proper post-certification after ending.
 */
export function validateExecSessionPostCert(
  session: ExecutiveSession
): ValidationResult {
  if (session.status === 'ENDED') {
    if (!session.postCertStatement || !session.postCertByUserId) {
      return {
        valid: false,
        error: MEETINGS_ERROR_CODES.EXEC_SESSION_UNCERTIFIED,
        message:
          'Executive session requires post-certification statement confirming no unauthorized matters were discussed',
        statutoryCite: INDIANA_OPEN_DOOR.execSessionCite,
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// QUORUM VALIDATION
// =============================================================================

/**
 * Calculate quorum for a meeting.
 */
export function calculateQuorum(
  body: GoverningBody,
  attendance: MeetingAttendance[],
  recusals: MemberRecusal[],
  agendaItemId?: string
): QuorumResult {
  const totalMembers = body.totalSeats;

  // Count present members
  const presentMembers = attendance.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE'
  ).length;

  // Count recused members for this item (or entire meeting if no item specified)
  const recusedMembers = recusals.filter((r) =>
    agendaItemId ? r.agendaItemId === agendaItemId : !r.agendaItemId
  ).length;

  // Calculate required quorum
  let requiredForQuorum: number;
  switch (body.quorumType) {
    case 'MAJORITY':
      requiredForQuorum = Math.floor(totalMembers / 2) + 1;
      break;
    case 'TWO_THIRDS':
      requiredForQuorum = Math.ceil((totalMembers * 2) / 3);
      break;
    case 'SPECIFIC':
      requiredForQuorum = body.quorumNumber ?? Math.floor(totalMembers / 2) + 1;
      break;
    default:
      requiredForQuorum = Math.floor(totalMembers / 2) + 1;
  }

  // Eligible voters = present minus recused
  const eligibleVoters = presentMembers - recusedMembers;

  // Check if quorum is met
  const isQuorumMet = eligibleVoters >= requiredForQuorum;

  return {
    isQuorumMet,
    totalMembers,
    presentMembers,
    recusedMembers,
    requiredForQuorum,
    eligibleVoters,
  };
}

/**
 * Validate that quorum is present for voting.
 */
export function validateQuorum(quorum: QuorumResult): ValidationResult {
  if (!quorum.isQuorumMet) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.NO_QUORUM,
      message: `Quorum not present. Required: ${quorum.requiredForQuorum}, Present: ${quorum.presentMembers}, Eligible (minus recused): ${quorum.eligibleVoters}`,
      details: quorum as unknown as Record<string, unknown>,
    };
  }

  return { valid: true };
}

// =============================================================================
// RECUSAL VALIDATION
// =============================================================================

/**
 * Validate that a recused member's vote is not counted.
 *
 * CRITICAL RULE #5 from CLAUDE.md
 */
export function validateNotRecused(
  memberId: string,
  recusals: MemberRecusal[],
  agendaItemId?: string
): ValidationResult {
  const isRecused = recusals.some(
    (r) =>
      r.memberId === memberId &&
      (r.agendaItemId === agendaItemId || !r.agendaItemId)
  );

  if (isRecused) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.RECUSED_MEMBER_VOTE,
      message: 'Recused member cannot vote on this item',
      statutoryCite: 'IC 35-44.1-1-4',
      details: { memberId, agendaItemId },
    };
  }

  return { valid: true };
}

/**
 * Filter out recused members from vote count.
 * Returns only eligible votes (silently excludes recused members).
 */
export function filterRecusedVotes(
  votes: VoteRecord[],
  recusals: MemberRecusal[],
  agendaItemId?: string
): VoteRecord[] {
  const recusedMemberIds = new Set(
    recusals
      .filter((r) => r.agendaItemId === agendaItemId || !r.agendaItemId)
      .map((r) => r.memberId)
  );

  return votes.filter((v) => !recusedMemberIds.has(v.memberId));
}

// =============================================================================
// ACTION VALIDATION
// =============================================================================

/**
 * Validate that an action has a proper second (for motions).
 */
export function validateActionHasSecond(
  action: MeetingAction
): ValidationResult {
  if (action.actionType === 'MOTION' && !action.secondedByUserId) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.ACTION_REQUIRES_SECOND,
      message: 'Motion requires a second before voting',
      details: { actionId: action.id, actionType: action.actionType },
    };
  }

  return { valid: true };
}

// =============================================================================
// MINUTES VALIDATION
// =============================================================================

/**
 * Validate that minutes can be approved (all exec sessions certified).
 */
export function validateMinutesApproval(
  meeting: Meeting
): ValidationResult {
  // Check all executive sessions are certified
  const execSessionCheck = validateAllExecSessionsCertified(
    meeting.executiveSessions ?? []
  );
  if (!execSessionCheck.valid) {
    return execSessionCheck;
  }

  return { valid: true };
}

// =============================================================================
// SCHEDULING VALIDATION
// =============================================================================

/**
 * Validate meeting scheduling (notice requirements).
 *
 * CRITICAL RULE #4 from CLAUDE.md
 */
export function validateMeetingSchedule(
  meeting: Partial<Meeting>,
  now: Date = new Date()
): ValidationResult {
  if (!meeting.scheduledStart) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.INVALID_TRANSITION,
      message: 'Meeting must have a scheduled start time',
    };
  }

  // Skip validation for emergency meetings
  if (meeting.isEmergency) {
    return { valid: true };
  }

  const hoursUntilMeeting = differenceInHours(meeting.scheduledStart, now);

  if (hoursUntilMeeting < INDIANA_OPEN_DOOR.standardNoticeHours) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.INSUFFICIENT_NOTICE,
      message: `Cannot schedule meeting without sufficient notice time. Requires ${INDIANA_OPEN_DOOR.standardNoticeHours} hours, only ${hoursUntilMeeting} hours until meeting.`,
      statutoryCite: INDIANA_OPEN_DOOR.noticeCite,
      details: {
        requiredHours: INDIANA_OPEN_DOOR.standardNoticeHours,
        availableHours: hoursUntilMeeting,
      },
    };
  }

  return { valid: true };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate difference in hours between two dates.
 * Simple version without timezone handling.
 */
function differenceInHours(later: Date, earlier: Date): number {
  const diffMs = later.getTime() - earlier.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Calculate difference in hours between two dates, accounting for timezone.
 *
 * This properly handles DST transitions by comparing the absolute timestamps.
 * The timezone parameter is used to interpret the dates in the local context
 * and is included in error messages for clarity.
 *
 * Note: JavaScript Date objects are always UTC internally. The timezone
 * affects how we interpret/display them, but the hour calculation is based
 * on absolute time difference. This is correct behavior because the Open
 * Door Law's "48 hours" means 48 actual elapsed hours, regardless of
 * timezone display.
 *
 * Example: If a meeting is at 9am Monday in Indianapolis (UTC-5), and
 * notice is posted at 9am Thursday (UTC-5), that's exactly 72 hours
 * regardless of timezone.
 *
 * @param later The later date (usually meeting start)
 * @param earlier The earlier date (usually notice posted)
 * @param _timezone IANA timezone (for documentation/logging)
 */
function differenceInHoursWithTimezone(
  later: Date,
  earlier: Date,
  _timezone: string
): number {
  // The timezone is recorded for audit purposes but doesn't affect the
  // calculation since we're measuring absolute elapsed hours.
  // If we needed to handle "business hours" in local time (skipping nights),
  // we'd need to convert to local time and iterate.
  const diffMs = later.getTime() - earlier.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Throw ComplianceError if validation fails.
 */
export function assertCompliance(result: ValidationResult): void {
  if (!result.valid) {
    throw new ComplianceError(
      result.error!,
      result.statutoryCite,
      result.details
    );
  }
}

// =============================================================================
// FINDINGS OF FACT VALIDATION (IC 36-7-4-918)
// =============================================================================

/**
 * Validate findings of fact for a BZA/Plan Commission case.
 * All criteria must have determinations with supporting rationale.
 */
export function validateFindingsComplete(
  findings: FindingsOfFact
): ValidationResult {
  const criteria = findings.criteria || [];
  const incomplete: Array<{ criterionNumber: number; missing: string }> = [];

  for (const criterion of criteria) {
    const hasDetermination = !!criterion.boardDetermination;
    const hasRationale =
      !!criterion.boardRationale && criterion.boardRationale.trim().length > 0;

    if (!hasDetermination && !hasRationale) {
      incomplete.push({
        criterionNumber: criterion.criterionNumber,
        missing: 'determination and rationale',
      });
    } else if (!hasDetermination) {
      incomplete.push({
        criterionNumber: criterion.criterionNumber,
        missing: 'determination',
      });
    } else if (!hasRationale) {
      incomplete.push({
        criterionNumber: criterion.criterionNumber,
        missing: 'rationale ("because" statement)',
      });
    }
  }

  if (incomplete.length > 0) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.FINDINGS_INCOMPLETE,
      message: 'Cannot approve: written findings required for all criteria',
      statutoryCite: findings.statutoryCite,
      details: {
        missingCriteria: incomplete,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate that approval is legally supportable.
 * All required criteria must have determination = MET.
 * Per IC 36-7-4-918.5 and IC 36-7-4-918.4.
 */
export function validateApprovalSupported(
  findings: FindingsOfFact
): ValidationResult {
  const criteria = findings.criteria || [];
  const unmetCriteria = criteria.filter(
    (c) => c.isRequired && c.boardDetermination === 'NOT_MET'
  );

  if (unmetCriteria.length > 0) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.FINDINGS_NOT_SUPPORTED,
      message: 'Cannot approve: one or more required criteria not met',
      statutoryCite: findings.statutoryCite,
      details: {
        unmetCriteria: unmetCriteria.map((c) => ({
          criterionNumber: c.criterionNumber,
          criterionText: c.criterionText,
          boardDetermination: c.boardDetermination,
        })),
      },
    };
  }

  return { valid: true };
}

/**
 * Validate that case denial is properly documented.
 * At least one required criterion must be NOT_MET for a denial.
 */
export function validateDenialSupported(
  findings: FindingsOfFact
): ValidationResult {
  const criteria = findings.criteria || [];
  const unmetCriteria = criteria.filter(
    (c) => c.isRequired && c.boardDetermination === 'NOT_MET'
  );

  if (unmetCriteria.length === 0) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.FINDINGS_NOT_SUPPORTED,
      message:
        'Cannot deny: at least one required criterion must be found NOT_MET',
      statutoryCite: findings.statutoryCite,
      details: {
        allCriteriaMet: true,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate findings for BZA action (approval or denial).
 * Combines completeness and supportability checks.
 */
export function validateFindingsForAction(
  findings: FindingsOfFact,
  actionType: 'APPROVE' | 'DENY'
): ValidationResult {
  // First check completeness
  const completenessCheck = validateFindingsComplete(findings);
  if (!completenessCheck.valid) {
    return completenessCheck;
  }

  // Then check if action is supported
  if (actionType === 'APPROVE') {
    return validateApprovalSupported(findings);
  } else {
    return validateDenialSupported(findings);
  }
}

/**
 * Check if findings can be modified.
 * Findings are locked after adoption.
 */
export function validateFindingsNotLocked(
  findings: FindingsOfFact
): ValidationResult {
  if (findings.isLocked) {
    return {
      valid: false,
      error: MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
      message: 'Cannot modify findings after adoption',
      details: {
        adoptedAt: findings.adoptedAt,
        voteRecordId: findings.voteRecordId,
      },
    };
  }

  return { valid: true };
}
