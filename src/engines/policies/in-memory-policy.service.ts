// src/engines/policies/in-memory-policy.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  PolicyDocument,
  PolicyDocumentSummary,
  PolicyCategory,
  PolicyReview,
  PolicyAcknowledgment,
} from './policy.types';
import {
  PolicyService,
  CreatePolicyDocumentInput,
  UpdatePolicyDocumentInput,
  CreateNewVersionInput,
  SchedulePolicyReviewInput,
  CompletePolicyReviewInput,
  RecordAcknowledgmentInput,
  PolicyDocumentFilter,
} from './policy.service';

/**
 * Seed data structure for in-memory service.
 */
export interface InMemoryPolicySeedData {
  documents?: PolicyDocument[];
  reviews?: PolicyReview[];
  acknowledgments?: PolicyAcknowledgment[];
}

/**
 * In-memory implementation of the Policy service.
 * Used for testing and demo purposes.
 *
 * TODO: Implement PostgresPolicyService for production use.
 */
export class InMemoryPolicyService implements PolicyService {
  private documents: PolicyDocument[];
  private reviews: PolicyReview[];
  private acknowledgments: PolicyAcknowledgment[];

  constructor(seed: InMemoryPolicySeedData = {}) {
    this.documents = seed.documents ? [...seed.documents] : [];
    this.reviews = seed.reviews ? [...seed.reviews] : [];
    this.acknowledgments = seed.acknowledgments ? [...seed.acknowledgments] : [];
  }

  //
  // POLICY DOCUMENTS
  //

  async createDocument(
    ctx: TenantContext,
    input: CreatePolicyDocumentInput
  ): Promise<PolicyDocument> {
    const now = new Date();

    // Determine initial status
    let status: PolicyDocument['status'] = 'draft';
    if (input.adoptedAt && new Date(input.effectiveDate) <= now) {
      status = 'active';
    } else if (input.adoptedAt) {
      status = 'pending_approval';
    }

    const document: PolicyDocument = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      documentType: input.documentType,
      category: input.category,
      status,
      documentNumber: input.documentNumber,
      title: input.title,
      description: input.description,
      version: input.version ?? '1.0',
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      adoptedAt: input.adoptedAt,
      adoptedByBodyName: input.adoptedByBodyName,
      adoptedByResolutionId: input.adoptedByResolutionId,
      meetingId: input.meetingId,
      summaryText: input.summaryText,
      fullText: input.fullText,
      attachmentIds: input.attachmentIds,
      keywords: input.keywords,
      statutoryCitations: input.statutoryCitations,
      notes: input.notes,
      createdAt: now,
    };

    this.documents.push(document);
    return document;
  }

  async getDocument(
    ctx: TenantContext,
    id: string
  ): Promise<PolicyDocument | null> {
    return (
      this.documents.find(
        (d) => d.id === id && d.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listDocuments(
    ctx: TenantContext,
    filter?: PolicyDocumentFilter
  ): Promise<PolicyDocumentSummary[]> {
    let results = this.documents.filter((d) => d.tenantId === ctx.tenantId);

    if (filter?.documentType) {
      results = results.filter((d) => d.documentType === filter.documentType);
    }
    if (filter?.category) {
      results = results.filter((d) => d.category === filter.category);
    }
    if (filter?.status) {
      results = results.filter((d) => d.status === filter.status);
    }
    if (filter?.titleContains) {
      const search = filter.titleContains.toLowerCase();
      results = results.filter((d) => d.title.toLowerCase().includes(search));
    }
    if (filter?.keywordContains) {
      const search = filter.keywordContains.toLowerCase();
      results = results.filter(
        (d) =>
          d.keywords?.some((k) => k.toLowerCase().includes(search)) ?? false
      );
    }
    if (filter?.effectiveBefore) {
      results = results.filter(
        (d) => new Date(d.effectiveDate) < filter.effectiveBefore!
      );
    }
    if (filter?.effectiveAfter) {
      results = results.filter(
        (d) => new Date(d.effectiveDate) > filter.effectiveAfter!
      );
    }
    if (filter?.requiresReviewBefore) {
      // Find documents that need review (haven't been reviewed recently)
      const cutoff = filter.requiresReviewBefore;
      results = results.filter(
        (d) =>
          d.status === 'active' &&
          (!d.lastReviewedAt || new Date(d.lastReviewedAt) < cutoff)
      );
    }

    return results.map((d) => this.toDocumentSummary(d));
  }

  async updateDocument(
    ctx: TenantContext,
    id: string,
    input: UpdatePolicyDocumentInput
  ): Promise<PolicyDocument> {
    const document = this.documents.find(
      (d) => d.id === id && d.tenantId === ctx.tenantId
    );
    if (!document) {
      throw new Error(`Document not found: ${id}`);
    }

    Object.assign(document, input, { updatedAt: new Date() });
    return document;
  }

  async createNewVersion(
    ctx: TenantContext,
    input: CreateNewVersionInput
  ): Promise<PolicyDocument> {
    const previousDoc = this.documents.find(
      (d) => d.id === input.previousPolicyId && d.tenantId === ctx.tenantId
    );
    if (!previousDoc) {
      throw new Error(`Previous document not found: ${input.previousPolicyId}`);
    }

    // Increment version number
    const prevVersion = previousDoc.version;
    const versionParts = prevVersion.split('.');
    const majorVersion = parseInt(versionParts[0], 10) || 1;
    const minorVersion = (parseInt(versionParts[1], 10) || 0) + 1;
    const newVersion = `${majorVersion}.${minorVersion}`;

    // Mark previous as superseded
    previousDoc.status = 'superseded';
    previousDoc.updatedAt = new Date();

    const now = new Date();
    const newDoc: PolicyDocument = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      documentType: previousDoc.documentType,
      category: previousDoc.category,
      status: 'active',
      documentNumber: previousDoc.documentNumber,
      title: input.title ?? previousDoc.title,
      description: input.description ?? previousDoc.description,
      version: newVersion,
      previousVersionId: previousDoc.id,
      effectiveDate: input.effectiveDate,
      expirationDate: previousDoc.expirationDate,
      adoptedAt: now,
      adoptedByBodyName: previousDoc.adoptedByBodyName,
      summaryText: input.summaryText ?? previousDoc.summaryText,
      fullText: input.fullText ?? previousDoc.fullText,
      attachmentIds: input.attachmentIds ?? previousDoc.attachmentIds,
      keywords: previousDoc.keywords,
      statutoryCitations: previousDoc.statutoryCitations,
      notes: input.changeNotes
        ? `${previousDoc.notes ?? ''}\n\nVersion ${newVersion}: ${input.changeNotes}`
        : previousDoc.notes,
      createdAt: now,
    };

    this.documents.push(newDoc);
    return newDoc;
  }

  async activateDocument(
    ctx: TenantContext,
    id: string
  ): Promise<PolicyDocument> {
    const document = this.documents.find(
      (d) => d.id === id && d.tenantId === ctx.tenantId
    );
    if (!document) {
      throw new Error(`Document not found: ${id}`);
    }

    document.status = 'active';
    document.updatedAt = new Date();
    return document;
  }

  async archiveDocument(
    ctx: TenantContext,
    id: string
  ): Promise<PolicyDocument> {
    const document = this.documents.find(
      (d) => d.id === id && d.tenantId === ctx.tenantId
    );
    if (!document) {
      throw new Error(`Document not found: ${id}`);
    }

    document.status = 'archived';
    document.updatedAt = new Date();
    return document;
  }

  async getVersionHistory(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyDocumentSummary[]> {
    const document = this.documents.find(
      (d) => d.id === policyId && d.tenantId === ctx.tenantId
    );
    if (!document) {
      throw new Error(`Document not found: ${policyId}`);
    }

    // Find all versions with the same document number or in the version chain
    const history: PolicyDocument[] = [document];

    // Walk backwards through previousVersionId
    let currentId = document.previousVersionId;
    while (currentId) {
      const prev = this.documents.find(
        (d) => d.id === currentId && d.tenantId === ctx.tenantId
      );
      if (prev) {
        history.push(prev);
        currentId = prev.previousVersionId;
      } else {
        break;
      }
    }

    // Also find any documents that superseded this one
    const later = this.documents.filter(
      (d) => d.previousVersionId === policyId && d.tenantId === ctx.tenantId
    );
    history.push(...later);

    // Sort by version descending
    history.sort((a, b) => {
      const vA = parseFloat(a.version) || 0;
      const vB = parseFloat(b.version) || 0;
      return vB - vA;
    });

    return history.map((d) => this.toDocumentSummary(d));
  }

  async searchPolicies(
    ctx: TenantContext,
    query: string
  ): Promise<PolicyDocumentSummary[]> {
    const search = query.toLowerCase();

    const results = this.documents.filter(
      (d) =>
        d.tenantId === ctx.tenantId &&
        (d.title.toLowerCase().includes(search) ||
          d.description?.toLowerCase().includes(search) ||
          d.summaryText?.toLowerCase().includes(search) ||
          d.fullText?.toLowerCase().includes(search) ||
          d.keywords?.some((k) => k.toLowerCase().includes(search)))
    );

    return results.map((d) => this.toDocumentSummary(d));
  }

  //
  // POLICY REVIEWS
  //

  async scheduleReview(
    ctx: TenantContext,
    input: SchedulePolicyReviewInput
  ): Promise<PolicyReview> {
    // Verify policy belongs to tenant
    const document = await this.getDocument(ctx, input.policyId);
    if (!document) {
      throw new Error(`Document not found: ${input.policyId}`);
    }

    const review: PolicyReview = {
      id: randomUUID(),
      policyId: input.policyId,
      scheduledDate: input.scheduledDate,
      reviewerName: input.reviewerName,
      changesRequired: false,
      createdAt: new Date(),
    };

    this.reviews.push(review);
    return review;
  }

  async completeReview(
    ctx: TenantContext,
    input: CompletePolicyReviewInput
  ): Promise<PolicyReview> {
    const review = this.reviews.find((r) => r.id === input.reviewId);
    if (!review) {
      throw new Error(`Review not found: ${input.reviewId}`);
    }

    // Verify policy belongs to tenant
    const document = await this.getDocument(ctx, review.policyId);
    if (!document) {
      throw new Error(`Review not authorized: ${input.reviewId}`);
    }

    review.completedAt = new Date();
    review.reviewNotes = input.reviewNotes;
    review.changesRequired = input.changesRequired;
    review.newVersionId = input.newVersionId;

    // Update policy's lastReviewedAt
    document.lastReviewedAt = review.completedAt;
    document.updatedAt = review.completedAt;

    return review;
  }

  async listReviewsForPolicy(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyReview[]> {
    // Verify policy belongs to tenant
    const document = await this.getDocument(ctx, policyId);
    if (!document) {
      throw new Error(`Document not found: ${policyId}`);
    }
    return this.reviews.filter((r) => r.policyId === policyId);
  }

  async getUpcomingReviews(
    ctx: TenantContext,
    withinDays: number
  ): Promise<PolicyReview[]> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    // Get all policy IDs for this tenant
    const tenantDocIds = new Set(
      this.documents
        .filter((d) => d.tenantId === ctx.tenantId)
        .map((d) => d.id)
    );

    return this.reviews.filter(
      (r) =>
        tenantDocIds.has(r.policyId) &&
        !r.completedAt &&
        new Date(r.scheduledDate) >= now &&
        new Date(r.scheduledDate) <= cutoff
    );
  }

  //
  // ACKNOWLEDGMENTS
  //

  async recordAcknowledgment(
    ctx: TenantContext,
    input: RecordAcknowledgmentInput
  ): Promise<PolicyAcknowledgment> {
    // Verify policy belongs to tenant
    const document = await this.getDocument(ctx, input.policyId);
    if (!document) {
      throw new Error(`Document not found: ${input.policyId}`);
    }

    const acknowledgment: PolicyAcknowledgment = {
      id: randomUUID(),
      policyId: input.policyId,
      acknowledgedByName: input.acknowledgedByName,
      acknowledgedByUserId: input.acknowledgedByUserId,
      acknowledgedAt: new Date(),
      certificationText: input.certificationText,
      signatureReference: input.signatureReference,
      createdAt: new Date(),
    };

    this.acknowledgments.push(acknowledgment);
    return acknowledgment;
  }

  async listAcknowledgmentsForPolicy(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyAcknowledgment[]> {
    // Verify policy belongs to tenant
    const document = await this.getDocument(ctx, policyId);
    if (!document) {
      throw new Error(`Document not found: ${policyId}`);
    }
    return this.acknowledgments.filter((a) => a.policyId === policyId);
  }

  async hasAcknowledged(
    ctx: TenantContext,
    policyId: string,
    acknowledgedByName: string
  ): Promise<boolean> {
    // Verify policy belongs to tenant
    const document = await this.getDocument(ctx, policyId);
    if (!document) {
      throw new Error(`Document not found: ${policyId}`);
    }
    return this.acknowledgments.some(
      (a) =>
        a.policyId === policyId &&
        a.acknowledgedByName.toLowerCase() === acknowledgedByName.toLowerCase()
    );
  }

  //
  // CONVENIENCE METHODS
  //

  async getActivePoliciesInCategory(
    ctx: TenantContext,
    category: PolicyCategory
  ): Promise<PolicyDocumentSummary[]> {
    return this.listDocuments(ctx, { category, status: 'active' });
  }

  async getCurrentVersionByNumber(
    ctx: TenantContext,
    documentNumber: string
  ): Promise<PolicyDocument | null> {
    const document = this.documents.find(
      (d) =>
        d.tenantId === ctx.tenantId &&
        d.documentNumber === documentNumber &&
        d.status === 'active'
    );
    return document ?? null;
  }

  //
  // HELPERS
  //

  private toDocumentSummary(document: PolicyDocument): PolicyDocumentSummary {
    return {
      id: document.id,
      tenantId: document.tenantId,
      documentType: document.documentType,
      category: document.category,
      status: document.status,
      documentNumber: document.documentNumber,
      title: document.title,
      version: document.version,
      effectiveDate: document.effectiveDate,
      expirationDate: document.expirationDate,
    };
  }
}
