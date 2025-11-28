// src/engines/meetings/domain/state-machines/executive-session.state-machine.ts
//
// State machine for executive session lifecycle per IC 5-14-1.5-6.1.

import { ExecutiveSessionStatus } from '../types';

/**
 * Executive session status transition map.
 */
export const ExecutiveSessionStateMachine: Record<
  ExecutiveSessionStatus,
  ExecutiveSessionStatus[]
> = {
  PENDING: ['IN_SESSION', 'CANCELLED'],
  IN_SESSION: ['ENDED'],
  ENDED: ['CERTIFIED'],
  CERTIFIED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Check if a transition between two executive session statuses is valid.
 */
export function canTransitionExecSession(
  from: ExecutiveSessionStatus,
  to: ExecutiveSessionStatus
): boolean {
  return ExecutiveSessionStateMachine[from]?.includes(to) ?? false;
}

/**
 * Get the list of valid next states from current state.
 */
export function getValidExecSessionTransitions(
  current: ExecutiveSessionStatus
): ExecutiveSessionStatus[] {
  return ExecutiveSessionStateMachine[current] ?? [];
}

/**
 * Check if an executive session is in a terminal state.
 */
export function isExecSessionTerminal(status: ExecutiveSessionStatus): boolean {
  return ExecutiveSessionStateMachine[status]?.length === 0;
}

/**
 * Validate an executive session transition and throw if invalid.
 */
export function validateExecSessionTransition(
  from: ExecutiveSessionStatus,
  to: ExecutiveSessionStatus
): void {
  if (!canTransitionExecSession(from, to)) {
    const validTransitions = getValidExecSessionTransitions(from);
    throw new Error(
      `Invalid executive session status transition from ${from} to ${to}. ` +
        `Valid transitions: ${validTransitions.join(', ') || 'none (terminal state)'}`
    );
  }
}

/**
 * Check if an executive session blocks votes.
 * Per IC 5-14-1.5-6.1, no final action (vote) can be taken during an exec session.
 */
export function isVoteBlocked(status: ExecutiveSessionStatus): boolean {
  return status === 'IN_SESSION';
}

/**
 * Check if an executive session requires certification.
 */
export function requiresCertification(status: ExecutiveSessionStatus): boolean {
  return status === 'ENDED';
}

/**
 * Check if an executive session is active (blocks certain operations).
 */
export function isExecSessionActive(status: ExecutiveSessionStatus): boolean {
  return status === 'IN_SESSION';
}

/**
 * Check if all executive sessions for a meeting are properly certified.
 * Required before minutes can be approved.
 */
export function allSessionsCertified(
  sessions: Array<{ status: ExecutiveSessionStatus }>
): boolean {
  return sessions.every(
    (s) => s.status === 'CERTIFIED' || s.status === 'CANCELLED'
  );
}
