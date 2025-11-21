// src/engines/code-enforcement/code-enforcement.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  CodeViolationType,
  CodeCase,
  CodeCaseSummary,
  CodeCaseStatus,
} from './code.types';

/**
 * Input for opening a new code enforcement case.
 */
export interface CreateCodeCaseInput {
  violationTypeId: string;

  respondentName?: string;
  respondentAddressLine1?: string;
  respondentAddressLine2?: string;
  respondentCity?: string;
  respondentState?: string;
  respondentPostalCode?: string;

  siteAddressLine1?: string;
  siteAddressLine2?: string;
  siteCity?: string;
  siteState?: string;
  sitePostalCode?: string;
}

/**
 * Filters for searching/listing code cases.
 */
export interface CodeCaseFilter {
  violationTypeId?: string;
  status?: CodeCaseStatus;
  respondentNameContains?: string;
  siteAddressContains?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Public service interface for the Code Enforcement engine.
 *
 * Implementations will:
 * - Manage violation types and cases.
 * - Use the Notice engine to generate/post door hangers and letters.
 * - Call FeeService for fines/fees when applicable.
 * - Link to Meetings when cases go to a hearing body.
 */
export interface CodeEnforcementService {
  //
  // VIOLATION TYPES
  //

  listViolationTypes(ctx: TenantContext): Promise<CodeViolationType[]>;

  getViolationType(
    ctx: TenantContext,
    id: string
  ): Promise<CodeViolationType | null>;

  //
  // CASES
  //

  createCase(
    ctx: TenantContext,
    input: CreateCodeCaseInput
  ): Promise<CodeCase>;

  getCase(
    ctx: TenantContext,
    id: string
  ): Promise<CodeCase | null>;

  listCases(
    ctx: TenantContext,
    filter?: CodeCaseFilter
  ): Promise<CodeCaseSummary[]>;

  /**
   * Update the status of a code case (e.g., send notice, mark complied, refer).
   * We keep this simple for now; later we may introduce explicit actions.
   */
  updateCaseStatus(
    ctx: TenantContext,
    id: string,
    newStatus: CodeCaseStatus
  ): Promise<CodeCase>;
}