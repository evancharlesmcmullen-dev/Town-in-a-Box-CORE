// src/engines/weed-control/weed-control.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  WeedComplaint,
  WeedComplaintSummary,
  WeedControlCaseStatus,
  WeedViolationType,
  NoticeDeliveryMethod,
  WeedNotice,
  WeedInspection,
  WeedAbatement,
} from './weed-control.types';

//
// INPUT TYPES
//

export interface CreateWeedComplaintInput {
  violationType: WeedViolationType;
  violationDescription: string;

  // Complainant (optional if anonymous)
  complainantName?: string;
  complainantPhone?: string;
  complainantEmail?: string;
  isAnonymous?: boolean;

  // Property owner
  propertyOwnerName?: string;
  propertyOwnerAddressLine1?: string;
  propertyOwnerAddressLine2?: string;
  propertyOwnerCity?: string;
  propertyOwnerState?: string;
  propertyOwnerPostalCode?: string;

  // Site location
  siteAddressLine1?: string;
  siteAddressLine2?: string;
  siteCity?: string;
  siteState?: string;
  sitePostalCode?: string;
  parcelNumber?: string;

  notes?: string;
}

export interface UpdateWeedComplaintInput {
  violationType?: WeedViolationType;
  status?: WeedControlCaseStatus;
  violationDescription?: string;
  propertyOwnerName?: string;
  propertyOwnerAddressLine1?: string;
  propertyOwnerAddressLine2?: string;
  propertyOwnerCity?: string;
  propertyOwnerState?: string;
  propertyOwnerPostalCode?: string;
  abatementDeadlineAt?: Date;
  notes?: string;
}

export interface SendWeedNoticeInput {
  complaintId: string;
  noticeType: 'initial' | 'follow_up' | 'final';
  deliveryMethod: NoticeDeliveryMethod;
  sentToName: string;
  sentToAddress: string;
  complianceDeadlineDays: number;    // Days from now until deadline
  noticeContent?: string;
  statutoryCitation?: string;
  trackingNumber?: string;
}

export interface RecordWeedInspectionInput {
  complaintId: string;
  inspectionDate?: Date;             // Defaults to now
  inspectorName: string;
  isCompliant: boolean;
  findingsDescription: string;
  photoAttachmentIds?: string[];
}

export interface RecordWeedAbatementInput {
  complaintId: string;
  abatementDate?: Date;              // Defaults to now
  performedBy: string;
  workDescription: string;
  laborCostCents: number;
  equipmentCostCents: number;
  materialsCostCents: number;
  administrativeCostCents: number;
  notes?: string;
}

export interface CertifyCostsInput {
  abatementId: string;
  certificationDate?: Date;          // Defaults to now
  countyRecordingReference?: string;
}

//
// FILTER TYPES
//

export interface WeedComplaintFilter {
  status?: WeedControlCaseStatus;
  violationType?: WeedViolationType;
  propertyOwnerNameContains?: string;
  siteAddressContains?: string;
  fromDate?: Date;
  toDate?: Date;
  hasOverdueDeadline?: boolean;
}

//
// SERVICE INTERFACE
//

/**
 * Public service interface for the Weed Control engine.
 *
 * Townships enforce weed control under IC 15-16-8 (detrimental plants/noxious weeds).
 * This engine manages complaints, notices, inspections, abatement, and cost recovery.
 *
 * Implementations will:
 * - Track weed complaints from receipt to resolution.
 * - Send notices to property owners with compliance deadlines.
 * - Record inspections and compliance status.
 * - Track township abatement and cost recovery via tax liens.
 * - Link to Records for photos and documentation.
 * - Link to Finance for abatement costs and reimbursements.
 *
 * TODO: Future GIS integration for parcel mapping.
 */
export interface WeedControlService {
  //
  // COMPLAINTS
  //

  /**
   * Create a new weed complaint.
   * Automatically generates a case number and sets status to 'complaint_received'.
   */
  createComplaint(
    ctx: TenantContext,
    input: CreateWeedComplaintInput
  ): Promise<WeedComplaint>;

  /**
   * Get a single complaint with all related data.
   */
  getComplaint(
    ctx: TenantContext,
    id: string
  ): Promise<WeedComplaint | null>;

  /**
   * List complaints with optional filtering.
   */
  listComplaints(
    ctx: TenantContext,
    filter?: WeedComplaintFilter
  ): Promise<WeedComplaintSummary[]>;

  /**
   * Update complaint metadata or status.
   */
  updateComplaint(
    ctx: TenantContext,
    id: string,
    input: UpdateWeedComplaintInput
  ): Promise<WeedComplaint>;

  /**
   * Mark a complaint as complied (owner resolved the issue).
   */
  markComplied(
    ctx: TenantContext,
    complaintId: string,
    notes?: string
  ): Promise<WeedComplaint>;

  /**
   * Close a complaint.
   */
  closeComplaint(
    ctx: TenantContext,
    complaintId: string,
    reason?: string
  ): Promise<WeedComplaint>;

  //
  // NOTICES
  //

  /**
   * Send a notice to the property owner.
   * Updates complaint status to 'notice_sent' and sets abatement deadline.
   */
  sendNotice(
    ctx: TenantContext,
    input: SendWeedNoticeInput
  ): Promise<WeedNotice>;

  /**
   * List notices sent for a complaint.
   */
  listNoticesForComplaint(
    ctx: TenantContext,
    complaintId: string
  ): Promise<WeedNotice[]>;

  /**
   * Record that a notice was delivered (for certified mail tracking).
   */
  recordNoticeDelivery(
    ctx: TenantContext,
    noticeId: string,
    deliveryConfirmedAt: Date
  ): Promise<WeedNotice>;

  /**
   * Record that a notice was returned undeliverable.
   */
  recordNoticeReturned(
    ctx: TenantContext,
    noticeId: string
  ): Promise<WeedNotice>;

  //
  // INSPECTIONS
  //

  /**
   * Record an inspection/follow-up visit.
   */
  recordInspection(
    ctx: TenantContext,
    input: RecordWeedInspectionInput
  ): Promise<WeedInspection>;

  /**
   * List inspections for a complaint.
   */
  listInspectionsForComplaint(
    ctx: TenantContext,
    complaintId: string
  ): Promise<WeedInspection[]>;

  //
  // ABATEMENT
  //

  /**
   * Record abatement performed by the township.
   * Updates complaint status to 'abatement_completed'.
   */
  recordAbatement(
    ctx: TenantContext,
    input: RecordWeedAbatementInput
  ): Promise<WeedAbatement>;

  /**
   * Get abatement record for a complaint.
   */
  getAbatementForComplaint(
    ctx: TenantContext,
    complaintId: string
  ): Promise<WeedAbatement | null>;

  /**
   * Certify abatement costs to the county auditor for tax lien.
   * Updates complaint status to 'cost_recovery_pending'.
   */
  certifyCostsToCounty(
    ctx: TenantContext,
    input: CertifyCostsInput
  ): Promise<WeedAbatement>;

  /**
   * Record that costs have been recovered (via tax payment or direct payment).
   */
  recordCostRecovery(
    ctx: TenantContext,
    abatementId: string,
    recoveryAmountCents: number,
    recoveredAt?: Date
  ): Promise<WeedAbatement>;

  //
  // REPORTING
  //

  /**
   * Get complaints with overdue compliance deadlines.
   */
  getOverdueComplaints(
    ctx: TenantContext
  ): Promise<WeedComplaintSummary[]>;

  /**
   * Get summary statistics for weed control cases.
   */
  getCaseStatistics(
    ctx: TenantContext,
    year?: number
  ): Promise<WeedControlStatistics>;
}

/**
 * Summary statistics for weed control cases.
 */
export interface WeedControlStatistics {
  totalComplaints: number;
  complaintsComplied: number;
  complaintsAbated: number;
  complaintsClosed: number;
  totalAbatementCostsCents: number;
  totalRecoveredCents: number;
}
