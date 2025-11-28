// src/engines/meetings/domain/state-machines/meeting.state-machine.ts
//
// State machine for meeting lifecycle management.

import { MeetingStatus } from '../types';

/**
 * Meeting status transition map.
 * Defines allowed transitions from each state.
 */
export const MeetingStateMachine: Record<MeetingStatus, MeetingStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['NOTICED', 'IN_PROGRESS', 'CANCELLED', 'DRAFT'],
  NOTICED: ['IN_PROGRESS', 'CANCELLED', 'SCHEDULED'],
  IN_PROGRESS: ['RECESSED', 'ADJOURNED'],
  RECESSED: ['IN_PROGRESS', 'ADJOURNED'],
  ADJOURNED: [], // Terminal state - no transitions allowed
  CANCELLED: ['DRAFT'], // Can resurrect to draft
};

/**
 * Check if a transition between two meeting statuses is valid.
 */
export function canTransitionMeeting(
  from: MeetingStatus,
  to: MeetingStatus
): boolean {
  return MeetingStateMachine[from]?.includes(to) ?? false;
}

/**
 * Get the list of valid next states from current state.
 */
export function getValidMeetingTransitions(
  current: MeetingStatus
): MeetingStatus[] {
  return MeetingStateMachine[current] ?? [];
}

/**
 * Check if a meeting status is a terminal state.
 */
export function isMeetingTerminal(status: MeetingStatus): boolean {
  return MeetingStateMachine[status]?.length === 0;
}

/**
 * Validate a meeting transition and throw if invalid.
 */
export function validateMeetingTransition(
  from: MeetingStatus,
  to: MeetingStatus
): void {
  if (!canTransitionMeeting(from, to)) {
    const validTransitions = getValidMeetingTransitions(from);
    throw new Error(
      `Invalid meeting status transition from ${from} to ${to}. ` +
        `Valid transitions: ${validTransitions.join(', ') || 'none (terminal state)'}`
    );
  }
}

/**
 * Actions that trigger meeting state transitions.
 * Named MeetingTransitionAction to avoid conflict with MeetingAction interface in types.
 */
export type MeetingTransitionAction =
  | 'SCHEDULE'
  | 'POST_NOTICE'
  | 'START'
  | 'RECESS'
  | 'RESUME'
  | 'ADJOURN'
  | 'CANCEL'
  | 'RESURRECT';

/**
 * Determine target state for a given action.
 */
export function getTargetStateForAction(
  currentStatus: MeetingStatus,
  action: MeetingTransitionAction
): MeetingStatus | null {
  switch (action) {
    case 'SCHEDULE':
      if (currentStatus === 'DRAFT') return 'SCHEDULED';
      break;
    case 'POST_NOTICE':
      if (currentStatus === 'SCHEDULED') return 'NOTICED';
      break;
    case 'START':
      if (currentStatus === 'SCHEDULED' || currentStatus === 'NOTICED')
        return 'IN_PROGRESS';
      break;
    case 'RECESS':
      if (currentStatus === 'IN_PROGRESS') return 'RECESSED';
      break;
    case 'RESUME':
      if (currentStatus === 'RECESSED') return 'IN_PROGRESS';
      break;
    case 'ADJOURN':
      if (currentStatus === 'IN_PROGRESS' || currentStatus === 'RECESSED')
        return 'ADJOURNED';
      break;
    case 'CANCEL':
      if (
        currentStatus === 'DRAFT' ||
        currentStatus === 'SCHEDULED' ||
        currentStatus === 'NOTICED'
      )
        return 'CANCELLED';
      break;
    case 'RESURRECT':
      if (currentStatus === 'CANCELLED') return 'DRAFT';
      break;
  }
  return null;
}
