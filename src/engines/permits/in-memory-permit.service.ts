// src/engines/permits/in-memory-permit.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/types';
import {
  PermitType,
  PermitApplication,
  PermitSummary,
  PermitStatus,
} from './permit.types';
import {
  PermitService,
  CreatePermitApplicationInput,
  PermitFilter,
} from './permit.service';

export interface InMemoryPermitSeedData {
  permitTypes?: PermitType[];
  applications?: PermitApplication[];
}

/**
 * Simple in-memory PermitService useful for tests/demos.
 * Data is filtered by tenant id and does not persist between runs.
 */
export class InMemoryPermitService implements PermitService {
  private permitTypes: PermitType[];
  private applications: PermitApplication[];

  constructor(seed: InMemoryPermitSeedData = {}) {
    this.permitTypes = seed.permitTypes ? [...seed.permitTypes] : [];
    this.applications = seed.applications ? [...seed.applications] : [];
  }

  async listPermitTypes(ctx: TenantContext): Promise<PermitType[]> {
    return this.permitTypes.filter((p) => p.tenantId === ctx.tenantId);
  }

  async getPermitType(
    ctx: TenantContext,
    id: string
  ): Promise<PermitType | null> {
    return (
      this.permitTypes.find(
        (p) => p.id === id && p.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async createApplication(
    ctx: TenantContext,
    input: CreatePermitApplicationInput
  ): Promise<PermitApplication> {
    const now = new Date();
    const application: PermitApplication = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      permitTypeId: input.permitTypeId,
      applicantName: input.applicantName,
      applicantEmail: input.applicantEmail,
      applicantPhone: input.applicantPhone,
      siteAddressLine1: input.siteAddressLine1,
      siteAddressLine2: input.siteAddressLine2,
      siteCity: input.siteCity,
      siteState: input.siteState,
      sitePostalCode: input.sitePostalCode,
      descriptionOfWork: input.descriptionOfWork,
      status: 'submitted',
      submittedAt: now,
      relatedRecordIds: [],
    };

    this.applications.push(application);
    return application;
  }

  async getApplication(
    ctx: TenantContext,
    id: string
  ): Promise<PermitApplication | null> {
    return (
      this.applications.find(
        (a) => a.id === id && a.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listApplications(
    ctx: TenantContext,
    filter: PermitFilter = {}
  ): Promise<PermitSummary[]> {
    let results = this.applications.filter(
      (a) => a.tenantId === ctx.tenantId
    );

    if (filter.permitTypeId) {
      results = results.filter(
        (a) => a.permitTypeId === filter.permitTypeId
      );
    }

    if (filter.status) {
      results = results.filter((a) => a.status === filter.status);
    }

    if (filter.applicantNameContains) {
      const q = filter.applicantNameContains.toLowerCase();
      results = results.filter((a) =>
        a.applicantName.toLowerCase().includes(q)
      );
    }

    if (filter.fromDate) {
      results = results.filter((a) => {
        if (!a.submittedAt) return false;
        return a.submittedAt >= filter.fromDate!;
      });
    }

    if (filter.toDate) {
      results = results.filter((a) => {
        if (!a.submittedAt) return false;
        return a.submittedAt <= filter.toDate!;
      });
    }

    return results.map<PermitSummary>((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      permitTypeId: a.permitTypeId,
      applicantName: a.applicantName,
      status: a.status,
      submittedAt: a.submittedAt,
      issuedAt: a.issuedAt,
    }));
  }

  async updateApplicationStatus(
    ctx: TenantContext,
    id: string,
    newStatus: PermitStatus
  ): Promise<PermitApplication> {
    const application = this.applications.find(
      (a) => a.id === id && a.tenantId === ctx.tenantId
    );

    if (!application) {
      throw new Error('Permit application not found for tenant');
    }

    const now = new Date();
    application.status = newStatus;

    // Populate timestamps in a simple, reasonable way.
    if (!application.submittedAt) {
      application.submittedAt = now;
    }

    if (newStatus === 'approved' || newStatus === 'denied') {
      application.decidedAt = application.decidedAt ?? now;
    }

    if (newStatus === 'issued') {
      application.decidedAt = application.decidedAt ?? now;
      application.issuedAt = application.issuedAt ?? now;
    }

    if (newStatus === 'closed') {
      application.closedAt = application.closedAt ?? now;
    }

    return application;
  }
}
