// src/engines/township-assistance/assistance.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  AssistanceProgramPolicy,
  AssistanceApplication,
  AssistanceCase,
  AssistanceCaseSummary,
  AssistanceCaseStatus,
  AssistanceBenefit,
} from './assistance.types';

//
// INPUT TYPES
//

export interface CreateAssistanceApplicationInput {
  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  household: {
    name: string;
    age?: number;
    relationship?: string;
  }[];

  monthlyIncomeCents?: number;
  monthlyExpensesCents?: number;

  requestedBenefitTypes: string[];   // we’ll validate to AssistanceBenefitType in impl
  requestedAmountCents?: number;
}

export interface AssistanceCaseFilter {
  status?: AssistanceCaseStatus;
  applicantNameContains?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface CreateAssistanceBenefitInput {
  caseId: string;
  type: string;                      // validated to AssistanceBenefitType in impl
  amountCents: number;
  payeeName: string;
  payeeAddressLine1?: string;
  payeeAddressLine2?: string;
  payeeCity?: string;
  payeeState?: string;
  payeePostalCode?: string;
}

//
// SERVICE INTERFACE
//

/**
 * Public service interface for the Township Assistance engine.
 *
 * Implementations will:
 * - Manage applications, cases, and benefit payments.
 * - Integrate with Records (documentation) and Finance (payments).
 * - Be driven by INLegalEngine for program rules and state compliance.
 */
export interface TownshipAssistanceService {
  //
  // PROGRAM POLICY
  //

  listProgramPolicies(ctx: TenantContext): Promise<AssistanceProgramPolicy[]>;

  getProgramPolicy(
    ctx: TenantContext,
    id: string
  ): Promise<AssistanceProgramPolicy | null>;

  //
  // APPLICATIONS
  //

  createApplication(
    ctx: TenantContext,
    input: CreateAssistanceApplicationInput
  ): Promise<AssistanceApplication>;

  getApplication(
    ctx: TenantContext,
    id: string
  ): Promise<AssistanceApplication | null>;

  //
  // CASES
  //

  createCaseForApplication(
    ctx: TenantContext,
    applicationId: string,
    programPolicyId?: string
  ): Promise<AssistanceCase>;

  getCase(
    ctx: TenantContext,
    id: string
  ): Promise<AssistanceCase | null>;

  listCases(
    ctx: TenantContext,
    filter?: AssistanceCaseFilter
  ): Promise<AssistanceCaseSummary[]>;

  updateCaseStatus(
    ctx: TenantContext,
    id: string,
    newStatus: AssistanceCaseStatus
  ): Promise<AssistanceCase>;

  //
  // BENEFITS
  //

  createBenefit(
    ctx: TenantContext,
    input: CreateAssistanceBenefitInput
  ): Promise<AssistanceBenefit>;

  listBenefitsForCase(
    ctx: TenantContext,
    caseId: string
  ): Promise<AssistanceBenefit[]>;
}