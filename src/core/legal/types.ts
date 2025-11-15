// Shared legal-rule types used by all state legal engines

export interface DeadlineRule {
  id: string;
  description: string;
  eventType: string;          // e.g. 'APRA_REQUEST_RECEIVED', 'MEETING_SCHEDULED'
  offsetDays?: number;
  offsetBusinessDays?: number;
}

export interface TemplateDescriptor {
  id: string;
  description: string;
  purpose: string;            // e.g. 'APRA_DENIAL', 'MEETING_NOTICE', 'BZA_FINDINGS'
}

export interface ApraExemption {
  id: string;
  citation: string;
  description: string;
}

export interface ApraRuleSet {
  deadlines: DeadlineRule[];
  exemptions: ApraExemption[];
  requiresReasonableParticularity: boolean;
}

export interface MeetingRuleSet {
  noticeDeadlines: DeadlineRule[];
  execSessionTopics: { code: string; description: string }[];
}

export interface PlanningRuleSet {
  caseTypes: string[];        // e.g. 'USE_VARIANCE', 'REZONE', 'PLAT'
  findingsTemplates: TemplateDescriptor[];
}

// Later we’ll extend this file with FinanceRuleSet, UtilitiesRuleSet, etc.
