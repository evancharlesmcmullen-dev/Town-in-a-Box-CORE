// src/states/in/legal/in-legal-engine.ts

import { JurisdictionProfile } from '../../../core/tenancy/types';
import {
  ApraRuleSet,
  MeetingRuleSet,
  PlanningRuleSet,
  DeadlineRule,
  TemplateDescriptor,
  ApraExemption,
} from '../../../core/legal/types';
import { LegalEngine } from '../../../core/legal/legal-engine';

function isIndianaTown(j: JurisdictionProfile): boolean {
  return j.state === 'IN' && j.kind === 'town';
}

/**
 * Indiana-specific legal engine.
 *
 * Phase 1 focus: Indiana TOWNS only (IN_TOWN).
 * Other forms (cities, townships, counties) will be added later.
 */
export class INLegalEngine implements LegalEngine {
  readonly state = 'IN';

  //
  // APRA RULES
  //

  getApraRules(j: JurisdictionProfile): ApraRuleSet {
    if (!isIndianaTown(j)) {
      // For now we only support towns; other forms fall back to same rules.
    }

    const deadlines: DeadlineRule[] = [
      {
        id: 'APRA_INITIAL_RESPONSE',
        description:
          'Provide an initial response to an APRA request within a reasonable time; same day if in person or telephone, 7 days if by mail/email is a typical best practice.',
        eventType: 'APRA_REQUEST_RECEIVED',
        offsetBusinessDays: 7,
      },
      // Later we can add explicit production deadlines per record type, etc.
    ];

    const exemptions: ApraExemption[] = [
      {
        id: 'APRA_CONFIDENTIAL_RECORDS',
        citation: 'IC 5-14-3-4(a)',
        description:
          'Records declared confidential by state statute, rule, or federal law.',
      },
      {
        id: 'APRA_DISCRETIONARY_EXEMPTIONS',
        citation: 'IC 5-14-3-4(b)',
        description:
          'Records the agency may withhold at its discretion, such as investigatory records, deliberative material, certain personnel records, etc.',
      },
      // We can expand this list over time as we encode more specific exemptions.
    ];

    return {
      deadlines,
      exemptions,
      requiresReasonableParticularity: true,
    };
  }

  //
  // MEETINGS / OPEN DOOR LAW RULES
  //

  getMeetingsRules(j: JurisdictionProfile): MeetingRuleSet {
    if (!isIndianaTown(j)) {
      // For now, treat non-town Indiana units the same until we specialize them.
    }

    const deadlines: DeadlineRule[] = [
      {
        id: 'MEETING_NOTICE_REGULAR',
        description:
          'Post notice of a regular meeting at least 48 hours (excluding weekends and legal holidays) before the meeting, stating date, time, and location.',
        eventType: 'MEETING_SCHEDULED_REGULAR',
        offsetBusinessDays: 2,
      },
      {
        id: 'MEETING_NOTICE_SPECIAL',
        description:
          'Post notice of a special meeting at least 48 hours before the meeting, unless emergency circumstances apply.',
        eventType: 'MEETING_SCHEDULED_SPECIAL',
        offsetBusinessDays: 2,
      },
      // Later: emergency meetings, continued meetings, etc.
    ];

    const execSessionTopics = [
      {
        code: 'EXEC_SESSION_PERSONNEL',
        description:
          'Executive session to discuss job performance evaluations of individual employees (not salary, benefits, or creation of new position).',
      },
      {
        code: 'EXEC_SESSION_LITIGATION',
        description:
          'Executive session for strategy discussion with respect to initiation or pending litigation.',
      },
      // Add more allowed topics over time based on IC 5-14-1.5-6.1.
    ];

    return {
      noticeDeadlines: deadlines,
      execSessionTopics,
    };
  }

  //
  // PLANNING / BZA RULES
  //

  getPlanningRules(j: JurisdictionProfile): PlanningRuleSet {
    if (!isIndianaTown(j)) {
      // For now, treat non-town Indiana units the same until we specialize them.
    }

    const caseTypes: string[] = [
      'USE_VARIANCE',
      'DEVELOPMENT_STANDARDS_VARIANCE',
      'REZONE',
      'PRIMARY_PLAT',
      'SECONDARY_PLAT',
      'TEXT_AMENDMENT',
      'MAP_AMENDMENT',
      'SPECIAL_EXCEPTION',
      'DEVELOPMENT_PLAN',
    ];

    const findingsTemplates: TemplateDescriptor[] = [
      {
        id: 'BZA_USE_VARIANCE_FINDINGS',
        purpose: 'BZA_FINDINGS',
        description:
          'Findings of fact template for use variance cases, tracking the statutory criteria for use variances.',
      },
      {
        id: 'BZA_DEVELOPMENT_VARIANCE_FINDINGS',
        purpose: 'BZA_FINDINGS',
        description:
          'Findings of fact template for development standards variance cases.',
      },
      {
        id: 'BZA_SPECIAL_EXCEPTION_FINDINGS',
        purpose: 'BZA_FINDINGS',
        description:
          'Findings of fact template for special exception/conditional use approvals.',
      },
      {
        id: 'PLANCOM_REZONE_RECOMMENDATION',
        purpose: 'PLANCOM_FINDINGS',
        description:
          'Recommendation findings template for Plan Commission map amendment (rezone) petitions.',
      },
      {
        id: 'PLANCOM_PLAT_APPROVAL',
        purpose: 'PLANCOM_FINDINGS',
        description:
          'Basic findings template for primary/secondary plat approvals.',
      },
    ];

    return {
      caseTypes,
      findingsTemplates,
    };
  }

  //
  // TEMPLATE RENDERING
  //

  renderTemplate(templateId: string, data: unknown): string {
    // For now we just return a placeholder string.
    // Later we will plug in a real template engine (e.g. Handlebars/ETA) and
    // store Indiana-specific templates keyed by templateId.

    return `Template ${templateId} (IN) not implemented yet. Data: ${JSON.stringify(
      data,
    )}`;
  }
}