import { JurisdictionProfile } from '../tenancy/types';
import {
  ApraRuleSet,
  MeetingRuleSet,
  PlanningRuleSet,
} from './types';

// Interface every state-specific legal engine must implement.
// Indiana towns will be the first concrete implementation.

export interface LegalEngine {
  readonly state: string;

  getApraRules(j: JurisdictionProfile): ApraRuleSet;
  getMeetingsRules(j: JurisdictionProfile): MeetingRuleSet;
  getPlanningRules(j: JurisdictionProfile): PlanningRuleSet;

  // As we expand, we'll add:
  // getFinanceRules(j: JurisdictionProfile): FinanceRuleSet;
  // getUtilitiesRules(j: JurisdictionProfile): UtilitiesRuleSet;
  // getProcurementRules(j: JurisdictionProfile): ProcurementRuleSet;
  // getTownshipAssistanceRules(j: JurisdictionProfile): TownshipAssistanceRuleSet;

  // Render a legal template (e.g. notice, letter, findings) by ID and input data.
  renderTemplate(templateId: string, data: unknown): string;
}

export interface LegalEngineFactory {
  forJurisdiction(j: JurisdictionProfile): LegalEngine;
}
