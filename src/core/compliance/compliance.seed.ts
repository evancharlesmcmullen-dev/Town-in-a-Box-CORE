// src/core/compliance/compliance.seed.ts

import { TenantContext, JurisdictionProfile } from '../tenancy/types';
import {
  ComplianceService,
  UpsertComplianceTaskDefinitionInput,
} from './compliance.service';
import { LegalEngine } from '../legal/legal-engine';
import { ComplianceTaskTemplate } from '../legal/types';

/**
 * Seed compliance task definitions from the legal engine's templates.
 * Uses upsert to avoid duplicates across runs.
 */
export async function seedComplianceTasksFromLegal(
  ctx: TenantContext,
  legal: LegalEngine,
  compliance: ComplianceService
): Promise<void> {
  const templates: ComplianceTaskTemplate[] = legal.getComplianceTaskTemplates(
    ctx.jurisdiction as JurisdictionProfile
  );

  for (const template of templates) {
    const input: UpsertComplianceTaskDefinitionInput = {
      code: template.code,
      name: template.name,
      description: template.description,
      statutoryCitation: template.statutoryCitation,
      recurrenceHint: template.recurrenceHint,
      isActive: true,
    };

    await compliance.upsertTaskDefinition(ctx, input);
  }
}
