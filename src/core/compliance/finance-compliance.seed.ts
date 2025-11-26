// src/core/compliance/finance-compliance.seed.ts

import { TenantContext } from '../tenancy/tenancy.types';
import {
  FinanceRuleSet,
  FinanceReportingRequirement,
} from '../finance/finance-rules.types';
import { FinancialRulesEngine } from '../finance/finance-rules.engine';
import {
  ComplianceService,
  UpsertComplianceTaskDefinitionInput,
} from './compliance.service';

/**
 * Convert a single FinanceReportingRequirement into a Compliance task definition.
 */
function reportingRequirementToTaskDefinition(
  req: FinanceReportingRequirement
): UpsertComplianceTaskDefinitionInput {
  // Simple mapping: we prefix codes to avoid collisions with other domains.
  const code = `FIN_${req.id}`;

  const name = req.name;
  const descriptionParts: string[] = [];

  if (req.description) {
    descriptionParts.push(req.description);
  }
  if (req.dueDescription) {
    descriptionParts.push(`Due: ${req.dueDescription}`);
  }

  const description = descriptionParts.join(' ');

  // For now, just use frequency + dueDescription as a hint.
  const recurrenceHint = req.dueDescription
    ? `${req.frequency} – ${req.dueDescription}`
    : req.frequency;

  return {
    code,
    name,
    description,
    statutoryCitation: req.statutoryCitation,
    recurrenceHint,
    isActive: true,
  };
}

/**
 * Seed compliance task definitions from a FinanceRuleSet.
 *
 * This is idempotent as long as ComplianceService.upsertTaskDefinition
 * uses (tenantId, code) as its uniqueness key.
 */
export async function seedFinanceComplianceFromRuleSet(
  ctx: TenantContext,
  financeRuleSet: FinanceRuleSet,
  compliance: ComplianceService
): Promise<void> {
  for (const req of financeRuleSet.reportingRequirements) {
    const def = reportingRequirementToTaskDefinition(req);
    await compliance.upsertTaskDefinition(ctx, def);
  }
}

/**
 * Convenience helper that pulls a FinanceRuleSet from a FinancialRulesEngine
 * and then seeds compliance definitions from it.
 */
export async function seedFinanceComplianceFromEngine(
  ctx: TenantContext,
  financeRulesEngine: FinancialRulesEngine,
  compliance: ComplianceService
): Promise<void> {
  const rules = financeRulesEngine.getFinanceRules(ctx.jurisdiction);
  await seedFinanceComplianceFromRuleSet(ctx, rules, compliance);
}
