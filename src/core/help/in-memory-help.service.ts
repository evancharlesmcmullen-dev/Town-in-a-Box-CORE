// src/core/help/in-memory-help.service.ts

import { TenantContext } from '../tenancy/types';
import { HelpTopic, HelpAnchor } from './help.types';
import { HelpService } from './help.service';

export interface InMemoryHelpSeedData {
  topics?: HelpTopic[];
  anchors?: HelpAnchor[];
}

/**
 * In-memory implementation of HelpService. Data is scoped per tenant and
 * seeded externally for demos/tests.
 */
export class InMemoryHelpService implements HelpService {
  private topics: HelpTopic[];
  private anchors: HelpAnchor[];

  constructor(seed: InMemoryHelpSeedData = {}) {
    this.topics = seed.topics ? [...seed.topics] : [];
    this.anchors = seed.anchors ? [...seed.anchors] : [];
  }

  async listTopics(ctx: TenantContext): Promise<HelpTopic[]> {
    return this.topics.filter((t) => t.tenantId === ctx.tenantId);
  }

  async getTopicByCode(
    ctx: TenantContext,
    code: string
  ): Promise<HelpTopic | null> {
    return (
      this.topics.find(
        (t) => t.code === code && t.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listAnchorsForRoute(
    ctx: TenantContext,
    route: string
  ): Promise<HelpAnchor[]> {
    return this.anchors.filter(
      (a) => a.tenantId === ctx.tenantId && a.route === route
    );
  }
}
