// src/engines/fence-viewer/fence-viewer.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FenceViewerCase,
  FenceViewerCaseSummary,
  FenceViewerCaseStatus,
  FenceDisputeType,
  FenceViewerParty,
  FenceInspection,
  FenceViewerDecision,
} from './fence-viewer.types';

//
// INPUT TYPES
//

export interface CreateFenceViewerCaseInput {
  disputeType: FenceDisputeType;
  fenceLocationDescription: string;
  petitionReceivedAt?: Date;       // Defaults to now
  notes?: string;
}

export interface UpdateFenceViewerCaseInput {
  disputeType?: FenceDisputeType;
  status?: FenceViewerCaseStatus;
  fenceLocationDescription?: string;
  scheduledInspectionAt?: Date;
  notes?: string;
}

export interface AddFenceViewerPartyInput {
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
  parcelNumber?: string;
  parcelDescription?: string;
  notes?: string;
}

export interface RecordFenceInspectionInput {
  caseId: string;
  inspectionDate: Date;
  inspectorName: string;
  locationDescription: string;
  currentFenceCondition?: string;
  measurements?: string;
  photoAttachmentIds?: string[];
  findings: string;
  recommendations?: string;
}

export interface IssueFenceViewerDecisionInput {
  caseId: string;
  decisionDate?: Date;             // Defaults to now
  issuedByName: string;
  petitionerSharePercent: number;
  respondentSharePercent: number;
  estimatedTotalCostCents?: number;
  fenceTypeRequired?: string;
  fenceLocationDescription?: string;
  decisionNarrative: string;
  statutoryCitation?: string;
  appealDeadlineDays?: number;     // Defaults to 10 days per IC 32-26-9-7
}

//
// FILTER TYPES
//

export interface FenceViewerCaseFilter {
  status?: FenceViewerCaseStatus;
  disputeType?: FenceDisputeType;
  partyNameContains?: string;
  fromDate?: Date;
  toDate?: Date;
}

//
// SERVICE INTERFACE
//

/**
 * Public service interface for the Fence Viewer engine.
 *
 * Township trustees serve as fence viewers under IC 32-26 (division fences).
 * This engine manages petitions, inspections, and decisions regarding fence
 * disputes between adjoining landowners.
 *
 * Implementations will:
 * - Track fence viewer cases from petition to resolution.
 * - Record parties (petitioner, respondent) with parcel information.
 * - Record inspections and measurements.
 * - Issue decisions with cost allocations.
 * - Link to Records for attachments and documentation.
 *
 * TODO: Future GIS integration for parcel geometry and fence lines.
 */
export interface FenceViewerService {
  //
  // CASES
  //

  /**
   * Create a new fence viewer case from a petition.
   * Automatically generates a case number and sets status to 'petition_received'.
   */
  createCase(
    ctx: TenantContext,
    input: CreateFenceViewerCaseInput
  ): Promise<FenceViewerCase>;

  /**
   * Get a single fence viewer case with all related data.
   */
  getCase(
    ctx: TenantContext,
    id: string
  ): Promise<FenceViewerCase | null>;

  /**
   * List fence viewer cases with optional filtering.
   */
  listCases(
    ctx: TenantContext,
    filter?: FenceViewerCaseFilter
  ): Promise<FenceViewerCaseSummary[]>;

  /**
   * Update case metadata or status.
   */
  updateCase(
    ctx: TenantContext,
    id: string,
    input: UpdateFenceViewerCaseInput
  ): Promise<FenceViewerCase>;

  /**
   * Schedule an inspection for a case.
   */
  scheduleInspection(
    ctx: TenantContext,
    caseId: string,
    scheduledAt: Date
  ): Promise<FenceViewerCase>;

  /**
   * Close a case after resolution.
   */
  closeCase(
    ctx: TenantContext,
    caseId: string,
    reason?: string
  ): Promise<FenceViewerCase>;

  //
  // PARTIES
  //

  /**
   * Add a party (petitioner or respondent) to a case.
   */
  addParty(
    ctx: TenantContext,
    input: AddFenceViewerPartyInput
  ): Promise<FenceViewerParty>;

  /**
   * List parties for a case.
   */
  listPartiesForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<FenceViewerParty[]>;

  /**
   * Remove a party from a case.
   */
  removeParty(
    ctx: TenantContext,
    partyId: string
  ): Promise<void>;

  //
  // INSPECTIONS
  //

  /**
   * Record an inspection/site visit for a case.
   */
  recordInspection(
    ctx: TenantContext,
    input: RecordFenceInspectionInput
  ): Promise<FenceInspection>;

  /**
   * List inspections for a case.
   */
  listInspectionsForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<FenceInspection[]>;

  //
  // DECISIONS
  //

  /**
   * Issue a decision for a case.
   * This updates the case status to 'decision_issued' and calculates
   * cost allocations based on the percentages provided.
   */
  issueDecision(
    ctx: TenantContext,
    input: IssueFenceViewerDecisionInput
  ): Promise<FenceViewerDecision>;

  /**
   * Get the decision for a case (if issued).
   */
  getDecisionForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<FenceViewerDecision | null>;

  /**
   * Record that a decision has been appealed.
   */
  recordAppeal(
    ctx: TenantContext,
    caseId: string,
    appealOutcome?: string
  ): Promise<FenceViewerCase>;
}
