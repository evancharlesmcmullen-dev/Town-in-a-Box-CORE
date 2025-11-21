// src/engines/permits/permit.types.ts

// Core types for permits and licenses (building, ROW, signs, events, business, etc.)

export type PermitCategory =
  | 'building'
  | 'rightOfWay'
  | 'sign'
  | 'event'
  | 'business'
  | 'other';

export type PermitStatus =
  | 'draft'
  | 'submitted'
  | 'underReview'
  | 'approved'
  | 'issued'
  | 'denied'
  | 'closed';

export interface PermitType {
  id: string;
  tenantId: string;

  code: string;                 // e.g. "BLDG_RES", "ROW_CUT", "SIGN_TEMP"
  name: string;
  description?: string;

  category: PermitCategory;
  isActive: boolean;

  // Later: references to FeeItems, required inspections, etc.
}

/**
 * High-level application record for a permit or license.
 */
export interface PermitApplication {
  id: string;
  tenantId: string;

  permitTypeId: string;

  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;

  siteAddressLine1?: string;
  siteAddressLine2?: string;
  siteCity?: string;
  siteState?: string;
  sitePostalCode?: string;

  status: PermitStatus;

  submittedAt?: Date;
  decidedAt?: Date;
  issuedAt?: Date;
  closedAt?: Date;

  // For now very generic; later we can add structured fields or data blobs.
  descriptionOfWork?: string;

  // Link into Records for uploaded plans/documents.
  relatedRecordIds?: string[];
}

/**
 * Summary view for list screens.
 */
export interface PermitSummary {
  id: string;
  tenantId: string;
  permitTypeId: string;
  applicantName: string;
  status: PermitStatus;
  submittedAt?: Date;
  issuedAt?: Date;
}