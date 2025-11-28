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
// Assistance rules (township poor relief).
export interface AssistanceRuleSet {
  decisionDeadlineHours?: number;   // e.g. 72 hours for emergency cases
  requiresWrittenStandards: boolean;
}

// Compliance task definition template, to be materialized per tenant.
export interface ComplianceTaskTemplate {
  code: string;
  name: string;
  description?: string;
  statutoryCitation?: string;
  recurrenceHint?: string;          // "annual in January", etc.
}
// Later we'll extend this file with FinanceRuleSet, UtilitiesRuleSet, etc.

// =============================================================================
// LEGAL TEMPLATE ENGINE TYPES
// =============================================================================

/**
 * Enumeration of supported legal template kinds.
 * Each kind corresponds to a specific document type.
 */
export type LegalTemplateKind =
  // APRA (Access to Public Records Act)
  | 'APRA_FULFILLMENT_STANDARD'
  | 'APRA_DENIAL_STANDARD'
  // Meetings / Open Door Law
  | 'MEETING_NOTICE_TOWN_COUNCIL_REGULAR'
  | 'MEETING_NOTICE_TOWN_COUNCIL_SPECIAL'
  // BZA (Board of Zoning Appeals)
  | 'BZA_FINDINGS_USE_VARIANCE';
  // Future: Add more template kinds as needed

/**
 * A rendered legal document ready for use.
 */
export interface RenderedLegalDocument {
  /** The template kind used to generate this document */
  kind: LegalTemplateKind;
  /** Document title (e.g., "Notice of Regular Meeting") */
  title: string;
  /** Full document body in markdown/plaintext */
  body: string;
  /** Suggested filename for export (e.g., "2025-01-15-town-council-regular-meeting-notice.docx") */
  suggestedFileName: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// TEMPLATE CONTEXT TYPES
// =============================================================================

/**
 * Context data for APRA response letter templates.
 */
export interface ApraTemplateContext {
  /** Unique request identifier */
  requestId: string;
  /** Name of the person who made the request */
  requesterName: string;
  /** Email of the requester (optional) */
  requesterEmail?: string;
  /** Description of records requested */
  description: string;
  /** Date request was received (ISO string) */
  receivedAt: string;
  /** Statutory deadline date (ISO string, optional) */
  statutoryDeadlineAt?: string;
  /** Exemptions cited for denial/partial denial */
  exemptions?: {
    citation: string;
    description: string;
  }[];
  /** Total fees in cents */
  totalFeesCents?: number;
  /** Pre-formatted fee string (e.g., "$25.00") */
  formattedTotalFees?: string;
  /** Name of the jurisdiction (e.g., "Town of Lapel") */
  jurisdictionName: string;
}

/**
 * Context data for meeting notice templates.
 */
export interface MeetingNoticeTemplateContext {
  /** Unique meeting identifier */
  meetingId: string;
  /** Name of the governing body (e.g., "Town Council", "Plan Commission") */
  governingBodyName: string;
  /** Meeting date (ISO string) */
  meetingDate: string;
  /** Meeting time (local time string, e.g., "7:00 PM") */
  meetingTime: string;
  /** Name of the meeting location */
  locationName: string;
  /** Full address of the meeting location (optional) */
  locationAddress?: string;
  /** Type of meeting */
  meetingType: 'regular' | 'special' | 'emergency' | 'executiveSession';
  /** Summary of agenda items (optional) */
  agendaSummary?: string;
  /** List of agenda item titles (optional) */
  agendaItems?: string[];
  /** Statutes cited (e.g., ["IC 5-14-1.5-5"]) */
  statutesCited?: string[];
  /** Name of the jurisdiction (e.g., "Town of Lapel") */
  jurisdictionName: string;
}

/**
 * Context data for BZA use variance findings templates.
 */
export interface BzaUseVarianceTemplateContext {
  /** Case number (e.g., "BZA-2025-001") */
  caseNumber: string;
  /** Name of the applicant */
  applicantName: string;
  /** Property street address */
  propertyAddress: string;
  /** Legal description of the property (optional) */
  legalDescription?: string;
  /** Date of the hearing (ISO string) */
  dateOfHearing: string;
  /** Full name of the board (e.g., "Town of Lapel Board of Zoning Appeals") */
  boardName: string;
  /** Findings of fact for statutory criteria */
  findings: {
    /** Finding regarding unnecessary hardship (IC 36-7-4-918.4(a)(1)) */
    unnecessaryHardship: string;
    /** Finding regarding public welfare (IC 36-7-4-918.4(a)(2)) */
    publicWelfare: string;
    /** Finding regarding comprehensive plan (IC 36-7-4-918.4(a)(3)) */
    comprehensivePlan: string;
  };
  /** Board decision */
  decision: 'APPROVED' | 'DENIED';
  /** Conditions attached to approval (if any) */
  conditions?: string[];
  /** Statutes cited (e.g., ["IC 36-7-4-918.4"]) */
  statutesCited?: string[];
  /** Name of the jurisdiction (e.g., "Town of Lapel") */
  jurisdictionName: string;
}

/**
 * Union type for all template contexts.
 */
export type LegalTemplateContext =
  | ApraTemplateContext
  | MeetingNoticeTemplateContext
  | BzaUseVarianceTemplateContext;

/**
 * Interface for legal template renderers.
 * Implementations convert template kinds + context into rendered documents.
 */
export interface LegalTemplateRenderer {
  /**
   * Render a legal document from a template.
   *
   * @param kind - The type of template to render
   * @param context - Context data for the template
   * @returns The rendered legal document
   */
  render(
    kind: LegalTemplateKind,
    context: LegalTemplateContext
  ): Promise<RenderedLegalDocument>;
}
