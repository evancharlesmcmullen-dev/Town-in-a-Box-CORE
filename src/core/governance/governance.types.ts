// src/core/governance/governance.types.ts

/**
 * An office like "Township Trustee", "Town Council Member".
 */
export interface Office {
  id: string;
  tenantId: string;

  name: string;
  code?: string;              // e.g. "TRUSTEE", "BOARD_MEMBER"
  description?: string;
}

/**
 * A governing body, e.g. Township Board, Board of Finance, BZA.
 */
export interface GoverningBody {
  id: string;
  tenantId: string;

  name: string;
  code?: string;
  description?: string;
}

/**
 * A person filling an office (or employee generally).
 */
export interface Person {
  id: string;
  tenantId: string;

  name: string;
  email?: string;
  phone?: string;
}

/**
 * An appointment/term of office.
 */
export interface TermOfOffice {
  id: string;
  tenantId: string;

  officeId: string;
  personId: string;

  startDate: Date;
  endDate?: Date;
}

/**
 * A simple funding split for positions (future HR/finance integration).
 */
export interface PositionFunding {
  id: string;
  tenantId: string;

  personId: string;
  fiscalEntityId: string;
  fundId?: string;

  percent: number;    // 0–100
}