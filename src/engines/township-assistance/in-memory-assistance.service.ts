// src/engines/township-assistance/in-memory-assistance.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  AssistanceProgramPolicy,
  AssistanceApplication,
  AssistanceCase,
  AssistanceCaseSummary,
  AssistanceCaseStatus,
  AssistanceBenefit,
  AssistanceBenefitType,
} from './assistance.types';
import {
  TownshipAssistanceService,
  CreateAssistanceApplicationInput,
  AssistanceCaseFilter,
  CreateAssistanceBenefitInput,
} from './assistance.service';

export interface InMemoryAssistanceSeedData {
  programPolicies?: AssistanceProgramPolicy[];
  applications?: AssistanceApplication[];
  cases?: AssistanceCase[];
  benefits?: AssistanceBenefit[];
}

/**
 * In-memory TownshipAssistanceService for demos/tests. Data is scoped per tenant
 * and exists only for the process lifetime.
 */
export class InMemoryAssistanceService implements TownshipAssistanceService {
  private programPolicies: AssistanceProgramPolicy[];
  private applications: AssistanceApplication[];
  private cases: AssistanceCase[];
  private benefits: AssistanceBenefit[];

  constructor(seed: InMemoryAssistanceSeedData = {}) {
    this.programPolicies = seed.programPolicies ? [...seed.programPolicies] : [];
    this.applications = seed.applications ? [...seed.applications] : [];
    this.cases = seed.cases ? [...seed.cases] : [];
    this.benefits = seed.benefits ? [...seed.benefits] : [];
  }

  //
  // PROGRAM POLICY
  //

  async listProgramPolicies(ctx: TenantContext): Promise<AssistanceProgramPolicy[]> {
    return this.programPolicies.filter((p) => p.tenantId === ctx.tenantId);
  }

  async getProgramPolicy(
    ctx: TenantContext,
    id: string
  ): Promise<AssistanceProgramPolicy | null> {
    return (
      this.programPolicies.find(
        (p) => p.id === id && p.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  //
  // APPLICATIONS
  //

  async createApplication(
    ctx: TenantContext,
    input: CreateAssistanceApplicationInput
  ): Promise<AssistanceApplication> {
    const now = new Date();
    const requestedBenefitTypes = input.requestedBenefitTypes.map(
      (t) => t as AssistanceBenefitType
    );

    const application: AssistanceApplication = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      applicantName: input.applicantName,
      applicantEmail: input.applicantEmail,
      applicantPhone: input.applicantPhone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      household: [...input.household],
      monthlyIncomeCents: input.monthlyIncomeCents,
      monthlyExpensesCents: input.monthlyExpensesCents,
      requestedBenefitTypes,
      requestedAmountCents: input.requestedAmountCents,
      createdAt: now,
    };

    this.applications.push(application);
    return application;
  }

  async getApplication(
    ctx: TenantContext,
    id: string
  ): Promise<AssistanceApplication | null> {
    return (
      this.applications.find(
        (a) => a.id === id && a.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  //
  // CASES
  //

  async createCaseForApplication(
    ctx: TenantContext,
    applicationId: string,
    programPolicyId?: string
  ): Promise<AssistanceCase> {
    const application = this.applications.find(
      (a) => a.id === applicationId && a.tenantId === ctx.tenantId
    );

    if (!application) {
      throw new Error('Application not found for tenant');
    }

    const now = new Date();
    const assistanceCase: AssistanceCase = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      applicationId,
      programPolicyId,
      status: 'open',
      openedAt: now,
      relatedRecordIds: [],
    };

    this.cases.push(assistanceCase);
    return assistanceCase;
  }

  async getCase(
    ctx: TenantContext,
    id: string
  ): Promise<AssistanceCase | null> {
    return (
      this.cases.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listCases(
    ctx: TenantContext,
    filter: AssistanceCaseFilter = {}
  ): Promise<AssistanceCaseSummary[]> {
    let results = this.cases.filter((c) => c.tenantId === ctx.tenantId);

    if (filter.status) {
      results = results.filter((c) => c.status === filter.status);
    }

    if (filter.applicantNameContains) {
      const q = filter.applicantNameContains.toLowerCase();
      results = results.filter((c) => {
        const app = this.applications.find(
          (a) => a.id === c.applicationId && a.tenantId === ctx.tenantId
        );
        return app ? app.applicantName.toLowerCase().includes(q) : false;
      });
    }

    if (filter.fromDate) {
      results = results.filter((c) => c.openedAt >= filter.fromDate!);
    }

    if (filter.toDate) {
      results = results.filter((c) => c.openedAt <= filter.toDate!);
    }

    return results.map<AssistanceCaseSummary>((c) => {
      const app = this.applications.find(
        (a) => a.id === c.applicationId && a.tenantId === ctx.tenantId
      );

      return {
        id: c.id,
        tenantId: c.tenantId,
        applicantName: app ? app.applicantName : 'Unknown applicant',
        status: c.status,
        openedAt: c.openedAt,
        decidedAt: c.decidedAt,
      };
    });
  }

  async updateCaseStatus(
    ctx: TenantContext,
    id: string,
    newStatus: AssistanceCaseStatus
  ): Promise<AssistanceCase> {
    const assistanceCase = this.cases.find(
      (c) => c.id === id && c.tenantId === ctx.tenantId
    );

    if (!assistanceCase) {
      throw new Error('Assistance case not found for tenant');
    }

    const now = new Date();
    assistanceCase.status = newStatus;

    // Set timestamps in a simple, reasonable way; leave room for audit hooks.
    if (newStatus === 'approved' || newStatus === 'denied') {
      assistanceCase.decidedAt = assistanceCase.decidedAt ?? now;
    }

    if (newStatus === 'paid' || newStatus === 'closed') {
      assistanceCase.closedAt = assistanceCase.closedAt ?? now;
    }

    return assistanceCase;
  }

  //
  // BENEFITS
  //

  async createBenefit(
    ctx: TenantContext,
    input: CreateAssistanceBenefitInput
  ): Promise<AssistanceBenefit> {
    const assistanceCase = this.cases.find(
      (c) => c.id === input.caseId && c.tenantId === ctx.tenantId
    );

    if (!assistanceCase) {
      throw new Error('Assistance case not found for tenant');
    }

    const benefit: AssistanceBenefit = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      caseId: input.caseId,
      type: input.type as AssistanceBenefitType,
      amountCents: input.amountCents,
      payeeName: input.payeeName,
      payeeAddressLine1: input.payeeAddressLine1,
      payeeAddressLine2: input.payeeAddressLine2,
      payeeCity: input.payeeCity,
      payeeState: input.payeeState,
      payeePostalCode: input.payeePostalCode,
      approvedAt: new Date(),
    };

    this.benefits.push(benefit);
    return benefit;
  }

  async listBenefitsForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<AssistanceBenefit[]> {
    return this.benefits.filter(
      (b) => b.tenantId === ctx.tenantId && b.caseId === caseId
    );
  }
}
