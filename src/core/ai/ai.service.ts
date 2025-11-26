// src/core/ai/ai.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { AiInteraction } from './ai.types';

/**
 * Service interface for citizen-facing AI assistant.
 */
export interface AiAssistantService {
  /**
   * Answer a question from a citizen.
   */
  askCitizen(ctx: TenantContext, question: string): Promise<string>;

  /**
   * Answer a question from staff.
   */
  askStaff(ctx: TenantContext, question: string): Promise<string>;
}

/**
 * Service interface for AI insights and analytics.
 */
export interface AiInsightsService {
  /**
   * Record an AI interaction for analytics.
   */
  recordInteraction(
    ctx: TenantContext,
    interaction: AiInteraction
  ): Promise<void>;

  /**
   * Get the top questions asked by users.
   */
  listTopQuestions(
    ctx: TenantContext,
    limit?: number
  ): Promise<{ question: string; count: number }[]>;
}
