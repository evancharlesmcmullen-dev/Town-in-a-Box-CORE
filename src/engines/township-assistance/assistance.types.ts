// src/engines/township-assistance/assistance.types.ts

// Core types for township (poor relief) assistance cases.

export type AssistanceCaseStatus =
  | 'open'
  | 'pendingDocumentation'
  | 'underReview'
  | 'approved'
  | 'denied'
  | 'paid'
  | 'closed';

export type AssistanceBenefitType =
  | 'rent'
  | 'mortgage'
  | 'utilities'
  | 'food'
  | 'transportation'
  | 'medical'
  | 'other';

export interface AssistanceProgramPolicy {
  id: string;
  tenantId: string;

  name: string;                // e.g. "General Assistance"
  description?: string;

  // Later: income thresholds, asset limits, etc.
  isActive: boolean;
}

/**
 * A single household member.
 */
export interface HouseholdMember {
  name: string;
  age?: number;
  relationship?: string;       // e.g. "applicant", "spouse", "child"
}

/**
 * An application for township assistance.
 */
export interface AssistanceApplication {
  id: string;
  tenantId: string;

  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  household: HouseholdMember[];

  // Basic financial snapshot fields (to be refined later).
  monthlyIncomeCents?: number;
  monthlyExpensesCents?: number;

  requestedBenefitTypes: AssistanceBenefitType[];
  requestedAmountCents?: number;

  createdAt: Date;
}

/**
 * A township assistance case derived from an application.
 */
export interface AssistanceCase {
  id: string;
  tenantId: string;

  applicationId: string;
  programPolicyId?: string;

  status: AssistanceCaseStatus;

  assignedWorkerUserId?: string;

  openedAt: Date;
  decidedAt?: Date;
  closedAt?: Date;

  // Link into Records for documentation, landlord letters, etc.
  relatedRecordIds?: string[];
}

/**
 * A single approved benefit payment.
 */
export interface AssistanceBenefit {
  id: string;
  tenantId: string;

  caseId: string;
  type: AssistanceBenefitType;

  amountCents: number;
  payeeName: string;           // Landlord, utility, etc.
  payeeAddressLine1?: string;
  payeeAddressLine2?: string;
  payeeCity?: string;
  payeeState?: string;
  payeePostalCode?: string;

  approvedAt: Date;
  paidAt?: Date;
}

/**
 * Summary view for list screens.
 */
export interface AssistanceCaseSummary {
  id: string;
  tenantId: string;
  applicantName: string;
  status: AssistanceCaseStatus;
  openedAt: Date;
  decidedAt?: Date;
}