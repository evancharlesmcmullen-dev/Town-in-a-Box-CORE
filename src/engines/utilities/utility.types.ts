// src/engines/utilities/utility.types.ts

// Core types for utility services, customer accounts, and billing.
// This is intentionally generic so towns with different mixes of
// water/sewer/storm/trash/electric/gas can all use it.

/**
 * Kind of utility service provided by the unit.
 */
export type UtilityKind =
  | 'water'
  | 'sewer'
  | 'stormwater'
  | 'trash'
  | 'electric'
  | 'gas'
  | 'other';

/**
 * A utility service definition (e.g., "Town Water", "Town Sewer").
 */
export interface UtilityServiceDef {
  id: string;
  tenantId: string;

  kind: UtilityKind;
  name: string;               // e.g. "Water Utility"
  description?: string;

  fiscalEntityId: string;     // ties to Finance/FiscalEntity later
  isActive: boolean;
}

/**
 * Physical service location (often a parcel or address).
 */
export interface ServiceLocation {
  id: string;
  tenantId: string;

  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  // Later: parcelId, GIS refs, zone, etc.
}

/**
 * The lifecycle state of a customer account.
 */
export type UtilityAccountStatus =
  | 'pending'
  | 'active'
  | 'delinquent'
  | 'disconnected'
  | 'closed';

/**
 * A utility customer account (one billing relationship).
 */
export interface UtilityCustomerAccount {
  id: string;
  tenantId: string;

  accountNumber: string;
  customerName: string;

  billingAddressLine1: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;

  serviceLocationIds: string[];    // ServiceLocation ids

  // Which services this account is subscribed to (water, sewer, etc.).
  serviceKinds: UtilityKind[];

  status: UtilityAccountStatus;

  openedAt: Date;
  closedAt?: Date;
}

/**
 * A billing cycle for a given utility service.
 */
export interface BillingCycle {
  id: string;
  tenantId: string;

  kind: UtilityKind;           // the primary service this cycle covers
  name: string;                // e.g. "March 2026 Water/Sewer"
  periodStart: Date;
  periodEnd: Date;
  billIssueDate: Date;
  billDueDate: Date;
}

/**
 * Status of an individual bill.
 */
export type BillStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'writtenOff';

/**
 * A single utility bill.
 * Payments will be tracked via the Payment engine; this just describes the bill.
 */
export interface UtilityBill {
  id: string;
  tenantId: string;

  accountId: string;           // UtilityCustomerAccount id
  cycleId: string;             // BillingCycle id
  kind: UtilityKind;

  issueDate: Date;
  dueDate: Date;

  amountDueCents: number;
  amountPaidCents: number;

  status: BillStatus;

  // Optional link to Finance/Payment reference ids later.
  externalRef?: string;
}

/**
 * Filter for listing/searching accounts.
 */
export interface UtilityAccountFilter {
  serviceKind?: UtilityKind;
  status?: UtilityAccountStatus;
  customerNameContains?: string;
}

/**
 * Filter for listing/searching bills.
 */
export interface UtilityBillFilter {
  accountId?: string;
  serviceKind?: UtilityKind;
  status?: BillStatus;
  cycleId?: string;
  fromIssueDate?: Date;
  toIssueDate?: Date;
}