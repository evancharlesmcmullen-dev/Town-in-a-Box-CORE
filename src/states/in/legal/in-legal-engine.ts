import { JurisdictionProfile } from '../../../core/tenancy/types';
import {
  ApraRuleSet,
  MeetingRuleSet,
  PlanningRuleSet,
} from '../../../core/legal/types';
import { LegalEngine } from '../../../core/legal/legal-engine';

// Indiana-specific legal engine.
// Phase 1 focus: Indiana TOWNS only (IN_TOWN).
// Methods return empty rule sets for now – we’ll fill them in incrementally.

export class INLegalEngine implements LegalEngine {
  readonly state = 'IN';

  getApraRules(j: JurisdictionProfile): ApraRuleSet {
    // TODO: Indiana APRA rules for towns (deadlines, exemptions, etc.)
    return {
      deadlines: [],
      exemptions: [],
      requiresReasonableParticularity: true,
    };
  }

  getMeetingsRules(j: JurisdictionProfile): MeetingRuleSet {
    // TODO: Indiana Open Door Law rules for town governing bodies
    return {
      noticeDeadlines: [],
      execSessionTopics: [],
    };
  }

  getPlanningRules(j: JurisdictionProfile): PlanningRuleSet {
    // TODO: Indiana planning/BZA rules for towns
    return {
      caseTypes: [],
      findingsTemplates: [],
    };
  }

  renderTemplate(templateId: string, data: unknown): string {
    // TODO: wire to a real template engine (e.g. Handlebars/ETA) + IN-specific templates
    return `Template ${templateId} not implemented yet.`;
  }
}
