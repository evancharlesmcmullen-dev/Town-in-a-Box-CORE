// src/core/ai/ai.service.ts

import { TenantContext } from '../tenancy/types';
import { AiInteraction } from './ai.types';

export interface AiAssistantService {
  askCitizen(
    ctx: TenantContext,
    question: string
  ): Promise<string>;

  askStaff(
    ctx: TenantContext,
    question: string
  ): Promise<string>;
}

export interface AiInsightsService {
  recordInteraction(
    ctx: TenantContext,
    interaction: AiInteraction
  ): Promise<void>;

  listTopQuestions(
    ctx: TenantContext,
    limit?: number
  ): Promise<{ question: string; count: number }[]>;
}