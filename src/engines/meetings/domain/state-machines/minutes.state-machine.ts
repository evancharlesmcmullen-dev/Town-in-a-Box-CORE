// src/engines/meetings/domain/state-machines/minutes.state-machine.ts
//
// State machine for minutes workflow per IC 5-14-1.5-4.

import { MinutesStatus } from '../types';

/**
 * Minutes status transition map.
 */
export const MinutesStateMachine: Record<MinutesStatus, MinutesStatus[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT'],
  APPROVED: ['AMENDED'],
  AMENDED: [], // Terminal - creates new version for further amendments
};

/**
 * Check if a transition between two minutes statuses is valid.
 */
export function canTransitionMinutes(
  from: MinutesStatus,
  to: MinutesStatus
): boolean {
  return MinutesStateMachine[from]?.includes(to) ?? false;
}

/**
 * Get the list of valid next states from current state.
 */
export function getValidMinutesTransitions(
  current: MinutesStatus
): MinutesStatus[] {
  return MinutesStateMachine[current] ?? [];
}

/**
 * Check if minutes are in a terminal state.
 */
export function isMinutesTerminal(status: MinutesStatus): boolean {
  return MinutesStateMachine[status]?.length === 0;
}

/**
 * Validate a minutes transition and throw if invalid.
 */
export function validateMinutesTransition(
  from: MinutesStatus,
  to: MinutesStatus
): void {
  if (!canTransitionMinutes(from, to)) {
    const validTransitions = getValidMinutesTransitions(from);
    throw new Error(
      `Invalid minutes status transition from ${from} to ${to}. ` +
        `Valid transitions: ${validTransitions.join(', ') || 'none (terminal state)'}`
    );
  }
}

/**
 * Check if minutes can be edited.
 */
export function canEditMinutes(status: MinutesStatus): boolean {
  return status === 'DRAFT' || status === 'PENDING_APPROVAL';
}

/**
 * Check if minutes require approval.
 */
export function requiresApproval(status: MinutesStatus): boolean {
  return status === 'PENDING_APPROVAL';
}
