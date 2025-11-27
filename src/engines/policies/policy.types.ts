// src/engines/policies/policy.types.ts

// Core types for policies, resolutions, and governing documents registry.

/**
 * Type of policy document.
 */
export type PolicyDocumentType =
  | 'policy'              // Internal policy (personnel, procurement, etc.)
  | 'resolution'          // Board/council resolution
  | 'ordinance'           // Local ordinance (primarily for towns/cities)
  | 'standard'            // Eligibility standard (e.g., township assistance)
  | 'procedure'           // Operating procedure
  | 'certification'       // Certification (nepotism, conflict of interest)
  | 'agreement'           // Agreement or contract summary
  | 'bylaw'               // Bylaws or rules of procedure
  | 'other';

/**
 * Category of policy document.
 */
export type PolicyCategory =
  | 'financial'           // Financial policies, internal controls
  | 'personnel'           // Personnel policies, employee handbook
  | 'assistance'          // Township assistance eligibility standards
  | 'procurement'         // Purchasing and procurement
  | 'meetings'            // Rules of procedure, bylaws
  | 'records'             // Records retention, APRA response
  | 'ethics'              // Ethics, conflict of interest, nepotism
  | 'safety'              // Safety policies
  | 'technology'          // IT, cybersecurity
  | 'general';            // General administration

/**
 * Status of a policy document.
 */
export type PolicyStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'superseded'
  | 'expired'
  | 'archived';

/**
 * A policy document in the registry.
 */
export interface PolicyDocument {
  id: string;
  tenantId: string;

  documentType: PolicyDocumentType;
  category: PolicyCategory;
  status: PolicyStatus;

  // Identification
  documentNumber?: string;         // Resolution number, policy number, etc.
  title: string;
  description?: string;

  // Version tracking
  version: string;                 // e.g., "1.0", "2.1"
  previousVersionId?: string;      // Link to superseded version

  // Dates
  effectiveDate: Date;
  expirationDate?: Date;           // If policy has a sunset
  adoptedAt?: Date;                // When formally adopted by board
  lastReviewedAt?: Date;

  // Adoption information
  adoptedByBodyName?: string;      // e.g., "Township Board"
  adoptedByResolutionId?: string;  // Reference to adopting resolution
  meetingId?: string;              // Meeting where adopted

  // Content
  summaryText?: string;            // Brief summary of policy
  fullText?: string;               // Full policy text (may be large)

  // File attachments (references to Records or storage)
  attachmentIds?: string[];

  // Keywords for searching
  keywords?: string[];

  // Statutory/regulatory citations
  statutoryCitations?: string[];   // e.g., ["IC 5-4-1", "IC 36-1-4"]

  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  createdByUserId?: string;
}

/**
 * Summary view for policy documents (list screens).
 */
export interface PolicyDocumentSummary {
  id: string;
  tenantId: string;
  documentType: PolicyDocumentType;
  category: PolicyCategory;
  status: PolicyStatus;
  documentNumber?: string;
  title: string;
  version: string;
  effectiveDate: Date;
  expirationDate?: Date;
}

/**
 * A scheduled policy review.
 */
export interface PolicyReview {
  id: string;
  policyId: string;

  scheduledDate: Date;
  completedAt?: Date;

  reviewerName?: string;
  reviewNotes?: string;
  changesRequired: boolean;

  // If review resulted in new version
  newVersionId?: string;

  createdAt: Date;
}

/**
 * Policy acknowledgment by an official or employee.
 */
export interface PolicyAcknowledgment {
  id: string;
  policyId: string;

  acknowledgedByName: string;
  acknowledgedByUserId?: string;
  acknowledgedAt: Date;

  // For certifications (conflict of interest, nepotism)
  certificationText?: string;
  signatureReference?: string;     // Reference to signed document

  createdAt: Date;
}
