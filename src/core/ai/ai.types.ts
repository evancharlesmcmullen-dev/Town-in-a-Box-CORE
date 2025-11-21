// src/core/ai/ai.types.ts

import { TenantContext } from '../tenancy/tenancy.types';

/**
 * A basic question/answer interaction for logging/insights.
 */
export interface AiInteraction {
  id: string;
  tenantId: string;

  userId?: string;
  roleHint?: string;        // e.g. "citizen", "staff", "trustee", "board"

  question: string;
  answer: string;

  createdAt: Date;
}