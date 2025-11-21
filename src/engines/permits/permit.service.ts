// src/engines/permits/permit.service.ts

import { TenantContext } from '../../core/tenancy/types';
import {
  PermitType,
  PermitApplication,
  PermitSummary,
  PermitStatus,
} from './permit.types';

/**
 * Input for creating a new permit application.
 */
export interface CreatePermitApplicationInput {
  permitTypeId: string;

  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;

  siteAddressLine1?: string;
  siteAddressLine2?: string;
  siteCity?: string;
  siteState?: string;
  sitePostalCode?: string;

  descriptionOfWork?: string;
}

/**
 * Filters for searching/listing permit applications.
 */
export interface PermitFilter {
  permitTypeId?: string;
  status?: PermitStatus;
  applicantNameContains?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Public service interface for the Permits engine.
 *
 * Implementations will:
 * - Manage permit types & applications.
 * - Call FeeService to compute fees.
 * - Link to Records for plans/attachments.
 * - Link to Meetings when approvals go to boards/commissions.
 */
export interface PermitService {
  //
  // PERMIT TYPES
  //

  listPermitTypes(ctx: TenantContext): Promise<PermitType[]>;

  getPermitType(
    ctx: TenantContext,
    id: string
  ): Promise<PermitType | null>;

  //
  // PERMIT APPLICATIONS
  //

  createApplication(
    ctx: TenantContext,
    input: CreatePermitApplicationInput
  ): Promise<PermitApplication>;

  getApplication(
    ctx: TenantContext,
    id: string
  ): Promise<PermitApplication | null>;

  listApplications(
    ctx: TenantContext,
    filter?: PermitFilter
  ): Promise<PermitSummary[]>;

  /**
   * Update the status of an application (approve, issue, deny, close, etc.).
   * Later we may make this more structured with explicit actions.
   */
  updateApplicationStatus(
    ctx: TenantContext,
    id: string,
    newStatus: PermitStatus
  ): Promise<PermitApplication>;
}