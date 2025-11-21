// src/core/help/help.service.ts

import { TenantContext } from '../tenancy/types';
import { HelpTopic, HelpAnchor } from './help.types';

export interface HelpService {
  listTopics(ctx: TenantContext): Promise<HelpTopic[]>;
  getTopicByCode(ctx: TenantContext, code: string): Promise<HelpTopic | null>;

  listAnchorsForRoute(
    ctx: TenantContext,
    route: string
  ): Promise<HelpAnchor[]>;
}