// src/core/compliance/in-memory-compliance.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/types';
import {
  ComplianceTaskDefinition,
  ComplianceOccurrence,
  ComplianceStatusSummary,
} from './compliance.types';
import {
  ComplianceService,
  UpsertComplianceTaskDefinitionInput,
} from './compliance.service';

export interface InMemoryComplianceSeedData {
  definitions?: ComplianceTaskDefinition[];
  occurrences?: ComplianceOccurrence[];
}

/**
 * In-memory ComplianceService for demos/tests. Data is scoped per tenant and
 * only lives for the process lifetime.
 */
export class InMemoryComplianceService implements ComplianceService {
  private definitions: ComplianceTaskDefinition[];
  private occurrences: ComplianceOccurrence[];

  constructor(seed: InMemoryComplianceSeedData = {}) {
    this.definitions = seed.definitions ? [...seed.definitions] : [];
    this.occurrences = seed.occurrences ? [...seed.occurrences] : [];
  }

  async listTaskDefinitions(ctx: TenantContext): Promise<ComplianceTaskDefinition[]> {
    return this.definitions.filter((d) => d.tenantId === ctx.tenantId);
  }

  async getTaskDefinition(
    ctx: TenantContext,
    id: string
  ): Promise<ComplianceTaskDefinition | null> {
    return (
      this.definitions.find(
        (d) => d.id === id && d.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async upsertTaskDefinition(
    ctx: TenantContext,
    input: UpsertComplianceTaskDefinitionInput
  ): Promise<ComplianceTaskDefinition> {
    const idx = input.id
      ? this.definitions.findIndex(
          (d) => d.id === input.id && d.tenantId === ctx.tenantId
        )
      : -1;

    if (idx >= 0) {
      const updated: ComplianceTaskDefinition = {
        ...this.definitions[idx],
        code: input.code,
        name: input.name,
        description: input.description,
        statutoryCitation: input.statutoryCitation,
        recurrenceHint: input.recurrenceHint,
        isActive: input.isActive,
      };
      this.definitions[idx] = updated;
      return updated;
    }

    const created: ComplianceTaskDefinition = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      code: input.code,
      name: input.name,
      description: input.description,
      statutoryCitation: input.statutoryCitation,
      recurrenceHint: input.recurrenceHint,
      isActive: input.isActive,
    };

    this.definitions.push(created);
    return created;
  }

  async listOccurrences(
    ctx: TenantContext,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ComplianceOccurrence[]> {
    return this.occurrences.filter((o) => {
      if (o.tenantId !== ctx.tenantId) return false;
      if (fromDate && o.dueDate < fromDate) return false;
      if (toDate && o.dueDate > toDate) return false;
      return true;
    });
  }

  async getOccurrence(
    ctx: TenantContext,
    id: string
  ): Promise<ComplianceOccurrence | null> {
    return (
      this.occurrences.find(
        (o) => o.id === id && o.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async markOccurrenceCompleted(
    ctx: TenantContext,
    id: string,
    completionNotes?: string,
    proofRecordId?: string
  ): Promise<ComplianceOccurrence> {
    const occurrence = this.occurrences.find(
      (o) => o.id === id && o.tenantId === ctx.tenantId
    );

    if (!occurrence) {
      throw new Error('Compliance occurrence not found for tenant');
    }

    occurrence.status = 'completed';
    occurrence.completedAt = occurrence.completedAt ?? new Date();
    occurrence.completedByUserId = occurrence.completedByUserId ?? ctx.userId;
    if (completionNotes !== undefined) {
      occurrence.completionNotes = completionNotes;
    }
    if (proofRecordId !== undefined) {
      occurrence.proofRecordId = proofRecordId;
    }

    return occurrence;
  }

  async getStatusSummary(ctx: TenantContext): Promise<ComplianceStatusSummary> {
    const now = new Date();
    const tenantOccurrences = this.occurrences.filter(
      (o) => o.tenantId === ctx.tenantId
    );

    const totalOccurrences = tenantOccurrences.length;
    const completedOccurrences = tenantOccurrences.filter(
      (o) => o.status === 'completed'
    ).length;
    const overdueOccurrences = tenantOccurrences.filter(
      (o) =>
        o.status === 'overdue' || (o.status === 'pending' && o.dueDate < now)
    ).length;
    const upcomingOccurrences = tenantOccurrences.filter(
      (o) => o.status === 'pending' && o.dueDate > now
    ).length;

    return {
      tenantId: ctx.tenantId,
      jurisdiction: ctx.jurisdiction,
      totalOccurrences,
      completedOccurrences,
      overdueOccurrences,
      upcomingOccurrences,
    };
  }
}
