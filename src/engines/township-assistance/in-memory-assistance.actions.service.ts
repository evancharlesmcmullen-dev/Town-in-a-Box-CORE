// src/engines/township-assistance/in-memory-assistance.actions.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  AssistanceCaseAction,
  AssistanceActionType,
} from './assistance.actions.types';
import {
  AssistanceCaseActionService,
  LogAssistanceActionInput,
} from './assistance.actions.service';

export interface InMemoryAssistanceActionsSeedData {
  actions?: AssistanceCaseAction[];
}

/**
 * In-memory implementation of AssistanceCaseActionService. Actions are scoped by
 * tenant and stored only for the lifetime of the process.
 */
export class InMemoryAssistanceActionsService implements AssistanceCaseActionService {
  private actions: AssistanceCaseAction[];

  constructor(seed: InMemoryAssistanceActionsSeedData = {}) {
    this.actions = seed.actions ? [...seed.actions] : [];
  }

  async logAction(
    ctx: TenantContext,
    input: LogAssistanceActionInput
  ): Promise<AssistanceCaseAction> {
    const action: AssistanceCaseAction = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      caseId: input.caseId,
      type: input.type as AssistanceActionType,
      timestamp: new Date(),
      performedByUserId: ctx.userId,
      notes: input.notes,
    };

    this.actions.push(action);
    return action;
  }

  async listActionsForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<AssistanceCaseAction[]> {
    return this.actions
      .filter((a) => a.tenantId === ctx.tenantId && a.caseId === caseId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
