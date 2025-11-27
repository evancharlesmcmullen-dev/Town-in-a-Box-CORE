// src/engines/insurance-bonds/insurance-bonds.types.ts

// Core types for managing insurance policies and official bonds.

/**
 * Type of insurance policy.
 */
export type InsurancePolicyType =
  | 'general_liability'
  | 'property'
  | 'auto'
  | 'workers_compensation'
  | 'public_official_liability'
  | 'cyber_liability'
  | 'umbrella'
  | 'other';

/**
 * Status of an insurance policy.
 */
export type InsurancePolicyStatus =
  | 'active'
  | 'pending_renewal'
  | 'expired'
  | 'cancelled';

/**
 * Type of official bond.
 */
export type OfficialBondType =
  | 'trustee'
  | 'clerk'
  | 'board_member'
  | 'deputy'
  | 'treasurer'
  | 'other';

/**
 * Status of an official bond.
 */
export type OfficialBondStatus =
  | 'active'
  | 'pending_renewal'
  | 'expired'
  | 'cancelled';

/**
 * Insurance carrier information.
 */
export interface InsuranceCarrier {
  id: string;
  tenantId: string;

  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  notes?: string;
}

/**
 * A single coverage line within a policy.
 */
export interface PolicyCoverage {
  id: string;
  policyId: string;

  coverageType: string;          // e.g. "bodily_injury", "property_damage"
  limitAmountCents: number;      // coverage limit in cents
  deductibleAmountCents?: number;
  perOccurrence?: boolean;       // per occurrence vs aggregate
  aggregateLimitCents?: number;  // aggregate limit if applicable

  notes?: string;
}

/**
 * An insurance policy held by the municipality.
 */
export interface InsurancePolicy {
  id: string;
  tenantId: string;

  policyType: InsurancePolicyType;
  policyNumber: string;
  carrierId: string;

  status: InsurancePolicyStatus;

  effectiveDate: Date;
  expirationDate: Date;

  premiumAmountCents: number;
  paymentFrequency?: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';

  // Fund from which premiums are paid
  fundId?: string;

  // Number of days before expiration to generate renewal reminder
  renewalNoticeDays: number;

  // Coverage details stored separately for flexibility
  coverages?: PolicyCoverage[];

  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * An official bond for an elected or appointed official.
 * Required for certain township officials (trustee, clerk) per IC 5-4-1.
 */
export interface OfficialBond {
  id: string;
  tenantId: string;

  bondType: OfficialBondType;
  officialName: string;
  officialTitle: string;

  status: OfficialBondStatus;

  bondNumber?: string;
  carrierId?: string;

  bondAmountCents: number;       // penal sum of the bond
  premiumAmountCents?: number;

  effectiveDate: Date;
  expirationDate: Date;

  // Number of days before expiration to generate renewal reminder
  renewalNoticeDays: number;

  // When the bond was filed with the county recorder (if required)
  filedWithCountyAt?: Date;
  countyRecordingReference?: string;

  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Summary view for insurance policies (list screens).
 */
export interface InsurancePolicySummary {
  id: string;
  tenantId: string;
  policyType: InsurancePolicyType;
  policyNumber: string;
  carrierName: string;
  status: InsurancePolicyStatus;
  effectiveDate: Date;
  expirationDate: Date;
  premiumAmountCents: number;
}

/**
 * Summary view for official bonds (list screens).
 */
export interface OfficialBondSummary {
  id: string;
  tenantId: string;
  bondType: OfficialBondType;
  officialName: string;
  officialTitle: string;
  status: OfficialBondStatus;
  bondAmountCents: number;
  effectiveDate: Date;
  expirationDate: Date;
}

/**
 * Upcoming renewal record for alerting.
 */
export interface UpcomingRenewal {
  type: 'policy' | 'bond';
  id: string;
  name: string;               // policy number or official name
  expirationDate: Date;
  daysUntilExpiration: number;
}
