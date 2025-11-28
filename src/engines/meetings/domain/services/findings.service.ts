// src/engines/meetings/domain/services/findings.service.ts
//
// Service for managing findings of fact.
// Handles CRUD operations, validation, and adoption workflow for BZA/Plan Commission cases.

import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  FindingsOfFact,
  FindingsCriterion,
  FindingsCondition,
  FindingsValidationResult,
  FindingsDetermination,
  FindingsCaseType,
  FindingsStatus,
  FindingsDocumentResult,
  UpdateStaffRecommendationInput,
  UpdateBoardDeterminationInput,
  CreateConditionInput,
} from '../types';
import { MEETINGS_ERROR_CODES } from '../constants/indiana.constants';

/**
 * Store interface for findings persistence.
 */
export interface FindingsDataStore {
  // Findings CRUD
  createFindings(
    ctx: TenantContext,
    input: CreateFindingsInput
  ): Promise<FindingsOfFact>;

  getFindings(ctx: TenantContext, findingsId: string): Promise<FindingsOfFact | null>;

  getFindingsByAgendaItem(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<FindingsOfFact | null>;

  getFindingsByMeeting(
    ctx: TenantContext,
    meetingId: string
  ): Promise<FindingsOfFact[]>;

  updateFindings(
    ctx: TenantContext,
    findingsId: string,
    input: UpdateFindingsInput
  ): Promise<FindingsOfFact>;

  // Criteria CRUD
  getCriterion(
    ctx: TenantContext,
    criterionId: string
  ): Promise<FindingsCriterion | null>;

  updateCriterion(
    ctx: TenantContext,
    criterionId: string,
    input: UpdateCriterionInput
  ): Promise<FindingsCriterion>;

  getCriteriaByFindings(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsCriterion[]>;

  // Conditions CRUD
  createCondition(
    ctx: TenantContext,
    input: CreateConditionDbInput
  ): Promise<FindingsCondition>;

  getConditions(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsCondition[]>;

  updateCondition(
    ctx: TenantContext,
    conditionId: string,
    conditionText: string
  ): Promise<FindingsCondition>;

  deleteCondition(ctx: TenantContext, conditionId: string): Promise<void>;
}

interface CreateFindingsInput {
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  caseType: FindingsCaseType;
  statutoryCite: string;
  createdByUserId?: string;
}

interface UpdateFindingsInput {
  status?: FindingsStatus;
  voteRecordId?: string;
  adoptedAt?: Date;
  adoptedByUserId?: string;
  generatedDocumentId?: string;
  generatedAt?: Date;
  isLocked?: boolean;
}

interface UpdateCriterionInput {
  staffRecommendation?: FindingsDetermination;
  staffRationale?: string;
  staffUpdatedByUserId?: string;
  boardDetermination?: FindingsDetermination;
  boardRationale?: string;
  boardUpdatedByUserId?: string;
}

interface CreateConditionDbInput {
  tenantId: string;
  findingsId: string;
  conditionNumber: number;
  conditionText: string;
  createdByUserId?: string;
}

/**
 * Error thrown for findings-related violations.
 */
export class FindingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statutoryCite?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FindingsError';
  }
}

/**
 * Service for managing findings of fact.
 */
export class FindingsService {
  constructor(private readonly store: FindingsDataStore) {}

  /**
   * Get findings for an agenda item.
   */
  async getFindings(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<FindingsOfFact | null> {
    const findings = await this.store.getFindingsByAgendaItem(ctx, agendaItemId);
    if (!findings) {
      return null;
    }

    // Load criteria and conditions
    const [criteria, conditions] = await Promise.all([
      this.store.getCriteriaByFindings(ctx, findings.id),
      this.store.getConditions(ctx, findings.id),
    ]);

    return {
      ...findings,
      criteria,
      conditions,
    };
  }

  /**
   * Get findings by ID.
   */
  async getFindingsById(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsOfFact | null> {
    const findings = await this.store.getFindings(ctx, findingsId);
    if (!findings) {
      return null;
    }

    const [criteria, conditions] = await Promise.all([
      this.store.getCriteriaByFindings(ctx, findings.id),
      this.store.getConditions(ctx, findings.id),
    ]);

    return {
      ...findings,
      criteria,
      conditions,
    };
  }

  /**
   * Get all findings for a meeting.
   */
  async getFindingsForMeeting(
    ctx: TenantContext,
    meetingId: string
  ): Promise<FindingsOfFact[]> {
    const findingsList = await this.store.getFindingsByMeeting(ctx, meetingId);

    // Load criteria and conditions for each
    return Promise.all(
      findingsList.map(async (findings) => {
        const [criteria, conditions] = await Promise.all([
          this.store.getCriteriaByFindings(ctx, findings.id),
          this.store.getConditions(ctx, findings.id),
        ]);
        return {
          ...findings,
          criteria,
          conditions,
        };
      })
    );
  }

  /**
   * Update staff recommendation for a criterion.
   */
  async updateStaffRecommendation(
    ctx: TenantContext,
    criterionId: string,
    input: UpdateStaffRecommendationInput
  ): Promise<FindingsCriterion> {
    const criterion = await this.store.getCriterion(ctx, criterionId);
    if (!criterion) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.CRITERION_NOT_FOUND,
        'Criterion not found'
      );
    }

    // Check if findings is locked
    const findings = await this.store.getFindings(ctx, criterion.findingsId);
    if (findings?.isLocked) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
        'Cannot modify findings after adoption'
      );
    }

    return this.store.updateCriterion(ctx, criterionId, {
      staffRecommendation: input.recommendation,
      staffRationale: input.rationale,
      staffUpdatedByUserId: ctx.userId,
    });
  }

  /**
   * Record board determination for a criterion (during/after hearing).
   */
  async recordBoardDetermination(
    ctx: TenantContext,
    criterionId: string,
    input: UpdateBoardDeterminationInput
  ): Promise<FindingsCriterion> {
    const criterion = await this.store.getCriterion(ctx, criterionId);
    if (!criterion) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.CRITERION_NOT_FOUND,
        'Criterion not found'
      );
    }

    // Check if findings is locked
    const findings = await this.store.getFindings(ctx, criterion.findingsId);
    if (findings?.isLocked) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
        'Cannot modify findings after adoption'
      );
    }

    return this.store.updateCriterion(ctx, criterionId, {
      boardDetermination: input.determination,
      boardRationale: input.rationale,
      boardUpdatedByUserId: ctx.userId,
    });
  }

  /**
   * Validate findings are complete (all criteria have board rationale).
   */
  validateFindings(findings: FindingsOfFact): FindingsValidationResult {
    const criteria = findings.criteria || [];

    const missingCriteria: FindingsValidationResult['missingCriteria'] = [];
    const unmetCriteria: FindingsValidationResult['unmetCriteria'] = [];

    for (const criterion of criteria) {
      // Check for missing determinations/rationale
      const hasDetermination = !!criterion.boardDetermination;
      const hasRationale = !!criterion.boardRationale && criterion.boardRationale.trim().length > 0;

      if (!hasDetermination && !hasRationale) {
        missingCriteria.push({
          criterionNumber: criterion.criterionNumber,
          criterionText: criterion.criterionText,
          missing: 'both',
        });
      } else if (!hasDetermination) {
        missingCriteria.push({
          criterionNumber: criterion.criterionNumber,
          criterionText: criterion.criterionText,
          missing: 'determination',
        });
      } else if (!hasRationale) {
        missingCriteria.push({
          criterionNumber: criterion.criterionNumber,
          criterionText: criterion.criterionText,
          missing: 'rationale',
        });
      }

      // Track unmet required criteria
      if (
        criterion.isRequired &&
        criterion.boardDetermination === 'NOT_MET'
      ) {
        unmetCriteria.push({
          criterionNumber: criterion.criterionNumber,
          criterionText: criterion.criterionText,
        });
      }
    }

    const isComplete = missingCriteria.length === 0;

    // Can approve if all required criteria are MET
    const canApprove =
      isComplete &&
      criteria.every(
        (c) => !c.isRequired || c.boardDetermination === 'MET'
      );

    // Can deny if any required criterion is NOT_MET
    const canDeny = unmetCriteria.length > 0;

    return {
      isComplete,
      missingCriteria,
      canApprove,
      canDeny,
      unmetCriteria,
    };
  }

  /**
   * Submit findings for review.
   */
  async submitForReview(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsOfFact> {
    const findings = await this.getFindingsById(ctx, findingsId);
    if (!findings) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_NOT_FOUND,
        'Findings not found'
      );
    }

    if (findings.isLocked) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
        'Cannot modify findings after adoption'
      );
    }

    await this.store.updateFindings(ctx, findingsId, {
      status: 'PENDING_REVIEW',
    });

    return this.getFindingsById(ctx, findingsId) as Promise<FindingsOfFact>;
  }

  /**
   * Adopt findings (link to vote record, lock findings).
   */
  async adoptFindings(
    ctx: TenantContext,
    findingsId: string,
    voteRecordId: string
  ): Promise<FindingsOfFact> {
    const findings = await this.getFindingsById(ctx, findingsId);
    if (!findings) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_NOT_FOUND,
        'Findings not found'
      );
    }

    if (findings.isLocked) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
        'Findings have already been adopted'
      );
    }

    // Validate findings are complete
    const validation = this.validateFindings(findings);
    if (!validation.isComplete) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_INCOMPLETE,
        'Cannot adopt: written findings required for all criteria',
        findings.statutoryCite,
        { missingCriteria: validation.missingCriteria }
      );
    }

    // Update findings with adoption info
    await this.store.updateFindings(ctx, findingsId, {
      status: 'ADOPTED',
      voteRecordId,
      adoptedAt: new Date(),
      adoptedByUserId: ctx.userId,
      isLocked: true,
    });

    return this.getFindingsById(ctx, findingsId) as Promise<FindingsOfFact>;
  }

  /**
   * Reject findings (for denied cases).
   */
  async rejectFindings(
    ctx: TenantContext,
    findingsId: string,
    voteRecordId: string
  ): Promise<FindingsOfFact> {
    const findings = await this.getFindingsById(ctx, findingsId);
    if (!findings) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_NOT_FOUND,
        'Findings not found'
      );
    }

    if (findings.isLocked) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
        'Findings have already been finalized'
      );
    }

    // Validate findings are complete (denial also requires findings)
    const validation = this.validateFindings(findings);
    if (!validation.isComplete) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_INCOMPLETE,
        'Cannot finalize: written findings required for all criteria',
        findings.statutoryCite,
        { missingCriteria: validation.missingCriteria }
      );
    }

    await this.store.updateFindings(ctx, findingsId, {
      status: 'REJECTED',
      voteRecordId,
      adoptedAt: new Date(), // Same field for finalization timestamp
      adoptedByUserId: ctx.userId,
      isLocked: true,
    });

    return this.getFindingsById(ctx, findingsId) as Promise<FindingsOfFact>;
  }

  /**
   * Add a condition of approval.
   */
  async addCondition(
    ctx: TenantContext,
    findingsId: string,
    input: CreateConditionInput
  ): Promise<FindingsCondition> {
    const findings = await this.store.getFindings(ctx, findingsId);
    if (!findings) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_NOT_FOUND,
        'Findings not found'
      );
    }

    if (findings.isLocked) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_LOCKED,
        'Cannot modify findings after adoption'
      );
    }

    // Get existing conditions to determine next number
    const conditions = await this.store.getConditions(ctx, findingsId);
    const nextNumber =
      conditions.length > 0
        ? Math.max(...conditions.map((c) => c.conditionNumber)) + 1
        : 1;

    return this.store.createCondition(ctx, {
      tenantId: ctx.tenantId,
      findingsId,
      conditionNumber: nextNumber,
      conditionText: input.conditionText,
      createdByUserId: ctx.userId,
    });
  }

  /**
   * Update a condition.
   */
  async updateCondition(
    ctx: TenantContext,
    conditionId: string,
    conditionText: string
  ): Promise<FindingsCondition> {
    return this.store.updateCondition(ctx, conditionId, conditionText);
  }

  /**
   * Remove a condition.
   */
  async removeCondition(ctx: TenantContext, conditionId: string): Promise<void> {
    await this.store.deleteCondition(ctx, conditionId);
  }

  /**
   * Generate findings document (PDF or DOCX).
   * Returns a document ID that can be used to retrieve the file.
   */
  async generateFindingsDocument(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsDocumentResult> {
    const findings = await this.getFindingsById(ctx, findingsId);
    if (!findings) {
      throw new FindingsError(
        MEETINGS_ERROR_CODES.FINDINGS_NOT_FOUND,
        'Findings not found'
      );
    }

    // Generate HTML content for the document
    const html = this.generateFindingsHtml(findings);

    // In a real implementation, this would:
    // 1. Convert HTML to PDF using a library like puppeteer or pdfkit
    // 2. Store the PDF in the file storage system
    // 3. Return the file ID

    // For now, we'll create a placeholder document ID
    const documentId = `doc-findings-${findingsId}-${Date.now()}`;
    const generatedAt = new Date();

    // Update findings with document reference
    await this.store.updateFindings(ctx, findingsId, {
      generatedDocumentId: documentId,
      generatedAt,
    });

    return {
      documentId,
      generatedAt,
    };
  }

  /**
   * Generate HTML content for findings document.
   */
  private generateFindingsHtml(findings: FindingsOfFact): string {
    const criteria = findings.criteria || [];
    const conditions = findings.conditions || [];

    const criteriaHtml = criteria
      .map(
        (c) => `
      <div class="criterion">
        <h3>Criterion ${c.criterionNumber}</h3>
        <p class="criterion-text">${c.criterionText}</p>
        ${c.statutoryCite ? `<p class="cite">(${c.statutoryCite})</p>` : ''}

        <div class="staff-recommendation">
          <h4>Staff Recommendation</h4>
          <p class="determination">${c.staffRecommendation || 'Not provided'}</p>
          <p class="rationale">${c.staffRationale || ''}</p>
        </div>

        <div class="board-determination">
          <h4>Board Determination</h4>
          <p class="determination">${c.boardDetermination || 'Not provided'}</p>
          <p class="rationale">${c.boardRationale || ''}</p>
        </div>
      </div>
    `
      )
      .join('\n');

    const conditionsHtml =
      conditions.length > 0
        ? `
      <div class="conditions">
        <h2>Conditions of Approval</h2>
        <ol>
          ${conditions.map((c) => `<li>${c.conditionText}</li>`).join('\n')}
        </ol>
      </div>
    `
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Findings of Fact - ${findings.caseType}</title>
  <style>
    body { font-family: Times New Roman, serif; margin: 1in; }
    h1 { text-align: center; }
    .criterion { margin-bottom: 1em; page-break-inside: avoid; }
    .criterion-text { font-style: italic; }
    .cite { font-size: 0.9em; color: #666; }
    .determination { font-weight: bold; }
    .rationale { margin-left: 1em; }
    .conditions { margin-top: 2em; }
    .signature-block { margin-top: 3em; }
  </style>
</head>
<body>
  <h1>Findings of Fact</h1>
  <p class="case-type"><strong>Case Type:</strong> ${findings.caseType}</p>
  <p class="statutory-cite"><strong>Statutory Authority:</strong> ${findings.statutoryCite}</p>
  <p class="status"><strong>Status:</strong> ${findings.status}</p>
  ${findings.adoptedAt ? `<p><strong>Adopted:</strong> ${findings.adoptedAt.toLocaleDateString()}</p>` : ''}

  <h2>Criteria Analysis</h2>
  ${criteriaHtml}

  ${conditionsHtml}

  <div class="signature-block">
    <p>_______________________________</p>
    <p>Board Chairperson</p>
    <p>Date: _______________</p>
  </div>
</body>
</html>
    `;
  }
}

/**
 * In-memory implementation for testing.
 */
export class InMemoryFindingsDataStore implements FindingsDataStore {
  private findings: Map<string, FindingsOfFact> = new Map();
  private criteria: Map<string, FindingsCriterion> = new Map();
  private conditions: Map<string, FindingsCondition> = new Map();
  private idCounter = 1;

  private generateId(prefix: string): string {
    return `${prefix}-${this.idCounter++}`;
  }

  async createFindings(
    ctx: TenantContext,
    input: CreateFindingsInput
  ): Promise<FindingsOfFact> {
    const now = new Date();
    const findings: FindingsOfFact = {
      id: this.generateId('findings'),
      tenantId: input.tenantId,
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      caseType: input.caseType,
      statutoryCite: input.statutoryCite,
      status: 'DRAFT',
      isLocked: false,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };
    this.findings.set(findings.id, findings);
    return findings;
  }

  async getFindings(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsOfFact | null> {
    const findings = this.findings.get(findingsId);
    if (!findings || findings.tenantId !== ctx.tenantId) {
      return null;
    }
    return findings;
  }

  async getFindingsByAgendaItem(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<FindingsOfFact | null> {
    for (const findings of this.findings.values()) {
      if (
        findings.agendaItemId === agendaItemId &&
        findings.tenantId === ctx.tenantId
      ) {
        return findings;
      }
    }
    return null;
  }

  async getFindingsByMeeting(
    ctx: TenantContext,
    meetingId: string
  ): Promise<FindingsOfFact[]> {
    const result: FindingsOfFact[] = [];
    for (const findings of this.findings.values()) {
      if (
        findings.meetingId === meetingId &&
        findings.tenantId === ctx.tenantId
      ) {
        result.push(findings);
      }
    }
    return result;
  }

  async updateFindings(
    ctx: TenantContext,
    findingsId: string,
    input: UpdateFindingsInput
  ): Promise<FindingsOfFact> {
    const findings = this.findings.get(findingsId);
    if (!findings || findings.tenantId !== ctx.tenantId) {
      throw new Error('Findings not found');
    }

    const updated: FindingsOfFact = {
      ...findings,
      ...input,
      updatedAt: new Date(),
    };
    this.findings.set(findingsId, updated);
    return updated;
  }

  async getCriterion(
    ctx: TenantContext,
    criterionId: string
  ): Promise<FindingsCriterion | null> {
    const criterion = this.criteria.get(criterionId);
    if (!criterion || criterion.tenantId !== ctx.tenantId) {
      return null;
    }
    return criterion;
  }

  async updateCriterion(
    ctx: TenantContext,
    criterionId: string,
    input: UpdateCriterionInput
  ): Promise<FindingsCriterion> {
    const criterion = this.criteria.get(criterionId);
    if (!criterion || criterion.tenantId !== ctx.tenantId) {
      throw new Error('Criterion not found');
    }

    const now = new Date();
    const updated: FindingsCriterion = {
      ...criterion,
      ...input,
      staffUpdatedAt: input.staffRecommendation !== undefined ? now : criterion.staffUpdatedAt,
      boardUpdatedAt: input.boardDetermination !== undefined ? now : criterion.boardUpdatedAt,
      updatedAt: now,
    };
    this.criteria.set(criterionId, updated);
    return updated;
  }

  async getCriteriaByFindings(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsCriterion[]> {
    const result: FindingsCriterion[] = [];
    for (const criterion of this.criteria.values()) {
      if (
        criterion.findingsId === findingsId &&
        criterion.tenantId === ctx.tenantId
      ) {
        result.push(criterion);
      }
    }
    return result.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async createCondition(
    ctx: TenantContext,
    input: CreateConditionDbInput
  ): Promise<FindingsCondition> {
    const now = new Date();
    const condition: FindingsCondition = {
      id: this.generateId('condition'),
      tenantId: input.tenantId,
      findingsId: input.findingsId,
      conditionNumber: input.conditionNumber,
      conditionText: input.conditionText,
      orderIndex: input.conditionNumber,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };
    this.conditions.set(condition.id, condition);
    return condition;
  }

  async getConditions(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsCondition[]> {
    const result: FindingsCondition[] = [];
    for (const condition of this.conditions.values()) {
      if (
        condition.findingsId === findingsId &&
        condition.tenantId === ctx.tenantId
      ) {
        result.push(condition);
      }
    }
    return result.sort((a, b) => a.conditionNumber - b.conditionNumber);
  }

  async updateCondition(
    ctx: TenantContext,
    conditionId: string,
    conditionText: string
  ): Promise<FindingsCondition> {
    const condition = this.conditions.get(conditionId);
    if (!condition || condition.tenantId !== ctx.tenantId) {
      throw new Error('Condition not found');
    }

    const updated: FindingsCondition = {
      ...condition,
      conditionText,
      updatedAt: new Date(),
    };
    this.conditions.set(conditionId, updated);
    return updated;
  }

  async deleteCondition(ctx: TenantContext, conditionId: string): Promise<void> {
    const condition = this.conditions.get(conditionId);
    if (!condition || condition.tenantId !== ctx.tenantId) {
      throw new Error('Condition not found');
    }
    this.conditions.delete(conditionId);
  }

  // Helper methods for testing
  addCriterion(criterion: FindingsCriterion): void {
    this.criteria.set(criterion.id, criterion);
  }

  clear(): void {
    this.findings.clear();
    this.criteria.clear();
    this.conditions.clear();
    this.idCounter = 1;
  }
}
