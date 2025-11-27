// src/engines/fence-viewer/fence-viewer.types.ts

// Core types for township fence viewer cases under IC 32-26 (division fences).

/**
 * Status of a fence viewer case.
 */
export type FenceViewerCaseStatus =
  | 'petition_received'
  | 'scheduled'
  | 'inspection_completed'
  | 'decision_issued'
  | 'appealed'
  | 'closed';

/**
 * Type of fence dispute or petition.
 */
export type FenceDisputeType =
  | 'new_construction'      // Request for new division fence
  | 'repair'                // Existing fence needs repair
  | 'replacement'           // Existing fence needs replacement
  | 'cost_allocation'       // Dispute over cost sharing
  | 'location'              // Dispute over fence location
  | 'type_or_standard'      // Dispute over fence type/standard
  | 'other';

/**
 * A party involved in a fence viewer case (property owner).
 */
export interface FenceViewerParty {
  id: string;
  caseId: string;

  name: string;
  role: 'petitioner' | 'respondent';

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  phone?: string;
  email?: string;

  // Parcel identification
  parcelNumber?: string;
  parcelDescription?: string;

  // TODO: Future GIS integration
  // parcelGeometryId?: string;

  notes?: string;
}

/**
 * A fence viewer inspection/site visit.
 */
export interface FenceInspection {
  id: string;
  caseId: string;

  inspectionDate: Date;
  inspectorName: string;           // Trustee or designated viewer

  // Location and findings
  locationDescription: string;     // Text description for now
  currentFenceCondition?: string;  // Description of existing fence (if any)
  measurements?: string;           // Measurements taken
  photoAttachmentIds?: string[];   // References to attached photos

  // TODO: Future GIS integration
  // fenceLineGeometryId?: string;
  // photoGeolocations?: Array<{ lat: number; lng: number; photoId: string }>;

  findings: string;                // Inspector's narrative findings
  recommendations?: string;

  createdAt: Date;
}

/**
 * A decision issued in a fence viewer case.
 */
export interface FenceViewerDecision {
  id: string;
  caseId: string;

  decisionDate: Date;
  issuedByName: string;            // Trustee name

  // Cost allocation
  petitionerSharePercent: number;  // 0-100
  respondentSharePercent: number;  // 0-100

  estimatedTotalCostCents?: number;
  petitionerCostCents?: number;
  respondentCostCents?: number;

  // Fence specifications
  fenceTypeRequired?: string;      // Type of fence to be built
  fenceLocationDescription?: string;

  // Narrative
  decisionNarrative: string;       // Full decision text

  // Statutory citation
  statutoryCitation?: string;      // e.g., "IC 32-26-9"

  // Appeal information
  appealDeadlineDate?: Date;
  wasAppealed?: boolean;
  appealOutcome?: string;

  createdAt: Date;
}

/**
 * A fence viewer case.
 */
export interface FenceViewerCase {
  id: string;
  tenantId: string;

  caseNumber: string;              // Township-assigned case number
  disputeType: FenceDisputeType;
  status: FenceViewerCaseStatus;

  // Location of the fence line
  fenceLocationDescription: string;

  // TODO: Future GIS integration
  // fenceLineGeometryId?: string;

  // Related entities
  parties?: FenceViewerParty[];
  inspections?: FenceInspection[];
  decision?: FenceViewerDecision;

  // Attachments (references to Records/APRA)
  relatedRecordIds?: string[];

  // Dates
  petitionReceivedAt: Date;
  scheduledInspectionAt?: Date;
  decisionIssuedAt?: Date;
  closedAt?: Date;

  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Summary view for fence viewer cases (list screens).
 */
export interface FenceViewerCaseSummary {
  id: string;
  tenantId: string;
  caseNumber: string;
  disputeType: FenceDisputeType;
  status: FenceViewerCaseStatus;
  petitionerName?: string;
  respondentName?: string;
  fenceLocationDescription: string;
  petitionReceivedAt: Date;
}
