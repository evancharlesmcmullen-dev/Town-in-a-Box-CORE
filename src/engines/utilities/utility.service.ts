// src/engines/utilities/utility.service.ts

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

/**
 * Input for creating a new utility customer account.
 */
export interface CreateUtilityCustomerAccountInput {
  accountNumber: string;
  customerName: string;

  billingAddressLine1: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;

  serviceLocationIds: string[];
  serviceKinds: UtilityKind[];
}

/**
 * Input for creating a new utility bill.
 */
export interface CreateUtilityBillInput {
  accountId: string;
  cycleId: string;
  kind: UtilityKind;

  issueDate: Date;
  dueDate: Date;
  amountDueCents: number;
}

/**
 * Public service interface for the Utilities engine.
 *
 * Implementations will:
 * - Manage utility services, service locations, and customer accounts.
 * - Generate bills for billing cycles (and tie into Payments/Finance).
 * - Integrate with metering imports (later) to compute usage-based bills.
 */
export interface UtilitiesService {
  //
  // SERVICES & LOCATIONS
  //

  listUtilityServices(ctx: TenantContext): Promise<UtilityServiceDef[]>;

  listServiceLocations(ctx: TenantContext): Promise<ServiceLocation[]>;

  getServiceLocation(
    ctx: TenantContext,
    id: string
  ): Promise<ServiceLocation | null>;

  //
  // CUSTOMER ACCOUNTS
  //

  createCustomerAccount(
    ctx: TenantContext,
    input: CreateUtilityCustomerAccountInput
  ): Promise<UtilityCustomerAccount>;

  getCustomerAccount(
    ctx: TenantContext,
    id: string
  ): Promise<UtilityCustomerAccount | null>;

  listCustomerAccounts(
    ctx: TenantContext,
    filter?: UtilityAccountFilter
  ): Promise<UtilityCustomerAccount[]>;

  updateCustomerAccountStatus(
    ctx: TenantContext,
    id: string,
    newStatus: UtilityAccountStatus
  ): Promise<UtilityCustomerAccount>;

  //
  // BILLING CYCLES
  //

  listBillingCycles(
    ctx: TenantContext
  ): Promise<BillingCycle[]>;

  getBillingCycle(
    ctx: TenantContext,
    id: string
  ): Promise<BillingCycle | null>;

  //
  // BILLS
  //

  createBill(
    ctx: TenantContext,
    input: CreateUtilityBillInput
  ): Promise<UtilityBill>;

  getBill(
    ctx: TenantContext,
    id: string
  ): Promise<UtilityBill | null>;

  listBills(
    ctx: TenantContext,
    filter?: UtilityBillFilter
  ): Promise<UtilityBill[]>;

  updateBillStatus(
    ctx: TenantContext,
    id: string,
    newStatus: BillStatus
  ): Promise<UtilityBill>;
}