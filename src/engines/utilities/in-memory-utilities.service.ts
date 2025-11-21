// src/engines/utilities/in-memory-utilities.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/types';
import {
  UtilityServiceDef,
  ServiceLocation,
  UtilityCustomerAccount,
  UtilityAccountFilter,
  BillingCycle,
  UtilityBill,
  UtilityBillFilter,
  UtilityKind,
  UtilityAccountStatus,
  BillStatus,
} from './utility.types';
import {
  UtilitiesService,
  CreateUtilityCustomerAccountInput,
  CreateUtilityBillInput,
} from './utility.service';

export interface InMemoryUtilitiesSeedData {
  utilityServices?: UtilityServiceDef[];
  serviceLocations?: ServiceLocation[];
  customerAccounts?: UtilityCustomerAccount[];
  billingCycles?: BillingCycle[];
  bills?: UtilityBill[];
}

/**
  * In-memory UtilitiesService for tests/demos. Data is scoped per tenant
  * and exists only for the process lifetime.
  */
export class InMemoryUtilitiesService implements UtilitiesService {
  private utilityServices: UtilityServiceDef[];
  private serviceLocations: ServiceLocation[];
  private customerAccounts: UtilityCustomerAccount[];
  private billingCycles: BillingCycle[];
  private bills: UtilityBill[];

  constructor(seed: InMemoryUtilitiesSeedData = {}) {
    this.utilityServices = seed.utilityServices ? [...seed.utilityServices] : [];
    this.serviceLocations = seed.serviceLocations ? [...seed.serviceLocations] : [];
    this.customerAccounts = seed.customerAccounts ? [...seed.customerAccounts] : [];
    this.billingCycles = seed.billingCycles ? [...seed.billingCycles] : [];
    this.bills = seed.bills ? [...seed.bills] : [];
  }

  //
  // SERVICES & LOCATIONS
  //

  async listUtilityServices(ctx: TenantContext): Promise<UtilityServiceDef[]> {
    return this.utilityServices.filter((s) => s.tenantId === ctx.tenantId);
  }

  async listServiceLocations(ctx: TenantContext): Promise<ServiceLocation[]> {
    return this.serviceLocations.filter((l) => l.tenantId === ctx.tenantId);
  }

  async getServiceLocation(
    ctx: TenantContext,
    id: string
  ): Promise<ServiceLocation | null> {
    return (
      this.serviceLocations.find(
        (l) => l.id === id && l.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  //
  // CUSTOMER ACCOUNTS
  //

  async createCustomerAccount(
    ctx: TenantContext,
    input: CreateUtilityCustomerAccountInput
  ): Promise<UtilityCustomerAccount> {
    const now = new Date();

    const account: UtilityCustomerAccount = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      accountNumber: input.accountNumber,
      customerName: input.customerName,
      billingAddressLine1: input.billingAddressLine1,
      billingAddressLine2: input.billingAddressLine2,
      billingCity: input.billingCity,
      billingState: input.billingState,
      billingPostalCode: input.billingPostalCode,
      serviceLocationIds: [...input.serviceLocationIds],
      serviceKinds: [...input.serviceKinds],
      status: 'active',
      openedAt: now,
    };

    this.customerAccounts.push(account);
    return account;
  }

  async getCustomerAccount(
    ctx: TenantContext,
    id: string
  ): Promise<UtilityCustomerAccount | null> {
    return (
      this.customerAccounts.find(
        (a) => a.id === id && a.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listCustomerAccounts(
    ctx: TenantContext,
    filter: UtilityAccountFilter = {}
  ): Promise<UtilityCustomerAccount[]> {
    let results = this.customerAccounts.filter(
      (a) => a.tenantId === ctx.tenantId
    );

    if (filter.serviceKind) {
      results = results.filter((a) =>
        a.serviceKinds.includes(filter.serviceKind as UtilityKind)
      );
    }

    if (filter.status) {
      results = results.filter((a) => a.status === filter.status);
    }

    if (filter.customerNameContains) {
      const q = filter.customerNameContains.toLowerCase();
      results = results.filter((a) =>
        a.customerName.toLowerCase().includes(q)
      );
    }

    return results;
  }

  async updateCustomerAccountStatus(
    ctx: TenantContext,
    id: string,
    newStatus: UtilityAccountStatus
  ): Promise<UtilityCustomerAccount> {
    const account = this.customerAccounts.find(
      (a) => a.id === id && a.tenantId === ctx.tenantId
    );

    if (!account) {
      throw new Error('Customer account not found for tenant');
    }

    account.status = newStatus;

    // Capture closure timestamp; leave room for future audit hooks.
    if (newStatus === 'closed') {
      account.closedAt = account.closedAt ?? new Date();
    }

    return account;
  }

  //
  // BILLING CYCLES
  //

  async listBillingCycles(ctx: TenantContext): Promise<BillingCycle[]> {
    return this.billingCycles.filter((c) => c.tenantId === ctx.tenantId);
  }

  async getBillingCycle(
    ctx: TenantContext,
    id: string
  ): Promise<BillingCycle | null> {
    return (
      this.billingCycles.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  //
  // BILLS
  //

  async createBill(
    ctx: TenantContext,
    input: CreateUtilityBillInput
  ): Promise<UtilityBill> {
    const bill: UtilityBill = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      accountId: input.accountId,
      cycleId: input.cycleId,
      kind: input.kind,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      amountDueCents: input.amountDueCents,
      amountPaidCents: 0,
      status: 'issued',
    };

    this.bills.push(bill);
    return bill;
  }

  async getBill(
    ctx: TenantContext,
    id: string
  ): Promise<UtilityBill | null> {
    return (
      this.bills.find(
        (b) => b.id === id && b.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listBills(
    ctx: TenantContext,
    filter: UtilityBillFilter = {}
  ): Promise<UtilityBill[]> {
    let results = this.bills.filter((b) => b.tenantId === ctx.tenantId);

    if (filter.accountId) {
      results = results.filter((b) => b.accountId === filter.accountId);
    }

    if (filter.cycleId) {
      results = results.filter((b) => b.cycleId === filter.cycleId);
    }

    if (filter.serviceKind) {
      results = results.filter((b) => b.kind === filter.serviceKind);
    }

    if (filter.status) {
      results = results.filter((b) => b.status === filter.status);
    }

    if (filter.fromIssueDate) {
      results = results.filter(
        (b) => b.issueDate >= filter.fromIssueDate!
      );
    }

    if (filter.toIssueDate) {
      results = results.filter(
        (b) => b.issueDate <= filter.toIssueDate!
      );
    }

    return results;
  }

  async updateBillStatus(
    ctx: TenantContext,
    id: string,
    newStatus: BillStatus
  ): Promise<UtilityBill> {
    const bill = this.bills.find(
      (b) => b.id === id && b.tenantId === ctx.tenantId
    );

    if (!bill) {
      throw new Error('Utility bill not found for tenant');
    }

    bill.status = newStatus;
    // Leave room for future audit hooks.
    return bill;
  }
}
