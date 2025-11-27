// src/core/ai/in-memory-ai.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import { AiInteraction } from './ai.types';
import { AiAssistantService, AiInsightsService } from './ai.service';

export interface InMemoryAiSeedData {
  interactions?: AiInteraction[];
}

/**
 * In-memory implementation of AI assistant and insights services.
 * Interactions are stored per tenant for simple aggregation.
 */
export class InMemoryAiService
  implements AiAssistantService, AiInsightsService
{
  private interactions: AiInteraction[];

  constructor(seed: InMemoryAiSeedData = {}) {
    this.interactions = seed.interactions ? [...seed.interactions] : [];
  }

  async askCitizen(
    _ctx: TenantContext,
    _question: string
  ): Promise<string> {
    return '[stub answer]';
  }

  async askStaff(
    _ctx: TenantContext,
    _question: string
  ): Promise<string> {
    return '[stub answer]';
  }

  async recordInteraction(
    ctx: TenantContext,
    interaction: AiInteraction
  ): Promise<void> {
    const stored: AiInteraction = {
      ...interaction,
      id: interaction.id ?? randomUUID(),
      tenantId: ctx.tenantId,
      createdAt: interaction.createdAt ?? new Date(),
    };

    this.interactions.push(stored);
  }

  async listTopQuestions(
    ctx: TenantContext,
    limit = 5
  ): Promise<{ question: string; count: number }[]> {
    const counts: Record<string, number> = {};

    for (const interaction of this.interactions) {
      if (interaction.tenantId !== ctx.tenantId) continue;
      const q = interaction.question;
      counts[q] = (counts[q] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
