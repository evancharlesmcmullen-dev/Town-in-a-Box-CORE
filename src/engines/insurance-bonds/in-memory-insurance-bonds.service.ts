// src/engines/insurance-bonds/in-memory-insurance-bonds.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  InsuranceCarrier,
  InsurancePolicy,
  InsurancePolicySummary,
  PolicyCoverage,
  OfficialBond,
  OfficialBondSummary,
  UpcomingRenewal,
} from './insurance-bonds.types';
import {
  InsuranceBondsService,
  CreateInsuranceCarrierInput,
  UpdateInsuranceCarrierInput,
  CreateInsurancePolicyInput,
  UpdateInsurancePolicyInput,
  CreatePolicyCoverageInput,
  CreateOfficialBondInput,
  UpdateOfficialBondInput,
  InsurancePolicyFilter,
  OfficialBondFilter,
} from './insurance-bonds.service';

/**
 * Seed data structure for in-memory service.
 */
export interface InMemoryInsuranceBondsSeedData {
  carriers?: InsuranceCarrier[];
  policies?: InsurancePolicy[];
  coverages?: PolicyCoverage[];
  bonds?: OfficialBond[];
}

/**
 * In-memory implementation of the Insurance & Bonds service.
 * Used for testing and demo purposes.
 *
 * TODO: Implement PostgresInsuranceBondsService for production use.
 */
export class InMemoryInsuranceBondsService implements InsuranceBondsService {
  private carriers: InsuranceCarrier[];
  private policies: InsurancePolicy[];
  private coverages: PolicyCoverage[];
  private bonds: OfficialBond[];

  constructor(seed: InMemoryInsuranceBondsSeedData = {}) {
    this.carriers = seed.carriers ? [...seed.carriers] : [];
    this.policies = seed.policies ? [...seed.policies] : [];
    this.coverages = seed.coverages ? [...seed.coverages] : [];
    this.bonds = seed.bonds ? [...seed.bonds] : [];
  }

  //
  // CARRIERS
  //

  async listCarriers(ctx: TenantContext): Promise<InsuranceCarrier[]> {
    return this.carriers.filter((c) => c.tenantId === ctx.tenantId);
  }

  async getCarrier(
    ctx: TenantContext,
    id: string
  ): Promise<InsuranceCarrier | null> {
    return (
      this.carriers.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async createCarrier(
    ctx: TenantContext,
    input: CreateInsuranceCarrierInput
  ): Promise<InsuranceCarrier> {
    const carrier: InsuranceCarrier = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      ...input,
    };
    this.carriers.push(carrier);
    return carrier;
  }

  async updateCarrier(
    ctx: TenantContext,
    id: string,
    input: UpdateInsuranceCarrierInput
  ): Promise<InsuranceCarrier> {
    const carrier = await this.getCarrier(ctx, id);
    if (!carrier) {
      throw new Error(`Carrier not found: ${id}`);
    }
    Object.assign(carrier, input);
    return carrier;
  }

  //
  // POLICIES
  //

  async listPolicies(
    ctx: TenantContext,
    filter?: InsurancePolicyFilter
  ): Promise<InsurancePolicySummary[]> {
    let results = this.policies.filter((p) => p.tenantId === ctx.tenantId);

    if (filter?.policyType) {
      results = results.filter((p) => p.policyType === filter.policyType);
    }
    if (filter?.status) {
      results = results.filter((p) => p.status === filter.status);
    }
    if (filter?.carrierId) {
      results = results.filter((p) => p.carrierId === filter.carrierId);
    }
    if (filter?.expiringWithinDays !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + filter.expiringWithinDays);
      results = results.filter((p) => new Date(p.expirationDate) <= cutoff);
    }

    return results.map((p) => this.toPolicySummary(p));
  }

  async getPolicy(
    ctx: TenantContext,
    id: string
  ): Promise<InsurancePolicy | null> {
    const policy = this.policies.find(
      (p) => p.id === id && p.tenantId === ctx.tenantId
    );
    if (!policy) return null;

    // Attach coverages
    const coverages = this.coverages.filter((c) => c.policyId === policy.id);
    return { ...policy, coverages };
  }

  async createPolicy(
    ctx: TenantContext,
    input: CreateInsurancePolicyInput
  ): Promise<InsurancePolicy> {
    const now = new Date();
    const policy: InsurancePolicy = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      policyType: input.policyType,
      policyNumber: input.policyNumber,
      carrierId: input.carrierId,
      status: 'active',
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      premiumAmountCents: input.premiumAmountCents,
      paymentFrequency: input.paymentFrequency,
      fundId: input.fundId,
      renewalNoticeDays: input.renewalNoticeDays ?? 60,
      notes: input.notes,
      createdAt: now,
    };
    this.policies.push(policy);
    return policy;
  }

  async updatePolicy(
    ctx: TenantContext,
    id: string,
    input: UpdateInsurancePolicyInput
  ): Promise<InsurancePolicy> {
    const policy = this.policies.find(
      (p) => p.id === id && p.tenantId === ctx.tenantId
    );
    if (!policy) {
      throw new Error(`Policy not found: ${id}`);
    }

    Object.assign(policy, input, { updatedAt: new Date() });
    return policy;
  }

  async renewPolicy(
    ctx: TenantContext,
    policyId: string,
    newExpirationDate: Date,
    newPremiumAmountCents?: number
  ): Promise<InsurancePolicy> {
    const oldPolicy = this.policies.find(
      (p) => p.id === policyId && p.tenantId === ctx.tenantId
    );
    if (!oldPolicy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // Mark old policy as expired
    oldPolicy.status = 'expired';
    oldPolicy.updatedAt = new Date();

    // Create new policy starting from old expiration
    const newPolicy: InsurancePolicy = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      policyType: oldPolicy.policyType,
      policyNumber: oldPolicy.policyNumber,
      carrierId: oldPolicy.carrierId,
      status: 'active',
      effectiveDate: oldPolicy.expirationDate,
      expirationDate: newExpirationDate,
      premiumAmountCents: newPremiumAmountCents ?? oldPolicy.premiumAmountCents,
      paymentFrequency: oldPolicy.paymentFrequency,
      fundId: oldPolicy.fundId,
      renewalNoticeDays: oldPolicy.renewalNoticeDays,
      notes: oldPolicy.notes,
      createdAt: new Date(),
    };
    this.policies.push(newPolicy);

    return newPolicy;
  }

  //
  // POLICY COVERAGES
  //

  async listCoveragesForPolicy(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyCoverage[]> {
    // Verify policy belongs to tenant
    const policy = await this.getPolicy(ctx, policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    return this.coverages.filter((c) => c.policyId === policyId);
  }

  async addCoverage(
    ctx: TenantContext,
    input: CreatePolicyCoverageInput
  ): Promise<PolicyCoverage> {
    // Verify policy belongs to tenant
    const policy = await this.getPolicy(ctx, input.policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${input.policyId}`);
    }

    const coverage: PolicyCoverage = {
      id: randomUUID(),
      policyId: input.policyId,
      coverageType: input.coverageType,
      limitAmountCents: input.limitAmountCents,
      deductibleAmountCents: input.deductibleAmountCents,
      perOccurrence: input.perOccurrence,
      aggregateLimitCents: input.aggregateLimitCents,
      notes: input.notes,
    };
    this.coverages.push(coverage);
    return coverage;
  }

  async removeCoverage(ctx: TenantContext, coverageId: string): Promise<void> {
    const idx = this.coverages.findIndex((c) => c.id === coverageId);
    if (idx >= 0) {
      // Verify policy belongs to tenant
      const coverage = this.coverages[idx];
      const policy = await this.getPolicy(ctx, coverage.policyId);
      if (!policy) {
        throw new Error(`Coverage not found or not authorized: ${coverageId}`);
      }
      this.coverages.splice(idx, 1);
    }
  }

  //
  // OFFICIAL BONDS
  //

  async listBonds(
    ctx: TenantContext,
    filter?: OfficialBondFilter
  ): Promise<OfficialBondSummary[]> {
    let results = this.bonds.filter((b) => b.tenantId === ctx.tenantId);

    if (filter?.bondType) {
      results = results.filter((b) => b.bondType === filter.bondType);
    }
    if (filter?.status) {
      results = results.filter((b) => b.status === filter.status);
    }
    if (filter?.officialNameContains) {
      const search = filter.officialNameContains.toLowerCase();
      results = results.filter((b) =>
        b.officialName.toLowerCase().includes(search)
      );
    }
    if (filter?.expiringWithinDays !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + filter.expiringWithinDays);
      results = results.filter((b) => new Date(b.expirationDate) <= cutoff);
    }

    return results.map((b) => this.toBondSummary(b));
  }

  async getBond(ctx: TenantContext, id: string): Promise<OfficialBond | null> {
    return (
      this.bonds.find((b) => b.id === id && b.tenantId === ctx.tenantId) ??
      null
    );
  }

  async createBond(
    ctx: TenantContext,
    input: CreateOfficialBondInput
  ): Promise<OfficialBond> {
    const now = new Date();
    const bond: OfficialBond = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      bondType: input.bondType,
      officialName: input.officialName,
      officialTitle: input.officialTitle,
      status: 'active',
      bondNumber: input.bondNumber,
      carrierId: input.carrierId,
      bondAmountCents: input.bondAmountCents,
      premiumAmountCents: input.premiumAmountCents,
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      renewalNoticeDays: input.renewalNoticeDays ?? 60,
      notes: input.notes,
      createdAt: now,
    };
    this.bonds.push(bond);
    return bond;
  }

  async updateBond(
    ctx: TenantContext,
    id: string,
    input: UpdateOfficialBondInput
  ): Promise<OfficialBond> {
    const bond = this.bonds.find(
      (b) => b.id === id && b.tenantId === ctx.tenantId
    );
    if (!bond) {
      throw new Error(`Bond not found: ${id}`);
    }

    Object.assign(bond, input, { updatedAt: new Date() });
    return bond;
  }

  async recordBondFiling(
    ctx: TenantContext,
    bondId: string,
    filedAt: Date,
    recordingReference?: string
  ): Promise<OfficialBond> {
    const bond = this.bonds.find(
      (b) => b.id === bondId && b.tenantId === ctx.tenantId
    );
    if (!bond) {
      throw new Error(`Bond not found: ${bondId}`);
    }

    bond.filedWithCountyAt = filedAt;
    bond.countyRecordingReference = recordingReference;
    bond.updatedAt = new Date();
    return bond;
  }

  async renewBond(
    ctx: TenantContext,
    bondId: string,
    newExpirationDate: Date,
    newPremiumAmountCents?: number
  ): Promise<OfficialBond> {
    const oldBond = this.bonds.find(
      (b) => b.id === bondId && b.tenantId === ctx.tenantId
    );
    if (!oldBond) {
      throw new Error(`Bond not found: ${bondId}`);
    }

    // Mark old bond as expired
    oldBond.status = 'expired';
    oldBond.updatedAt = new Date();

    // Create new bond starting from old expiration
    const newBond: OfficialBond = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      bondType: oldBond.bondType,
      officialName: oldBond.officialName,
      officialTitle: oldBond.officialTitle,
      status: 'active',
      bondNumber: oldBond.bondNumber,
      carrierId: oldBond.carrierId,
      bondAmountCents: oldBond.bondAmountCents,
      premiumAmountCents: newPremiumAmountCents ?? oldBond.premiumAmountCents,
      effectiveDate: oldBond.expirationDate,
      expirationDate: newExpirationDate,
      renewalNoticeDays: oldBond.renewalNoticeDays,
      notes: oldBond.notes,
      createdAt: new Date(),
    };
    this.bonds.push(newBond);

    return newBond;
  }

  //
  // RENEWAL TRACKING
  //

  async getUpcomingRenewals(
    ctx: TenantContext,
    withinDays: number
  ): Promise<UpcomingRenewal[]> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    const renewals: UpcomingRenewal[] = [];

    // Check policies
    const policies = this.policies.filter(
      (p) =>
        p.tenantId === ctx.tenantId &&
        p.status === 'active' &&
        new Date(p.expirationDate) <= cutoff &&
        new Date(p.expirationDate) >= now
    );
    for (const p of policies) {
      renewals.push({
        type: 'policy',
        id: p.id,
        name: `${p.policyType} - ${p.policyNumber}`,
        expirationDate: p.expirationDate,
        daysUntilExpiration: this.daysBetween(now, new Date(p.expirationDate)),
      });
    }

    // Check bonds
    const bonds = this.bonds.filter(
      (b) =>
        b.tenantId === ctx.tenantId &&
        b.status === 'active' &&
        new Date(b.expirationDate) <= cutoff &&
        new Date(b.expirationDate) >= now
    );
    for (const b of bonds) {
      renewals.push({
        type: 'bond',
        id: b.id,
        name: `${b.officialTitle} - ${b.officialName}`,
        expirationDate: b.expirationDate,
        daysUntilExpiration: this.daysBetween(now, new Date(b.expirationDate)),
      });
    }

    // Sort by days until expiration
    renewals.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

    return renewals;
  }

  //
  // HELPERS
  //

  private toPolicySummary(policy: InsurancePolicy): InsurancePolicySummary {
    const carrier = this.carriers.find((c) => c.id === policy.carrierId);
    return {
      id: policy.id,
      tenantId: policy.tenantId,
      policyType: policy.policyType,
      policyNumber: policy.policyNumber,
      carrierName: carrier?.name ?? 'Unknown',
      status: policy.status,
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      premiumAmountCents: policy.premiumAmountCents,
    };
  }

  private toBondSummary(bond: OfficialBond): OfficialBondSummary {
    return {
      id: bond.id,
      tenantId: bond.tenantId,
      bondType: bond.bondType,
      officialName: bond.officialName,
      officialTitle: bond.officialTitle,
      status: bond.status,
      bondAmountCents: bond.bondAmountCents,
      effectiveDate: bond.effectiveDate,
      expirationDate: bond.expirationDate,
    };
  }

  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
  }
}
