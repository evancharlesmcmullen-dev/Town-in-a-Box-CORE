// src/core/compliance/compliance.types.ts

import { JurisdictionProfile } from '../tenancy/tenancy.types';

/**
 * A reusable definition of a compliance task (e.g. "Board of Finance meeting").
 */
export interface ComplianceTaskDefinition {
  id: string;
  tenantId: string;

  code: string;                 // e.g. "BOARD_OF_FINANCE", "TA_7_REPORT"
  name: string;                 // human-friendly
  description?: string;

  statutoryCitation?: string;   // e.g. "IC 5-13-7-6"
  // Later: we can add a structured recurrence model; for now, a hint string.
  recurrenceHint?: string;      // e.g. "annual in January"

  isActive: boolean;
}

/**
 * A concrete instance of a task for a specific period (e.g. 2026 Board of Finance meeting).
 */
export type ComplianceOccurrenceStatus =
  | 'pending'
  | 'completed'
  | 'overdue';

export interface ComplianceOccurrence {
  id: string;
  tenantId: string;

  definitionId: string;         // ComplianceTaskDefinition.id

  periodLabel: string;          // e.g. "2026", "2026-Q1"
  dueDate: Date;

  status: ComplianceOccurrenceStatus;
  completedAt?: Date;
  completedByUserId?: string;
  completionNotes?: string;

  // Optional: link to proof stored in Records (e.g. notice, report PDF).
  proofRecordId?: string;
}

/**
 * A view of how a tenant is doing overall on compliance.
 */
export interface ComplianceStatusSummary {
  tenantId: string;
  jurisdiction: JurisdictionProfile;

  totalOccurrences: number;
  completedOccurrences: number;
  overdueOccurrences: number;
  upcomingOccurrences: number;
}