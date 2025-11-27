// src/engines/policies/policy.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  PolicyDocument,
  PolicyDocumentSummary,
  PolicyDocumentType,
  PolicyCategory,
  PolicyStatus,
  PolicyReview,
  PolicyAcknowledgment,
} from './policy.types';

//
// INPUT TYPES
//

export interface CreatePolicyDocumentInput {
  documentType: PolicyDocumentType;
  category: PolicyCategory;
  title: string;
  description?: string;
  documentNumber?: string;
  version?: string;                // Defaults to "1.0"
  effectiveDate: Date;
  expirationDate?: Date;
  adoptedAt?: Date;
  adoptedByBodyName?: string;
  adoptedByResolutionId?: string;
  meetingId?: string;
  summaryText?: string;
  fullText?: string;
  attachmentIds?: string[];
  keywords?: string[];
  statutoryCitations?: string[];
  notes?: string;
}

export interface UpdatePolicyDocumentInput {
  documentType?: PolicyDocumentType;
  category?: PolicyCategory;
  status?: PolicyStatus;
  title?: string;
  description?: string;
  documentNumber?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  lastReviewedAt?: Date;
  adoptedAt?: Date;
  adoptedByBodyName?: string;
  adoptedByResolutionId?: string;
  meetingId?: string;
  summaryText?: string;
  fullText?: string;
  attachmentIds?: string[];
  keywords?: string[];
  statutoryCitations?: string[];
  notes?: string;
}

export interface CreateNewVersionInput {
  previousPolicyId: string;
  title?: string;                  // Defaults to previous title
  description?: string;
  effectiveDate: Date;
  summaryText?: string;
  fullText?: string;
  attachmentIds?: string[];
  changeNotes?: string;
}

export interface SchedulePolicyReviewInput {
  policyId: string;
  scheduledDate: Date;
  reviewerName?: string;
}

export interface CompletePolicyReviewInput {
  reviewId: string;
  reviewNotes?: string;
  changesRequired: boolean;
  newVersionId?: string;           // If review resulted in new version
}

export interface RecordAcknowledgmentInput {
  policyId: string;
  acknowledgedByName: string;
  acknowledgedByUserId?: string;
  certificationText?: string;
  signatureReference?: string;
}

//
// FILTER TYPES
//

export interface PolicyDocumentFilter {
  documentType?: PolicyDocumentType;
  category?: PolicyCategory;
  status?: PolicyStatus;
  titleContains?: string;
  keywordContains?: string;
  effectiveBefore?: Date;
  effectiveAfter?: Date;
  requiresReviewBefore?: Date;
}

//
// SERVICE INTERFACE
//

/**
 * Public service interface for the Policies & Resolutions Registry.
 *
 * This is a shared module that allows all municipality types to:
 * - Store and retrieve policy documents, resolutions, and standards.
 * - Track version history and supersession.
 * - Schedule and track policy reviews.
 * - Record acknowledgments and certifications.
 *
 * Implementations will:
 * - Manage the policy document lifecycle.
 * - Link to Meetings for adoption records.
 * - Link to Records for document storage.
 * - Support searching by category, type, and keywords.
 */
export interface PolicyService {
  //
  // POLICY DOCUMENTS
  //

  /**
   * Create a new policy document.
   * Initial status is 'draft' unless effectiveDate is in the past and adoptedAt is set.
   */
  createDocument(
    ctx: TenantContext,
    input: CreatePolicyDocumentInput
  ): Promise<PolicyDocument>;

  /**
   * Get a single policy document.
   */
  getDocument(
    ctx: TenantContext,
    id: string
  ): Promise<PolicyDocument | null>;

  /**
   * List policy documents with optional filtering.
   */
  listDocuments(
    ctx: TenantContext,
    filter?: PolicyDocumentFilter
  ): Promise<PolicyDocumentSummary[]>;

  /**
   * Update a policy document.
   */
  updateDocument(
    ctx: TenantContext,
    id: string,
    input: UpdatePolicyDocumentInput
  ): Promise<PolicyDocument>;

  /**
   * Create a new version of a policy, superseding the previous version.
   * The previous version is marked as 'superseded'.
   */
  createNewVersion(
    ctx: TenantContext,
    input: CreateNewVersionInput
  ): Promise<PolicyDocument>;

  /**
   * Activate a draft policy (set status to 'active').
   */
  activateDocument(
    ctx: TenantContext,
    id: string
  ): Promise<PolicyDocument>;

  /**
   * Archive a policy (set status to 'archived').
   */
  archiveDocument(
    ctx: TenantContext,
    id: string
  ): Promise<PolicyDocument>;

  /**
   * Get the version history for a policy.
   * Returns all versions, including superseded ones.
   */
  getVersionHistory(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyDocumentSummary[]>;

  /**
   * Search policies by keyword or text.
   */
  searchPolicies(
    ctx: TenantContext,
    query: string
  ): Promise<PolicyDocumentSummary[]>;

  //
  // POLICY REVIEWS
  //

  /**
   * Schedule a review for a policy.
   */
  scheduleReview(
    ctx: TenantContext,
    input: SchedulePolicyReviewInput
  ): Promise<PolicyReview>;

  /**
   * Complete a scheduled review.
   */
  completeReview(
    ctx: TenantContext,
    input: CompletePolicyReviewInput
  ): Promise<PolicyReview>;

  /**
   * List reviews for a policy.
   */
  listReviewsForPolicy(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyReview[]>;

  /**
   * Get upcoming reviews (scheduled but not completed).
   */
  getUpcomingReviews(
    ctx: TenantContext,
    withinDays: number
  ): Promise<PolicyReview[]>;

  //
  // ACKNOWLEDGMENTS
  //

  /**
   * Record an acknowledgment of a policy by an official or employee.
   * Used for conflict of interest certifications, policy acknowledgments, etc.
   */
  recordAcknowledgment(
    ctx: TenantContext,
    input: RecordAcknowledgmentInput
  ): Promise<PolicyAcknowledgment>;

  /**
   * List acknowledgments for a policy.
   */
  listAcknowledgmentsForPolicy(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyAcknowledgment[]>;

  /**
   * Check if a person has acknowledged a policy.
   */
  hasAcknowledged(
    ctx: TenantContext,
    policyId: string,
    acknowledgedByName: string
  ): Promise<boolean>;

  //
  // CONVENIENCE METHODS
  //

  /**
   * Get all active policies in a category.
   * Useful for retrieving current eligibility standards, etc.
   */
  getActivePoliciesInCategory(
    ctx: TenantContext,
    category: PolicyCategory
  ): Promise<PolicyDocumentSummary[]>;

  /**
   * Get the current (active) version of a policy by document number.
   */
  getCurrentVersionByNumber(
    ctx: TenantContext,
    documentNumber: string
  ): Promise<PolicyDocument | null>;
}
