// src/engines/legislation/legislation.types.ts

// Core types for ordinances, resolutions, and codified sections.

/**
 * Type of legislative item.
 */
export type LegislativeItemType = 'ordinance' | 'resolution';

/**
 * A single ordinance or resolution adopted by a governing body.
 */
export interface LegislativeItem {
  id: string;
  tenantId: string;

  type: LegislativeItemType;

  number?: string;              // e.g. "2025-01"
  title: string;
  summary?: string;

  body?: string;                // optional full text (for small items); large docs will live in Records

  adoptedAt?: Date;
  effectiveAt?: Date;

  // Links to meetings/records.
  adoptingMeetingId?: string;   // Meeting.id
  recordId?: string;            // Record.id pointing to signed PDF, etc.

  // For ordinances that amend the code.
  amendsCode?: boolean;
  codeReference?: string;       // e.g. "Chapter 5, Section 5.12.030"

  notes?: string;
}

/**
 * A codified section of the municipal/township code.
 * We are not writing a full codifier here — just enough for search & reference.
 */
export interface CodeSection {
  id: string;
  tenantId: string;

  citation: string;             // e.g. "5.12.030"
  title: string;
  text: string;

  // Optional linkage to the adopting/amending legislative items.
  lastAmendedByItemId?: string;
}

/**
 * Summary view for list/search.
 */
export interface LegislativeItemSummary {
  id: string;
  tenantId: string;
  type: LegislativeItemType;
  number?: string;
  title: string;
  adoptedAt?: Date;
}