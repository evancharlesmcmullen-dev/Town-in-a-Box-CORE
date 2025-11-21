// src/core/cases/case.types.ts

/**
 * Generic case wrapper for things like APRA, Planning, Code, Assistance, etc.
 * Domain engines can use their own types but we have this to enable generic dashboards.
 */
export interface CaseSummary {
  id: string;
  tenantId: string;

  caseType: string;        // e.g. "APRA", "ASSISTANCE", "CODE"
  title: string;
  status: string;

  openedAt: Date;
  closedAt?: Date;
}