// src/engines/fence-viewer/in-memory-fence-viewer.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FenceViewerCase,
  FenceViewerCaseSummary,
  FenceViewerParty,
  FenceInspection,
  FenceViewerDecision,
} from './fence-viewer.types';
import {
  FenceViewerService,
  CreateFenceViewerCaseInput,
  UpdateFenceViewerCaseInput,
  AddFenceViewerPartyInput,
  RecordFenceInspectionInput,
  IssueFenceViewerDecisionInput,
  FenceViewerCaseFilter,
} from './fence-viewer.service';

/**
 * Seed data structure for in-memory service.
 */
export interface InMemoryFenceViewerSeedData {
  cases?: FenceViewerCase[];
  parties?: FenceViewerParty[];
  inspections?: FenceInspection[];
  decisions?: FenceViewerDecision[];
}

/**
 * In-memory implementation of the Fence Viewer service.
 * Used for testing and demo purposes.
 *
 * TODO: Implement PostgresFenceViewerService for production use.
 */
export class InMemoryFenceViewerService implements FenceViewerService {
  private cases: FenceViewerCase[];
  private parties: FenceViewerParty[];
  private inspections: FenceInspection[];
  private decisions: FenceViewerDecision[];
  private caseCounter: Map<string, number> = new Map();

  constructor(seed: InMemoryFenceViewerSeedData = {}) {
    this.cases = seed.cases ? [...seed.cases] : [];
    this.parties = seed.parties ? [...seed.parties] : [];
    this.inspections = seed.inspections ? [...seed.inspections] : [];
    this.decisions = seed.decisions ? [...seed.decisions] : [];
  }

  //
  // CASES
  //

  async createCase(
    ctx: TenantContext,
    input: CreateFenceViewerCaseInput
  ): Promise<FenceViewerCase> {
    const now = new Date();
    const caseNumber = this.generateCaseNumber(ctx.tenantId);

    const fenceCase: FenceViewerCase = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      caseNumber,
      disputeType: input.disputeType,
      status: 'petition_received',
      fenceLocationDescription: input.fenceLocationDescription,
      petitionReceivedAt: input.petitionReceivedAt ?? now,
      notes: input.notes,
      createdAt: now,
    };

    this.cases.push(fenceCase);
    return this.hydrateCase(fenceCase);
  }

  async getCase(
    ctx: TenantContext,
    id: string
  ): Promise<FenceViewerCase | null> {
    const fenceCase = this.cases.find(
      (c) => c.id === id && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) return null;
    return this.hydrateCase(fenceCase);
  }

  async listCases(
    ctx: TenantContext,
    filter?: FenceViewerCaseFilter
  ): Promise<FenceViewerCaseSummary[]> {
    let results = this.cases.filter((c) => c.tenantId === ctx.tenantId);

    if (filter?.status) {
      results = results.filter((c) => c.status === filter.status);
    }
    if (filter?.disputeType) {
      results = results.filter((c) => c.disputeType === filter.disputeType);
    }
    if (filter?.partyNameContains) {
      const search = filter.partyNameContains.toLowerCase();
      const caseIds = new Set(
        this.parties
          .filter((p) => p.name.toLowerCase().includes(search))
          .map((p) => p.caseId)
      );
      results = results.filter((c) => caseIds.has(c.id));
    }
    if (filter?.fromDate) {
      results = results.filter(
        (c) => new Date(c.petitionReceivedAt) >= filter.fromDate!
      );
    }
    if (filter?.toDate) {
      results = results.filter(
        (c) => new Date(c.petitionReceivedAt) <= filter.toDate!
      );
    }

    return results.map((c) => this.toCaseSummary(c));
  }

  async updateCase(
    ctx: TenantContext,
    id: string,
    input: UpdateFenceViewerCaseInput
  ): Promise<FenceViewerCase> {
    const fenceCase = this.cases.find(
      (c) => c.id === id && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) {
      throw new Error(`Case not found: ${id}`);
    }

    Object.assign(fenceCase, input, { updatedAt: new Date() });
    return this.hydrateCase(fenceCase);
  }

  async scheduleInspection(
    ctx: TenantContext,
    caseId: string,
    scheduledAt: Date
  ): Promise<FenceViewerCase> {
    const fenceCase = this.cases.find(
      (c) => c.id === caseId && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) {
      throw new Error(`Case not found: ${caseId}`);
    }

    fenceCase.scheduledInspectionAt = scheduledAt;
    fenceCase.status = 'scheduled';
    fenceCase.updatedAt = new Date();
    return this.hydrateCase(fenceCase);
  }

  async closeCase(
    ctx: TenantContext,
    caseId: string,
    reason?: string
  ): Promise<FenceViewerCase> {
    const fenceCase = this.cases.find(
      (c) => c.id === caseId && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) {
      throw new Error(`Case not found: ${caseId}`);
    }

    fenceCase.status = 'closed';
    fenceCase.closedAt = new Date();
    if (reason) {
      fenceCase.notes = fenceCase.notes
        ? `${fenceCase.notes}\n\nClosed: ${reason}`
        : `Closed: ${reason}`;
    }
    fenceCase.updatedAt = new Date();
    return this.hydrateCase(fenceCase);
  }

  //
  // PARTIES
  //

  async addParty(
    ctx: TenantContext,
    input: AddFenceViewerPartyInput
  ): Promise<FenceViewerParty> {
    // Verify case belongs to tenant
    const fenceCase = await this.getCase(ctx, input.caseId);
    if (!fenceCase) {
      throw new Error(`Case not found: ${input.caseId}`);
    }

    const party: FenceViewerParty = {
      id: randomUUID(),
      caseId: input.caseId,
      name: input.name,
      role: input.role,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      phone: input.phone,
      email: input.email,
      parcelNumber: input.parcelNumber,
      parcelDescription: input.parcelDescription,
      notes: input.notes,
    };

    this.parties.push(party);
    return party;
  }

  async listPartiesForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<FenceViewerParty[]> {
    // Verify case belongs to tenant
    const fenceCase = await this.getCase(ctx, caseId);
    if (!fenceCase) {
      throw new Error(`Case not found: ${caseId}`);
    }
    return this.parties.filter((p) => p.caseId === caseId);
  }

  async removeParty(ctx: TenantContext, partyId: string): Promise<void> {
    const idx = this.parties.findIndex((p) => p.id === partyId);
    if (idx >= 0) {
      const party = this.parties[idx];
      // Verify case belongs to tenant
      const fenceCase = await this.getCase(ctx, party.caseId);
      if (!fenceCase) {
        throw new Error(`Party not found or not authorized: ${partyId}`);
      }
      this.parties.splice(idx, 1);
    }
  }

  //
  // INSPECTIONS
  //

  async recordInspection(
    ctx: TenantContext,
    input: RecordFenceInspectionInput
  ): Promise<FenceInspection> {
    // Verify case belongs to tenant
    const fenceCase = this.cases.find(
      (c) => c.id === input.caseId && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) {
      throw new Error(`Case not found: ${input.caseId}`);
    }

    const inspection: FenceInspection = {
      id: randomUUID(),
      caseId: input.caseId,
      inspectionDate: input.inspectionDate,
      inspectorName: input.inspectorName,
      locationDescription: input.locationDescription,
      currentFenceCondition: input.currentFenceCondition,
      measurements: input.measurements,
      photoAttachmentIds: input.photoAttachmentIds,
      findings: input.findings,
      recommendations: input.recommendations,
      createdAt: new Date(),
    };

    this.inspections.push(inspection);

    // Update case status
    fenceCase.status = 'inspection_completed';
    fenceCase.updatedAt = new Date();

    return inspection;
  }

  async listInspectionsForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<FenceInspection[]> {
    // Verify case belongs to tenant
    const fenceCase = await this.getCase(ctx, caseId);
    if (!fenceCase) {
      throw new Error(`Case not found: ${caseId}`);
    }
    return this.inspections.filter((i) => i.caseId === caseId);
  }

  //
  // DECISIONS
  //

  async issueDecision(
    ctx: TenantContext,
    input: IssueFenceViewerDecisionInput
  ): Promise<FenceViewerDecision> {
    // Verify case belongs to tenant
    const fenceCase = this.cases.find(
      (c) => c.id === input.caseId && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) {
      throw new Error(`Case not found: ${input.caseId}`);
    }

    const now = new Date();
    const decisionDate = input.decisionDate ?? now;

    // Calculate cost allocations
    let petitionerCostCents: number | undefined;
    let respondentCostCents: number | undefined;
    if (input.estimatedTotalCostCents !== undefined) {
      petitionerCostCents = Math.round(
        (input.estimatedTotalCostCents * input.petitionerSharePercent) / 100
      );
      respondentCostCents = Math.round(
        (input.estimatedTotalCostCents * input.respondentSharePercent) / 100
      );
    }

    // Calculate appeal deadline (default 10 days per IC 32-26-9-7)
    const appealDeadlineDays = input.appealDeadlineDays ?? 10;
    const appealDeadlineDate = new Date(decisionDate);
    appealDeadlineDate.setDate(
      appealDeadlineDate.getDate() + appealDeadlineDays
    );

    const decision: FenceViewerDecision = {
      id: randomUUID(),
      caseId: input.caseId,
      decisionDate,
      issuedByName: input.issuedByName,
      petitionerSharePercent: input.petitionerSharePercent,
      respondentSharePercent: input.respondentSharePercent,
      estimatedTotalCostCents: input.estimatedTotalCostCents,
      petitionerCostCents,
      respondentCostCents,
      fenceTypeRequired: input.fenceTypeRequired,
      fenceLocationDescription: input.fenceLocationDescription,
      decisionNarrative: input.decisionNarrative,
      statutoryCitation: input.statutoryCitation ?? 'IC 32-26-9',
      appealDeadlineDate,
      createdAt: now,
    };

    this.decisions.push(decision);

    // Update case
    fenceCase.status = 'decision_issued';
    fenceCase.decisionIssuedAt = decisionDate;
    fenceCase.updatedAt = now;

    return decision;
  }

  async getDecisionForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<FenceViewerDecision | null> {
    // Verify case belongs to tenant
    const fenceCase = await this.getCase(ctx, caseId);
    if (!fenceCase) {
      throw new Error(`Case not found: ${caseId}`);
    }
    return this.decisions.find((d) => d.caseId === caseId) ?? null;
  }

  async recordAppeal(
    ctx: TenantContext,
    caseId: string,
    appealOutcome?: string
  ): Promise<FenceViewerCase> {
    const fenceCase = this.cases.find(
      (c) => c.id === caseId && c.tenantId === ctx.tenantId
    );
    if (!fenceCase) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const decision = this.decisions.find((d) => d.caseId === caseId);
    if (decision) {
      decision.wasAppealed = true;
      decision.appealOutcome = appealOutcome;
    }

    fenceCase.status = 'appealed';
    fenceCase.updatedAt = new Date();

    return this.hydrateCase(fenceCase);
  }

  //
  // HELPERS
  //

  private generateCaseNumber(tenantId: string): string {
    const year = new Date().getFullYear();
    const count = (this.caseCounter.get(tenantId) ?? 0) + 1;
    this.caseCounter.set(tenantId, count);
    return `FV-${year}-${count.toString().padStart(4, '0')}`;
  }

  private hydrateCase(fenceCase: FenceViewerCase): FenceViewerCase {
    return {
      ...fenceCase,
      parties: this.parties.filter((p) => p.caseId === fenceCase.id),
      inspections: this.inspections.filter((i) => i.caseId === fenceCase.id),
      decision: this.decisions.find((d) => d.caseId === fenceCase.id),
    };
  }

  private toCaseSummary(fenceCase: FenceViewerCase): FenceViewerCaseSummary {
    const parties = this.parties.filter((p) => p.caseId === fenceCase.id);
    const petitioner = parties.find((p) => p.role === 'petitioner');
    const respondent = parties.find((p) => p.role === 'respondent');

    return {
      id: fenceCase.id,
      tenantId: fenceCase.tenantId,
      caseNumber: fenceCase.caseNumber,
      disputeType: fenceCase.disputeType,
      status: fenceCase.status,
      petitionerName: petitioner?.name,
      respondentName: respondent?.name,
      fenceLocationDescription: fenceCase.fenceLocationDescription,
      petitionReceivedAt: fenceCase.petitionReceivedAt,
    };
  }
}
