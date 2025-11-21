// src/engines/fire/in-memory-fire-contract.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FireServiceContract,
  FirePerformanceSnapshot,
} from './fire-contract.types';
import {
  FireContractService,
  UpsertFireServiceContractInput,
  FireContractFilter,
} from './fire-contract.service';

export interface InMemoryFireContractSeedData {
  contracts?: FireServiceContract[];
  snapshots?: FirePerformanceSnapshot[];
}

/**
 * In-memory FireContractService for demos/tests. Data is scoped per tenant and
 * exists only for the process lifetime.
 */
export class InMemoryFireContractService implements FireContractService {
  private contracts: FireServiceContract[];
  private snapshots: FirePerformanceSnapshot[];

  constructor(seed: InMemoryFireContractSeedData = {}) {
    this.contracts = seed.contracts ? [...seed.contracts] : [];
    this.snapshots = seed.snapshots ? [...seed.snapshots] : [];
  }

  async listContracts(
    ctx: TenantContext,
    filter: FireContractFilter = {}
  ): Promise<FireServiceContract[]> {
    let results = this.contracts.filter(
      (c) => c.tenantId === ctx.tenantId
    );

    if (filter.isActive !== undefined) {
      results = results.filter((c) => c.isActive === filter.isActive);
    }

    if (filter.providerNameContains) {
      const q = filter.providerNameContains.toLowerCase();
      results = results.filter((c) =>
        c.providerName.toLowerCase().includes(q)
      );
    }

    return results;
  }

  async getContract(
    ctx: TenantContext,
    id: string
  ): Promise<FireServiceContract | null> {
    return (
      this.contracts.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async upsertContract(
    ctx: TenantContext,
    input: UpsertFireServiceContractInput
  ): Promise<FireServiceContract> {
    const existingIndex = input.id
      ? this.contracts.findIndex(
          (c) => c.id === input.id && c.tenantId === ctx.tenantId
        )
      : -1;

    if (existingIndex >= 0) {
      const updated: FireServiceContract = {
        ...this.contracts[existingIndex],
        providerName: input.providerName,
        coverageDescription: input.coverageDescription,
        startDate: input.startDate,
        endDate: input.endDate,
        annualCostCents: input.annualCostCents,
        fundId: input.fundId,
        renewalNoticeDays: input.renewalNoticeDays,
        notes: input.notes,
        isActive: input.isActive,
      };

      this.contracts[existingIndex] = updated;
      return updated;
    }

    const created: FireServiceContract = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      providerName: input.providerName,
      coverageDescription: input.coverageDescription,
      startDate: input.startDate,
      endDate: input.endDate,
      annualCostCents: input.annualCostCents,
      fundId: input.fundId,
      renewalNoticeDays: input.renewalNoticeDays,
      notes: input.notes,
      isActive: input.isActive,
    };

    this.contracts.push(created);
    return created;
  }

  async listPerformanceSnapshots(
    ctx: TenantContext,
    contractId: string
  ): Promise<FirePerformanceSnapshot[]> {
    return this.snapshots.filter(
      (s) => s.tenantId === ctx.tenantId && s.contractId === contractId
    );
  }

  async recordPerformanceSnapshot(
    ctx: TenantContext,
    snapshot: FirePerformanceSnapshot
  ): Promise<FirePerformanceSnapshot> {
    const record: FirePerformanceSnapshot = snapshot.id
      ? snapshot
      : { ...snapshot, id: randomUUID() };

    this.snapshots.push({
      ...record,
      tenantId: ctx.tenantId,
    });

    return record;
  }
}
