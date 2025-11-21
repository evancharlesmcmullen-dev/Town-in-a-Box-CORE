// src/engines/code-enforcement/in-memory-code-enforcement.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/types';
import {
  CodeViolationType,
  CodeCase,
  CodeCaseSummary,
  CodeCaseStatus,
} from './code.types';
import {
  CodeEnforcementService,
  CreateCodeCaseInput,
  CodeCaseFilter,
} from './code-enforcement.service';

export interface InMemoryCodeEnforcementSeedData {
  violationTypes?: CodeViolationType[];
  cases?: CodeCase[];
}

/**
 * In-memory CodeEnforcementService for tests/demos. Data is scoped per tenant
 * and exists only for the process lifetime.
 */
export class InMemoryCodeEnforcementService implements CodeEnforcementService {
  private violationTypes: CodeViolationType[];
  private cases: CodeCase[];

  constructor(seed: InMemoryCodeEnforcementSeedData = {}) {
    this.violationTypes = seed.violationTypes ? [...seed.violationTypes] : [];
    this.cases = seed.cases ? [...seed.cases] : [];
  }

  async listViolationTypes(ctx: TenantContext): Promise<CodeViolationType[]> {
    return this.violationTypes.filter((v) => v.tenantId === ctx.tenantId);
  }

  async getViolationType(
    ctx: TenantContext,
    id: string
  ): Promise<CodeViolationType | null> {
    return (
      this.violationTypes.find(
        (v) => v.id === id && v.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async createCase(
    ctx: TenantContext,
    input: CreateCodeCaseInput
  ): Promise<CodeCase> {
    const now = new Date();
    const codeCase: CodeCase = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      violationTypeId: input.violationTypeId,
      respondentName: input.respondentName,
      respondentAddressLine1: input.respondentAddressLine1,
      respondentAddressLine2: input.respondentAddressLine2,
      respondentCity: input.respondentCity,
      respondentState: input.respondentState,
      respondentPostalCode: input.respondentPostalCode,
      siteAddressLine1: input.siteAddressLine1,
      siteAddressLine2: input.siteAddressLine2,
      siteCity: input.siteCity,
      siteState: input.siteState,
      sitePostalCode: input.sitePostalCode,
      status: 'open',
      createdAt: now,
      createdByUserId: ctx.userId,
      relatedRecordIds: [],
    };

    this.cases.push(codeCase);
    return codeCase;
  }

  async getCase(
    ctx: TenantContext,
    id: string
  ): Promise<CodeCase | null> {
    return (
      this.cases.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listCases(
    ctx: TenantContext,
    filter: CodeCaseFilter = {}
  ): Promise<CodeCaseSummary[]> {
    let results = this.cases.filter((c) => c.tenantId === ctx.tenantId);

    if (filter.violationTypeId) {
      results = results.filter(
        (c) => c.violationTypeId === filter.violationTypeId
      );
    }

    if (filter.status) {
      results = results.filter((c) => c.status === filter.status);
    }

    if (filter.respondentNameContains) {
      const q = filter.respondentNameContains.toLowerCase();
      results = results.filter(
        (c) => c.respondentName?.toLowerCase().includes(q)
      );
    }

    if (filter.siteAddressContains) {
      const q = filter.siteAddressContains.toLowerCase();
      results = results.filter((c) =>
        (c.siteAddressLine1 ?? '').toLowerCase().includes(q)
      );
    }

    if (filter.fromDate) {
      results = results.filter((c) => c.createdAt >= filter.fromDate!);
    }

    if (filter.toDate) {
      results = results.filter((c) => c.createdAt <= filter.toDate!);
    }

    return results.map<CodeCaseSummary>((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      violationTypeId: c.violationTypeId,
      respondentName: c.respondentName,
      siteAddressLine1: c.siteAddressLine1,
      status: c.status,
      createdAt: c.createdAt,
    }));
  }

  async updateCaseStatus(
    ctx: TenantContext,
    id: string,
    newStatus: CodeCaseStatus
  ): Promise<CodeCase> {
    const codeCase = this.cases.find(
      (c) => c.id === id && c.tenantId === ctx.tenantId
    );

    if (!codeCase) {
      throw new Error('Code case not found for tenant');
    }

    const now = new Date();
    codeCase.status = newStatus;

    // Populate timestamps in a simple, reasonable way.
    if (newStatus === 'noticeSent') {
      codeCase.firstNoticeSentAt = codeCase.firstNoticeSentAt ?? now;
      codeCase.lastNoticeSentAt = now;
    }

    if (newStatus === 'complianceInProgress') {
      codeCase.firstNoticeSentAt = codeCase.firstNoticeSentAt ?? now;
      codeCase.lastNoticeSentAt = now;
    }

    if (newStatus === 'complied') {
      codeCase.compliedAt = codeCase.compliedAt ?? now;
      codeCase.closedAt = codeCase.closedAt ?? now;
    }

    if (newStatus === 'closed') {
      codeCase.closedAt = codeCase.closedAt ?? now;
    }

    return codeCase;
  }
}
