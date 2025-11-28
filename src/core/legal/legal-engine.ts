import { JurisdictionProfile } from '../tenancy/tenancy.types';
import {
  ApraRuleSet,
  MeetingRuleSet,
  PlanningRuleSet,
  AssistanceRuleSet,
  ComplianceTaskTemplate,
  LegalTemplateKind,
  RenderedLegalDocument,
  LegalTemplateContext,
} from './types';

// Interface every state-specific legal engine must implement.
// Indiana towns will be the first concrete implementation.

export interface LegalEngine {
  readonly state: string;

  getApraRules(j: JurisdictionProfile): ApraRuleSet;
  getMeetingsRules(j: JurisdictionProfile): MeetingRuleSet;
  getPlanningRules(j: JurisdictionProfile): PlanningRuleSet;
  getAssistanceRules(j: JurisdictionProfile): AssistanceRuleSet;
  getComplianceTaskTemplates(j: JurisdictionProfile): ComplianceTaskTemplate[];

  // As we expand, we'll add:
  // getFinanceRules(j: JurisdictionProfile): FinanceRuleSet;
  // getUtilitiesRules(j: JurisdictionProfile): UtilitiesRuleSet;
  // getProcurementRules(j: JurisdictionProfile): ProcurementRuleSet;
  // getTownshipAssistanceRules(j: JurisdictionProfile): TownshipAssistanceRuleSet;

  /**
   * Render a legal template (e.g. notice, letter, findings) using the typed template system.
   *
   * @param kind - The type of template to render
   * @param context - Context data for the template
   * @returns A rendered legal document with title, body, and metadata
   */
  renderTemplate(
    kind: LegalTemplateKind,
    context: LegalTemplateContext
  ): Promise<RenderedLegalDocument>;
}

export interface LegalEngineFactory {
  forJurisdiction(j: JurisdictionProfile): LegalEngine;
}
