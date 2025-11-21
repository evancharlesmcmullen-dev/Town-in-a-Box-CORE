// src/core/compliance/compliance.service.ts

import { TenantContext } from '../tenancy/types';
import {
  ComplianceTaskDefinition,
  ComplianceOccurrence,
  ComplianceStatusSummary,
} from './compliance.types';

/**
 * Input for creating/updating a compliance task definition.
 */
export interface UpsertComplianceTaskDefinitionInput {
  id?: string;                  // if present, update; if absent, create
  code: string;
  name: string;
  description?: string;
  statutoryCitation?: string;
  recurrenceHint?: string;
  isActive: boolean;
}

/**
 * Service interface for the Compliance engine.
 *
 * Implementations will:
 * - Manage reusable task definitions for a tenant.
 * - Manage concrete occurrences of those tasks per year/period.
 * - Integrate with other engines to seed tasks (e.g., INLegalEngine).
 */
export interface ComplianceService {
  //
  // TASK DEFINITIONS
  //

  listTaskDefinitions(
    ctx: TenantContext
  ): Promise<ComplianceTaskDefinition[]>;

  getTaskDefinition(
    ctx: TenantContext,
    id: string
  ): Promise<ComplianceTaskDefinition | null>;

  upsertTaskDefinition(
    ctx: TenantContext,
    input: UpsertComplianceTaskDefinitionInput
  ): Promise<ComplianceTaskDefinition>;

  //
  // OCCURRENCES
  //

  listOccurrences(
    ctx: TenantContext,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ComplianceOccurrence[]>;

  getOccurrence(
    ctx: TenantContext,
    id: string
  ): Promise<ComplianceOccurrence | null>;

  markOccurrenceCompleted(
    ctx: TenantContext,
    id: string,
    completionNotes?: string,
    proofRecordId?: string
  ): Promise<ComplianceOccurrence>;

  //
  // SUMMARY
  //

  getStatusSummary(
    ctx: TenantContext
  ): Promise<ComplianceStatusSummary>;
}