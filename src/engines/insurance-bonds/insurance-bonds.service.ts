// src/engines/insurance-bonds/insurance-bonds.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  InsuranceCarrier,
  InsurancePolicy,
  InsurancePolicySummary,
  InsurancePolicyStatus,
  InsurancePolicyType,
  PolicyCoverage,
  OfficialBond,
  OfficialBondSummary,
  OfficialBondStatus,
  OfficialBondType,
  UpcomingRenewal,
} from './insurance-bonds.types';

//
// INPUT TYPES
//

export interface CreateInsuranceCarrierInput {
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

export interface UpdateInsuranceCarrierInput {
  name?: string;
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

export interface CreateInsurancePolicyInput {
  policyType: InsurancePolicyType;
  policyNumber: string;
  carrierId: string;
  effectiveDate: Date;
  expirationDate: Date;
  premiumAmountCents: number;
  paymentFrequency?: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  fundId?: string;
  renewalNoticeDays?: number;
  notes?: string;
}

export interface UpdateInsurancePolicyInput {
  policyType?: InsurancePolicyType;
  policyNumber?: string;
  carrierId?: string;
  status?: InsurancePolicyStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
  premiumAmountCents?: number;
  paymentFrequency?: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  fundId?: string;
  renewalNoticeDays?: number;
  notes?: string;
}

export interface CreatePolicyCoverageInput {
  policyId: string;
  coverageType: string;
  limitAmountCents: number;
  deductibleAmountCents?: number;
  perOccurrence?: boolean;
  aggregateLimitCents?: number;
  notes?: string;
}

export interface CreateOfficialBondInput {
  bondType: OfficialBondType;
  officialName: string;
  officialTitle: string;
  bondNumber?: string;
  carrierId?: string;
  bondAmountCents: number;
  premiumAmountCents?: number;
  effectiveDate: Date;
  expirationDate: Date;
  renewalNoticeDays?: number;
  notes?: string;
}

export interface UpdateOfficialBondInput {
  bondType?: OfficialBondType;
  officialName?: string;
  officialTitle?: string;
  status?: OfficialBondStatus;
  bondNumber?: string;
  carrierId?: string;
  bondAmountCents?: number;
  premiumAmountCents?: number;
  effectiveDate?: Date;
  expirationDate?: Date;
  renewalNoticeDays?: number;
  filedWithCountyAt?: Date;
  countyRecordingReference?: string;
  notes?: string;
}

//
// FILTER TYPES
//

export interface InsurancePolicyFilter {
  policyType?: InsurancePolicyType;
  status?: InsurancePolicyStatus;
  carrierId?: string;
  expiringWithinDays?: number;
}

export interface OfficialBondFilter {
  bondType?: OfficialBondType;
  status?: OfficialBondStatus;
  officialNameContains?: string;
  expiringWithinDays?: number;
}

//
// SERVICE INTERFACE
//

/**
 * Public service interface for the Insurance & Bonds engine.
 *
 * Implementations will:
 * - Track insurance policies and their coverage details.
 * - Track official bonds for elected/appointed officials.
 * - Generate renewal reminders.
 * - Link to Finance for premium payments.
 *
 * This engine is generic enough for towns, cities, and townships,
 * but is designed with township bond requirements in mind.
 */
export interface InsuranceBondsService {
  //
  // CARRIERS
  //

  listCarriers(ctx: TenantContext): Promise<InsuranceCarrier[]>;

  getCarrier(
    ctx: TenantContext,
    id: string
  ): Promise<InsuranceCarrier | null>;

  createCarrier(
    ctx: TenantContext,
    input: CreateInsuranceCarrierInput
  ): Promise<InsuranceCarrier>;

  updateCarrier(
    ctx: TenantContext,
    id: string,
    input: UpdateInsuranceCarrierInput
  ): Promise<InsuranceCarrier>;

  //
  // POLICIES
  //

  listPolicies(
    ctx: TenantContext,
    filter?: InsurancePolicyFilter
  ): Promise<InsurancePolicySummary[]>;

  getPolicy(
    ctx: TenantContext,
    id: string
  ): Promise<InsurancePolicy | null>;

  createPolicy(
    ctx: TenantContext,
    input: CreateInsurancePolicyInput
  ): Promise<InsurancePolicy>;

  updatePolicy(
    ctx: TenantContext,
    id: string,
    input: UpdateInsurancePolicyInput
  ): Promise<InsurancePolicy>;

  /**
   * Mark a policy as renewed, creating a new policy record for the next term.
   * The old policy is marked as expired.
   */
  renewPolicy(
    ctx: TenantContext,
    policyId: string,
    newExpirationDate: Date,
    newPremiumAmountCents?: number
  ): Promise<InsurancePolicy>;

  //
  // POLICY COVERAGES
  //

  listCoveragesForPolicy(
    ctx: TenantContext,
    policyId: string
  ): Promise<PolicyCoverage[]>;

  addCoverage(
    ctx: TenantContext,
    input: CreatePolicyCoverageInput
  ): Promise<PolicyCoverage>;

  removeCoverage(
    ctx: TenantContext,
    coverageId: string
  ): Promise<void>;

  //
  // OFFICIAL BONDS
  //

  listBonds(
    ctx: TenantContext,
    filter?: OfficialBondFilter
  ): Promise<OfficialBondSummary[]>;

  getBond(
    ctx: TenantContext,
    id: string
  ): Promise<OfficialBond | null>;

  createBond(
    ctx: TenantContext,
    input: CreateOfficialBondInput
  ): Promise<OfficialBond>;

  updateBond(
    ctx: TenantContext,
    id: string,
    input: UpdateOfficialBondInput
  ): Promise<OfficialBond>;

  /**
   * Record that a bond has been filed with the county recorder.
   */
  recordBondFiling(
    ctx: TenantContext,
    bondId: string,
    filedAt: Date,
    recordingReference?: string
  ): Promise<OfficialBond>;

  /**
   * Mark a bond as renewed, creating a new bond record for the next term.
   * The old bond is marked as expired.
   */
  renewBond(
    ctx: TenantContext,
    bondId: string,
    newExpirationDate: Date,
    newPremiumAmountCents?: number
  ): Promise<OfficialBond>;

  //
  // RENEWAL TRACKING
  //

  /**
   * Get all upcoming renewals (policies and bonds) within a given number of days.
   * Useful for dashboard alerts and compliance tracking.
   */
  getUpcomingRenewals(
    ctx: TenantContext,
    withinDays: number
  ): Promise<UpcomingRenewal[]>;
}
