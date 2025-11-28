// src/core/records/apra-workflow.types.ts
//
// APRA Request Workflow Types
//
// These types define the workflow model for APRA (Access to Public Records Act) requests.
// They capture status, deadlines, and transitions independent of storage/transport.

import { INApraConfig } from '../../states/in/apra/in-apra.config';

/**
 * Status of an APRA request through its lifecycle.
 *
 * Extended status model for workflow tracking:
 * - RECEIVED: Initial state when request is logged
 * - ACKNOWLEDGED: Agency has acknowledged receipt (optional intermediate state)
 * - IN_REVIEW: Staff is searching for and reviewing responsive records
 * - NEEDS_CLARIFICATION: Waiting for requester to clarify their request
 * - ON_HOLD: Request is on hold (e.g., fee payment pending, extension requested)
 * - FULFILLED: All responsive records have been delivered
 * - DENIED: Request denied (must cite specific exemption)
 * - PARTIALLY_FULFILLED: Some records delivered, some withheld
 * - CLOSED: Request administratively closed (withdrawn, abandoned, etc.)
 */
export type ApraRequestStatus =
  | 'RECEIVED'
  | 'ACKNOWLEDGED'
  | 'IN_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'ON_HOLD'
  | 'FULFILLED'
  | 'DENIED'
  | 'PARTIALLY_FULFILLED'
  | 'CLOSED';

/**
 * Deadline information for an APRA request.
 *
 * Tracks the initial statutory deadline and any extensions.
 * Per IC 5-14-3-9(a), agencies must respond within 7 business days.
 */
export interface ApraDeadlineInfo {
  /**
   * Initial due date (receivedAt + standardResponseDays).
   * This is the statutory deadline per IC 5-14-3-9.
   */
  initialDueDate: Date;

  /**
   * Extended due date if an extension was granted.
   * Some complex requests may qualify for additional time.
   */
  extendedDueDate?: Date;

  /**
   * Whether the deadline is calculated using business days only.
   * Per IC 5-14-3-9(a), Indiana uses business days (excludes weekends/holidays).
   */
  usesBusinessDays: boolean;
}

/**
 * A status transition record for audit trail.
 *
 * Captures who changed the status, when, and why.
 * Essential for compliance and accountability.
 */
export interface ApraStatusTransition {
  /** Previous status before the transition */
  from: ApraRequestStatus;

  /** New status after the transition */
  to: ApraRequestStatus;

  /** Optional reason for the status change */
  reason?: string;

  /** User/staff who made the change (for audit) */
  changedBy?: string;

  /** When the change occurred */
  changedAt: Date;
}

/**
 * Complete workflow context for an APRA request.
 *
 * This is the "brain" of a request - it tracks:
 * - Current status
 * - Computed deadlines
 * - Full transition history
 * - Config snapshot (for deadline recalculation if needed)
 *
 * Design principle: This is pure workflow logic, decoupled from storage.
 * Persistence layers can serialize/deserialize this context as needed.
 */
export interface ApraRequestWorkflowContext {
  /** Unique identifier for the request */
  requestId: string;

  /** Tenant this request belongs to */
  tenantId: string;

  /** When the request was received (determines deadline start) */
  receivedAt: Date;

  /** Current workflow status */
  currentStatus: ApraRequestStatus;

  /** Computed deadline information */
  deadlines: ApraDeadlineInfo;

  /** Full history of status transitions */
  transitions: ApraStatusTransition[];

  /**
   * Snapshot of relevant config values at workflow initialization.
   * Used for deadline recalculation and audit purposes.
   */
  configSnapshot: ApraWorkflowConfigSnapshot;
}

/**
 * Subset of INApraConfig relevant to workflow processing.
 *
 * We store a snapshot to ensure consistent behavior even if
 * tenant config changes after the request is created.
 *
 * The index signature allows this to be compatible with Partial<INApraConfig>
 * for deadline calculation functions.
 */
export interface ApraWorkflowConfigSnapshot {
  /** Standard response deadline in days */
  standardResponseDays?: number;

  /** Extension response deadline in days */
  extensionResponseDays?: number;

  /** Whether deadlines use business days only */
  businessDaysOnly?: boolean;

  /** Whether copy fees are allowed */
  allowCopyFees?: boolean;

  /** Default per-page fee for copies */
  defaultPerPageFee?: number;

  /** Whether electronic copy fees are allowed */
  allowElectronicCopyFees?: boolean;

  /** Minutes of search time without charge */
  maxSearchTimeWithoutChargeMinutes?: number;

  /** Whether requests are logged */
  logRequests?: boolean;

  /** Years to retain request logs */
  requestLogRetentionYears?: number;

  /** Allow extension for compatibility with INApraConfig */
  [key: string]: unknown;
}

/**
 * Check if a status is a terminal (final) status.
 *
 * Terminal statuses cannot transition to other statuses.
 * Once a request reaches a terminal status, it's considered complete.
 *
 * @param status - The status to check
 * @returns true if the status is terminal
 */
export function isTerminalStatus(status: ApraRequestStatus): boolean {
  return status === 'CLOSED';
}

/**
 * Check if a status represents a completed request.
 *
 * Completed statuses are those where the request has been resolved,
 * though not necessarily closed yet.
 *
 * @param status - The status to check
 * @returns true if the status represents completion
 */
export function isCompletedStatus(status: ApraRequestStatus): boolean {
  return (
    status === 'FULFILLED' ||
    status === 'DENIED' ||
    status === 'PARTIALLY_FULFILLED' ||
    status === 'CLOSED'
  );
}

/**
 * Check if a status pauses the deadline clock.
 *
 * Certain statuses pause the statutory deadline:
 * - NEEDS_CLARIFICATION: Clock restarts when response received
 * - ON_HOLD: Clock may be paused depending on hold reason
 *
 * @param status - The status to check
 * @returns true if the deadline clock is paused
 */
export function isDeadlinePausedStatus(status: ApraRequestStatus): boolean {
  return status === 'NEEDS_CLARIFICATION' || status === 'ON_HOLD';
}

/**
 * Get a human-readable label for a status.
 *
 * @param status - The status to label
 * @returns Human-readable label
 */
export function getStatusLabel(status: ApraRequestStatus): string {
  const labels: Record<ApraRequestStatus, string> = {
    RECEIVED: 'Received',
    ACKNOWLEDGED: 'Acknowledged',
    IN_REVIEW: 'In Review',
    NEEDS_CLARIFICATION: 'Needs Clarification',
    ON_HOLD: 'On Hold',
    FULFILLED: 'Fulfilled',
    DENIED: 'Denied',
    PARTIALLY_FULFILLED: 'Partially Fulfilled',
    CLOSED: 'Closed',
  };
  return labels[status];
}

/**
 * Get a description of what a status means.
 *
 * @param status - The status to describe
 * @returns Description of the status
 */
export function getStatusDescription(status: ApraRequestStatus): string {
  const descriptions: Record<ApraRequestStatus, string> = {
    RECEIVED: 'Request has been received and logged.',
    ACKNOWLEDGED: 'Agency has acknowledged receipt of the request.',
    IN_REVIEW: 'Staff is searching for and reviewing responsive records.',
    NEEDS_CLARIFICATION: 'Awaiting clarification from the requester.',
    ON_HOLD: 'Request is on hold pending resolution of an issue.',
    FULFILLED: 'All responsive records have been provided.',
    DENIED: 'Request has been denied with exemption citation.',
    PARTIALLY_FULFILLED: 'Some records provided, some withheld or unavailable.',
    CLOSED: 'Request has been administratively closed.',
  };
  return descriptions[status];
}
