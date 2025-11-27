// src/engines/weed-control/weed-control.types.ts

// Core types for township weed control/noxious weed enforcement under IC 15-16-8.

/**
 * Status of a weed control case.
 */
export type WeedControlCaseStatus =
  | 'complaint_received'
  | 'notice_sent'
  | 'pending_inspection'
  | 'complied'
  | 'non_compliant'
  | 'abatement_scheduled'
  | 'abatement_completed'
  | 'cost_recovery_pending'
  | 'cost_recovered'
  | 'closed';

/**
 * Type of weed violation.
 */
export type WeedViolationType =
  | 'noxious_weeds'           // IC 15-16-8 listed noxious weeds
  | 'tall_grass'              // Excessive grass height
  | 'detrimental_plants'      // Other detrimental plants
  | 'other';

/**
 * Method of notice delivery.
 */
export type NoticeDeliveryMethod =
  | 'certified_mail'
  | 'first_class_mail'
  | 'personal_service'
  | 'posting';

/**
 * A complaint about weeds/vegetation on a property.
 */
export interface WeedComplaint {
  id: string;
  tenantId: string;

  violationType: WeedViolationType;
  status: WeedControlCaseStatus;
  caseNumber: string;

  // Complainant information (may be anonymous)
  complainantName?: string;
  complainantPhone?: string;
  complainantEmail?: string;
  isAnonymous: boolean;

  // Property information
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

  // TODO: Future GIS integration
  // parcelGeometryId?: string;

  // Description
  violationDescription: string;

  // Attachments (references to Records)
  relatedRecordIds?: string[];

  // Dates
  complaintReceivedAt: Date;
  abatementDeadlineAt?: Date;
  closedAt?: Date;

  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * A notice sent to a property owner.
 */
export interface WeedNotice {
  id: string;
  complaintId: string;

  noticeType: 'initial' | 'follow_up' | 'final';
  deliveryMethod: NoticeDeliveryMethod;

  sentAt: Date;
  sentToName: string;
  sentToAddress: string;

  // Deadline for compliance
  complianceDeadlineAt: Date;

  // Tracking for certified mail
  trackingNumber?: string;
  deliveryConfirmedAt?: Date;
  returnedUndeliverable?: boolean;

  // Content
  noticeContent?: string;

  // Statutory citation
  statutoryCitation?: string;

  createdAt: Date;
}

/**
 * An inspection/follow-up visit.
 */
export interface WeedInspection {
  id: string;
  complaintId: string;

  inspectionDate: Date;
  inspectorName: string;

  // Findings
  isCompliant: boolean;
  findingsDescription: string;
  photoAttachmentIds?: string[];

  // TODO: Future GIS integration for photo geolocations

  createdAt: Date;
}

/**
 * Abatement performed by the township.
 */
export interface WeedAbatement {
  id: string;
  complaintId: string;

  abatementDate: Date;
  performedBy: string;           // Contractor or township staff

  // Work performed
  workDescription: string;

  // Costs
  laborCostCents: number;
  equipmentCostCents: number;
  materialsCostCents: number;
  administrativeCostCents: number;
  totalCostCents: number;

  // Cost recovery
  certifiedToCountyAt?: Date;    // When costs were certified for tax lien
  countyRecordingReference?: string;
  recoveredAt?: Date;
  recoveryAmountCents?: number;

  notes?: string;
  createdAt: Date;
}

/**
 * Summary view for weed complaints (list screens).
 */
export interface WeedComplaintSummary {
  id: string;
  tenantId: string;
  caseNumber: string;
  violationType: WeedViolationType;
  status: WeedControlCaseStatus;
  siteAddressLine1?: string;
  propertyOwnerName?: string;
  complaintReceivedAt: Date;
  abatementDeadlineAt?: Date;
}
