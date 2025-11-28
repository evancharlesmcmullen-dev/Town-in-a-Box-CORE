// src/core/records/apra-workflow.service.ts
//
// APRA Workflow Service
//
// Provides a clean state machine for APRA request statuses.
// Enforces valid transitions and maintains transition history.
// This is pure logic - persistence is handled by the caller.

import {
  ApraRequestStatus,
  ApraDeadlineInfo,
  ApraStatusTransition,
  ApraRequestWorkflowContext,
  ApraWorkflowConfigSnapshot,
  isTerminalStatus,
} from './apra-workflow.types';
import { INApraConfig } from '../../states/in/apra/in-apra.config';
import { calculateApraDeadlines, recalculateDeadlines } from './apra-deadlines.service';

/**
 * Allowed status transitions map.
 *
 * This defines the valid state machine for APRA requests.
 * Each key is a status, and the value is an array of valid next statuses.
 *
 * Transition rules:
 * - RECEIVED → Can acknowledge, start review, or request clarification
 * - ACKNOWLEDGED → Can start review, request clarification, or put on hold
 * - IN_REVIEW → Can request clarification, fulfill, deny, partially fulfill, or hold
 * - NEEDS_CLARIFICATION → Can resume review or put on hold
 * - ON_HOLD → Can resume review or move to any completion status
 * - FULFILLED/DENIED/PARTIALLY_FULFILLED → Can only close
 * - CLOSED → Terminal state, no further transitions
 */
const ALLOWED_TRANSITIONS: Record<ApraRequestStatus, ApraRequestStatus[]> = {
  RECEIVED: ['ACKNOWLEDGED', 'IN_REVIEW', 'NEEDS_CLARIFICATION'],
  ACKNOWLEDGED: ['IN_REVIEW', 'NEEDS_CLARIFICATION', 'ON_HOLD'],
  IN_REVIEW: [
    'NEEDS_CLARIFICATION',
    'FULFILLED',
    'DENIED',
    'PARTIALLY_FULFILLED',
    'ON_HOLD',
  ],
  NEEDS_CLARIFICATION: ['IN_REVIEW', 'ON_HOLD'],
  ON_HOLD: ['IN_REVIEW', 'FULFILLED', 'DENIED', 'PARTIALLY_FULFILLED'],
  FULFILLED: ['CLOSED'],
  DENIED: ['CLOSED'],
  PARTIALLY_FULFILLED: ['CLOSED'],
  CLOSED: [], // Terminal state
};

/**
 * Parameters for initializing a new APRA workflow.
 */
export interface ApraWorkflowInitializeParams {
  /** Unique identifier for the request */
  requestId: string;

  /** Tenant the request belongs to */
  tenantId: string;

  /** When the request was received (determines deadline start) */
  receivedAt: Date;

  /** APRA configuration to use for deadline calculation */
  config: Partial<INApraConfig>;
}

/**
 * Initialize a new APRA workflow context.
 *
 * Creates a fresh workflow context with:
 * - Initial status set to RECEIVED
 * - Deadlines computed from config
 * - Empty transition history
 * - Config snapshot for future reference
 *
 * @param params - Initialization parameters
 * @returns New workflow context
 *
 * @example
 * ```typescript
 * import { initializeApraWorkflow } from './apra-workflow.service';
 * import { DEFAULT_IN_APRA_CONFIG } from '../../states/in/apra/in-apra.config';
 *
 * const workflow = initializeApraWorkflow({
 *   requestId: 'req-123',
 *   tenantId: 'example-town',
 *   receivedAt: new Date(),
 *   config: DEFAULT_IN_APRA_CONFIG,
 * });
 *
 * console.log(workflow.currentStatus); // 'RECEIVED'
 * console.log(workflow.deadlines.initialDueDate); // 7 business days out
 * ```
 */
export function initializeApraWorkflow(
  params: ApraWorkflowInitializeParams
): ApraRequestWorkflowContext {
  const { requestId, tenantId, receivedAt, config } = params;

  // Calculate deadlines based on config
  const deadlines = calculateApraDeadlines(receivedAt, config);

  // Create config snapshot for audit/reference
  const configSnapshot: ApraWorkflowConfigSnapshot = {
    standardResponseDays: config.standardResponseDays,
    extensionResponseDays: config.extensionResponseDays,
    businessDaysOnly: config.businessDaysOnly,
    allowCopyFees: config.allowCopyFees,
    defaultPerPageFee: config.defaultPerPageFee,
    allowElectronicCopyFees: config.allowElectronicCopyFees,
    maxSearchTimeWithoutChargeMinutes: config.maxSearchTimeWithoutChargeMinutes,
    logRequests: config.logRequests,
    requestLogRetentionYears: config.requestLogRetentionYears,
  };

  return {
    requestId,
    tenantId,
    receivedAt,
    currentStatus: 'RECEIVED',
    deadlines,
    transitions: [],
    configSnapshot,
  };
}

/**
 * Parameters for transitioning an APRA workflow status.
 */
export interface ApraWorkflowTransitionParams {
  /** Current workflow context */
  context: ApraRequestWorkflowContext;

  /** Target status to transition to */
  toStatus: ApraRequestStatus;

  /** Optional reason for the transition */
  reason?: string;

  /** Who is making the change (user ID, email, etc.) */
  changedBy?: string;

  /** When the change occurred (defaults to now) */
  changedAt?: Date;
}

/**
 * Result of a status transition attempt.
 */
export interface ApraWorkflowTransitionResult {
  /** Whether the transition was successful */
  success: boolean;

  /** Updated workflow context (if successful) */
  context?: ApraRequestWorkflowContext;

  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Attempt a status transition.
 *
 * Validates that the transition is allowed, then creates a new
 * context with the updated status and transition history.
 *
 * This function is pure - it does not mutate the input context.
 * The caller is responsible for persisting the returned context.
 *
 * @param params - Transition parameters
 * @returns Updated workflow context
 * @throws Error if the transition is not allowed
 *
 * @example
 * ```typescript
 * import { transitionApraStatus } from './apra-workflow.service';
 *
 * try {
 *   const updated = transitionApraStatus({
 *     context: currentWorkflow,
 *     toStatus: 'IN_REVIEW',
 *     reason: 'Beginning document search',
 *     changedBy: 'user@example.com',
 *   });
 *   // Save updated workflow to database
 * } catch (error) {
 *   console.error('Invalid transition:', error.message);
 * }
 * ```
 */
export function transitionApraStatus(
  params: ApraWorkflowTransitionParams
): ApraRequestWorkflowContext {
  const { context, toStatus, reason, changedBy } = params;
  const changedAt = params.changedAt ?? new Date();

  // Check if transition is allowed
  const allowed = ALLOWED_TRANSITIONS[context.currentStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Invalid APRA status transition from ${context.currentStatus} to ${toStatus}. ` +
        `Allowed transitions: ${allowed.join(', ') || 'none'}`
    );
  }

  // Create transition record
  const transition: ApraStatusTransition = {
    from: context.currentStatus,
    to: toStatus,
    reason,
    changedBy,
    changedAt,
  };

  // Return new context with updated status and transition history
  return {
    ...context,
    currentStatus: toStatus,
    transitions: [...context.transitions, transition],
  };
}

/**
 * Safe version of transitionApraStatus that returns a result object.
 *
 * Use this when you want to handle invalid transitions gracefully
 * without throwing exceptions.
 *
 * @param params - Transition parameters
 * @returns Result object with success flag and context or error
 */
export function tryTransitionApraStatus(
  params: ApraWorkflowTransitionParams
): ApraWorkflowTransitionResult {
  try {
    const context = transitionApraStatus(params);
    return { success: true, context };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a transition is valid without performing it.
 *
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @returns true if the transition is allowed
 */
export function isValidTransition(
  fromStatus: ApraRequestStatus,
  toStatus: ApraRequestStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

/**
 * Get the list of valid next statuses from a given status.
 *
 * @param currentStatus - The current status
 * @returns Array of valid next statuses
 */
export function getValidNextStatuses(
  currentStatus: ApraRequestStatus
): ApraRequestStatus[] {
  return [...(ALLOWED_TRANSITIONS[currentStatus] ?? [])];
}

/**
 * Parameters for resetting the deadline clock.
 */
export interface ApraDeadlineResetParams {
  /** Current workflow context */
  context: ApraRequestWorkflowContext;

  /** New start date for deadline calculation */
  newStartDate: Date;

  /** Reason for the reset */
  reason?: string;

  /** Who initiated the reset */
  changedBy?: string;
}

/**
 * Reset the deadline clock from a new start date.
 *
 * Used when the statutory clock restarts, such as after:
 * - Receiving clarification from requester
 * - Coming off hold
 *
 * Note: This recalculates deadlines but does NOT change the status.
 * Use transitionApraStatus separately if a status change is also needed.
 *
 * @param params - Reset parameters
 * @returns Updated workflow context with new deadlines
 *
 * @example
 * ```typescript
 * // After receiving clarification
 * const clarificationDate = new Date();
 * const updated = resetApraDeadline({
 *   context: workflow,
 *   newStartDate: clarificationDate,
 *   reason: 'Clarification received from requester',
 *   changedBy: 'system',
 * });
 * // updated.deadlines.initialDueDate is now 7 business days from clarificationDate
 * ```
 */
export function resetApraDeadline(
  params: ApraDeadlineResetParams
): ApraRequestWorkflowContext {
  const { context, newStartDate, reason, changedBy } = params;

  // Recalculate deadlines using the config snapshot
  const newDeadlines = recalculateDeadlines(newStartDate, context.configSnapshot);

  // Note: We don't create a transition record for deadline resets
  // because the status doesn't change. The caller should create
  // a separate audit record if needed.

  return {
    ...context,
    deadlines: newDeadlines,
  };
}

/**
 * Grant an extension on the deadline.
 *
 * Sets the extendedDueDate on the workflow context.
 * The extension days come from the config's extensionResponseDays.
 *
 * @param context - Current workflow context
 * @param fromDate - Date from which to calculate extension (defaults to now)
 * @returns Updated workflow context with extended deadline
 *
 * @example
 * ```typescript
 * const extended = grantDeadlineExtension(workflow);
 * console.log(extended.deadlines.extendedDueDate); // 14 business days from now
 * ```
 */
export function grantDeadlineExtension(
  context: ApraRequestWorkflowContext,
  fromDate: Date = new Date()
): ApraRequestWorkflowContext {
  const extensionDays = context.configSnapshot.extensionResponseDays;

  if (!extensionDays) {
    throw new Error('Extension not configured for this request');
  }

  const usesBusinessDays = context.configSnapshot.businessDaysOnly ?? true;

  // Calculate extended deadline from the specified date
  const extendedDueDate = addBusinessDays(fromDate, extensionDays, usesBusinessDays);

  return {
    ...context,
    deadlines: {
      ...context.deadlines,
      extendedDueDate,
    },
  };
}

/**
 * Helper to add business days (simplified - no holidays).
 * For production, use the calendar utilities.
 */
function addBusinessDays(
  start: Date,
  days: number,
  businessDaysOnly: boolean
): Date {
  const result = new Date(start.getTime());
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);

    if (!businessDaysOnly) {
      remaining--;
    } else {
      const dayOfWeek = result.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remaining--;
      }
    }
  }

  return result;
}

/**
 * Get a summary of the workflow state for UI display.
 *
 * @param context - The workflow context
 * @returns Summary object with status info, deadline info, and transition count
 */
export function getWorkflowSummary(context: ApraRequestWorkflowContext): {
  requestId: string;
  tenantId: string;
  currentStatus: ApraRequestStatus;
  isTerminal: boolean;
  canTransitionTo: ApraRequestStatus[];
  transitionCount: number;
  daysUntilDeadline: number;
  isOverdue: boolean;
} {
  const now = new Date();
  const activeDeadline =
    context.deadlines.extendedDueDate ?? context.deadlines.initialDueDate;
  const msUntilDeadline = activeDeadline.getTime() - now.getTime();
  const daysUntilDeadline = Math.ceil(msUntilDeadline / (24 * 60 * 60 * 1000));

  return {
    requestId: context.requestId,
    tenantId: context.tenantId,
    currentStatus: context.currentStatus,
    isTerminal: isTerminalStatus(context.currentStatus),
    canTransitionTo: getValidNextStatuses(context.currentStatus),
    transitionCount: context.transitions.length,
    daysUntilDeadline,
    isOverdue: daysUntilDeadline < 0,
  };
}

/**
 * Validate a workflow context for consistency.
 *
 * Checks that the context is internally consistent:
 * - Has required fields
 * - Transitions are in chronological order
 * - Final transition matches current status
 *
 * @param context - The workflow context to validate
 * @returns Validation result with any errors
 */
export function validateWorkflowContext(context: ApraRequestWorkflowContext): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!context.requestId) {
    errors.push('Missing requestId');
  }

  if (!context.tenantId) {
    errors.push('Missing tenantId');
  }

  if (!context.receivedAt) {
    errors.push('Missing receivedAt');
  }

  if (!context.currentStatus) {
    errors.push('Missing currentStatus');
  }

  if (!context.deadlines || !context.deadlines.initialDueDate) {
    errors.push('Missing or invalid deadlines');
  }

  // Check transition consistency
  if (context.transitions.length > 0) {
    // Verify chronological order
    for (let i = 1; i < context.transitions.length; i++) {
      const prev = context.transitions[i - 1];
      const curr = context.transitions[i];

      if (curr.changedAt < prev.changedAt) {
        errors.push(`Transition ${i} is out of chronological order`);
      }

      // Verify chain integrity
      if (curr.from !== prev.to) {
        errors.push(`Transition ${i} 'from' doesn't match previous 'to'`);
      }
    }

    // Verify final transition matches current status
    const lastTransition = context.transitions[context.transitions.length - 1];
    if (lastTransition.to !== context.currentStatus) {
      errors.push('Current status does not match final transition');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
