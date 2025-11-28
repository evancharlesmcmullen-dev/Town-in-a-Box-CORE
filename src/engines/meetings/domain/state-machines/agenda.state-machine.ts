// src/engines/meetings/domain/state-machines/agenda.state-machine.ts
//
// State machine for agenda workflow management.

import { AgendaStatus, AgendaItemStatus } from '../types';

/**
 * Agenda status transition map.
 */
export const AgendaStateMachine: Record<AgendaStatus, AgendaStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'PUBLISHED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['AMENDED'],
  AMENDED: [], // Can only create new version
};

/**
 * Check if a transition between two agenda statuses is valid.
 */
export function canTransitionAgenda(
  from: AgendaStatus,
  to: AgendaStatus
): boolean {
  return AgendaStateMachine[from]?.includes(to) ?? false;
}

/**
 * Get the list of valid next states from current state.
 */
export function getValidAgendaTransitions(
  current: AgendaStatus
): AgendaStatus[] {
  return AgendaStateMachine[current] ?? [];
}

/**
 * Validate an agenda transition and throw if invalid.
 */
export function validateAgendaTransition(
  from: AgendaStatus,
  to: AgendaStatus
): void {
  if (!canTransitionAgenda(from, to)) {
    const validTransitions = getValidAgendaTransitions(from);
    throw new Error(
      `Invalid agenda status transition from ${from} to ${to}. ` +
        `Valid transitions: ${validTransitions.join(', ') || 'none'}`
    );
  }
}

/**
 * Agenda item status transition map.
 */
export const AgendaItemStateMachine: Record<
  AgendaItemStatus,
  AgendaItemStatus[]
> = {
  PENDING: ['IN_PROGRESS', 'TABLED', 'WITHDRAWN'],
  IN_PROGRESS: ['DISCUSSED', 'TABLED', 'ACTED_UPON'],
  DISCUSSED: ['ACTED_UPON', 'TABLED'],
  TABLED: ['PENDING', 'WITHDRAWN'],
  WITHDRAWN: [], // Terminal
  ACTED_UPON: [], // Terminal
};

/**
 * Check if a transition between two agenda item statuses is valid.
 */
export function canTransitionAgendaItem(
  from: AgendaItemStatus,
  to: AgendaItemStatus
): boolean {
  return AgendaItemStateMachine[from]?.includes(to) ?? false;
}

/**
 * Get the list of valid next states from current state.
 */
export function getValidAgendaItemTransitions(
  current: AgendaItemStatus
): AgendaItemStatus[] {
  return AgendaItemStateMachine[current] ?? [];
}

/**
 * Validate an agenda item transition and throw if invalid.
 */
export function validateAgendaItemTransition(
  from: AgendaItemStatus,
  to: AgendaItemStatus
): void {
  if (!canTransitionAgendaItem(from, to)) {
    const validTransitions = getValidAgendaItemTransitions(from);
    throw new Error(
      `Invalid agenda item status transition from ${from} to ${to}. ` +
        `Valid transitions: ${validTransitions.join(', ') || 'none (terminal state)'}`
    );
  }
}
