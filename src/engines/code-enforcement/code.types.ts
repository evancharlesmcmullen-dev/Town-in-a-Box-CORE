// src/engines/code-enforcement/code.types.ts

// Core types for ordinance/code enforcement cases.

export type CodeCaseStatus =
  | 'open'
  | 'investigating'
  | 'noticeSent'
  | 'complianceInProgress'
  | 'complied'
  | 'nonCompliant'
  | 'referred'
  | 'closed';

export type ViolationSeverity =
  | 'minor'
  | 'moderate'
  | 'major'
  | 'critical';

export interface CodeViolationType {
  id: string;
  tenantId: string;

  codeSection: string;        // e.g. "8.12.030"
  description: string;        // plain language
  defaultSeverity: ViolationSeverity;

  // Later: link to FeeItem/Fine schedules, abatement options, etc.
  isActive: boolean;
}

/**
 * A single code enforcement case (e.g. tall grass, junk vehicles, unsafe building).
 */
export interface CodeCase {
  id: string;
  tenantId: string;

  violationTypeId: string;

  respondentName?: string;
  respondentAddressLine1?: string;
  respondentAddressLine2?: string;
  respondentCity?: string;
  respondentState?: string;
  respondentPostalCode?: string;

  // Location of the property in violation.
  siteAddressLine1?: string;
  siteAddressLine2?: string;
  siteCity?: string;
  siteState?: string;
  sitePostalCode?: string;

  status: CodeCaseStatus;

  createdAt: Date;
  createdByUserId?: string;

  firstNoticeSentAt?: Date;
  lastNoticeSentAt?: Date;
  compliedAt?: Date;
  closedAt?: Date;

  // Link into Records for photos, inspection reports, etc.
  relatedRecordIds?: string[];
}

/**
 * Summary view for list screens.
 */
export interface CodeCaseSummary {
  id: string;
  tenantId: string;
  violationTypeId: string;
  respondentName?: string;
  siteAddressLine1?: string;
  status: CodeCaseStatus;
  createdAt: Date;
}