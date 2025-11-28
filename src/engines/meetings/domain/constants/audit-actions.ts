// src/engines/meetings/domain/constants/audit-actions.ts
//
// Audit action types for the Meetings module.
// These constants define the actionType values used in audit logs.

/**
 * Audit action types for meetings module operations.
 *
 * Usage with AuditService:
 * ```typescript
 * await auditService.logFromInput({
 *   ctx,
 *   actionType: MEETING_AUDIT_ACTIONS.SCHEDULED,
 *   targetType: 'Meeting',
 *   targetId: meeting.id,
 *   details: { bodyId: meeting.bodyId, scheduledStart: meeting.scheduledStart },
 * });
 * ```
 */
export const MEETING_AUDIT_ACTIONS = {
  // Meeting lifecycle
  SCHEDULED: 'MEETING_SCHEDULED',
  STARTED: 'MEETING_STARTED',
  RECESSED: 'MEETING_RECESSED',
  RESUMED: 'MEETING_RESUMED',
  ADJOURNED: 'MEETING_ADJOURNED',
  CANCELLED: 'MEETING_CANCELLED',

  // Notice
  NOTICE_POSTED: 'MEETING_NOTICE_POSTED',

  // Agenda
  AGENDA_CREATED: 'AGENDA_CREATED',
  AGENDA_ITEM_ADDED: 'AGENDA_ITEM_ADDED',
  AGENDA_ITEM_UPDATED: 'AGENDA_ITEM_UPDATED',
  AGENDA_ITEM_REMOVED: 'AGENDA_ITEM_REMOVED',
  AGENDA_SUBMITTED: 'AGENDA_SUBMITTED_FOR_APPROVAL',
  AGENDA_APPROVED: 'AGENDA_APPROVED',
  AGENDA_PUBLISHED: 'AGENDA_PUBLISHED',

  // Executive sessions
  EXEC_SESSION_CREATED: 'EXEC_SESSION_CREATED',
  EXEC_SESSION_ENTERED: 'EXEC_SESSION_ENTERED',
  EXEC_SESSION_ENDED: 'EXEC_SESSION_ENDED',
  EXEC_SESSION_CERTIFIED: 'EXEC_SESSION_CERTIFIED',
  EXEC_SESSION_CANCELLED: 'EXEC_SESSION_CANCELLED',

  // Attendance and recusals
  ATTENDANCE_RECORDED: 'ATTENDANCE_RECORDED',
  MEMBER_DEPARTED: 'MEMBER_DEPARTED',
  RECUSAL_RECORDED: 'RECUSAL_RECORDED',

  // Actions and voting
  ACTION_CREATED: 'ACTION_CREATED',
  ACTION_SECONDED: 'ACTION_SECONDED',
  VOTE_RECORDED: 'VOTE_RECORDED',
  VOTING_CLOSED: 'VOTING_CLOSED',

  // Minutes
  MINUTES_CREATED: 'MINUTES_CREATED',
  MINUTES_UPDATED: 'MINUTES_UPDATED',
  MINUTES_SUBMITTED: 'MINUTES_SUBMITTED_FOR_APPROVAL',
  MINUTES_APPROVED: 'MINUTES_APPROVED',
  MINUTES_AMENDED: 'MINUTES_AMENDED',

  // Media
  MEDIA_UPLOADED: 'MEDIA_UPLOADED',

  // Record bundles
  RECORD_BUNDLE_ASSEMBLED: 'RECORD_BUNDLE_ASSEMBLED',

  // Notice & Publication
  NOTICE_REQUIREMENT_GENERATED: 'NOTICE_REQUIREMENT_GENERATED',
  NOTICE_DELIVERY_RECORDED: 'NOTICE_DELIVERY_RECORDED',
  NOTICE_DELIVERY_SUBMITTED: 'NOTICE_DELIVERY_SUBMITTED',
  NOTICE_DELIVERY_CONFIRMED: 'NOTICE_DELIVERY_CONFIRMED',
  NOTICE_REQUIREMENT_SATISFIED: 'NOTICE_REQUIREMENT_SATISFIED',
  NOTICE_REQUIREMENT_FAILED: 'NOTICE_REQUIREMENT_FAILED',
  NOTICE_REQUIREMENT_WAIVED: 'NOTICE_REQUIREMENT_WAIVED',
  DEADLINE_RISK_ESCALATED: 'DEADLINE_RISK_ESCALATED',
  PUBLICATION_RULES_SEEDED: 'PUBLICATION_RULES_SEEDED',

  // Compliance violations (severity: warning or error)
  COMPLIANCE_VIOLATION: 'COMPLIANCE_VIOLATION',

  // Findings of Fact
  FINDINGS_CREATED: 'FINDINGS_CREATED',
  FINDINGS_STAFF_UPDATED: 'FINDINGS_STAFF_RECOMMENDATION_UPDATED',
  FINDINGS_BOARD_UPDATED: 'FINDINGS_BOARD_DETERMINATION_UPDATED',
  FINDINGS_SUBMITTED_FOR_REVIEW: 'FINDINGS_SUBMITTED_FOR_REVIEW',
  FINDINGS_ADOPTED: 'FINDINGS_ADOPTED',
  FINDINGS_REJECTED: 'FINDINGS_REJECTED',
  FINDINGS_DOCUMENT_GENERATED: 'FINDINGS_DOCUMENT_GENERATED',
  FINDINGS_VALIDATION_FAILED: 'FINDINGS_VALIDATION_FAILED',
  FINDINGS_CONDITION_ADDED: 'FINDINGS_CONDITION_ADDED',
  FINDINGS_CONDITION_UPDATED: 'FINDINGS_CONDITION_UPDATED',
  FINDINGS_CONDITION_REMOVED: 'FINDINGS_CONDITION_REMOVED',
} as const;

export type MeetingAuditAction =
  (typeof MEETING_AUDIT_ACTIONS)[keyof typeof MEETING_AUDIT_ACTIONS];

/**
 * Helper to create audit details for a state transition.
 */
export function createTransitionDetails(
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string,
  additionalDetails?: Record<string, unknown>
): Record<string, unknown> {
  return {
    entityType,
    entityId,
    transition: {
      from: fromStatus,
      to: toStatus,
    },
    ...additionalDetails,
  };
}

/**
 * Helper to create audit details for compliance violations.
 */
export function createComplianceViolationDetails(
  code: string,
  statutoryCite: string | undefined,
  details?: Record<string, unknown>
): Record<string, unknown> {
  return {
    violationType: code,
    statutoryCite,
    ...details,
  };
}
