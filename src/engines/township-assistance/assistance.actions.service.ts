// src/engines/township-assistance/assistance.actions.service.ts

import { TenantContext } from '../../core/tenancy/types';
import {
  AssistanceCaseAction,
  AssistanceActionType,
} from './assistance.actions.types';

/**
 * Input for logging a new action on an assistance case.
 */
export interface LogAssistanceActionInput {
  caseId: string;
  type: AssistanceActionType;
  notes?: string;
}

/**
 * Service interface for logging and retrieving assistance case actions.
 *
 * Implementations will typically be used alongside TownshipAssistanceService
 * to build a complete timeline of each case (intake, documents, interviews,
 * approvals, denials, appeals, etc.).
 */
export interface AssistanceCaseActionService {
  /**
   * Log a new action on an assistance case.
   */
  logAction(
    ctx: TenantContext,
    input: LogAssistanceActionInput
  ): Promise<AssistanceCaseAction>;

  /**
   * List all actions for a given assistance case, in chronological order.
   */
  listActionsForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<AssistanceCaseAction[]>;
}