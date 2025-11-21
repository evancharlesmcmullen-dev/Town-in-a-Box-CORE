// src/engines/fire/fire-contract.types.ts

// Types for managing fire protection contracts and performance oversight.

/**
 * A fire protection contract or interlocal agreement.
 */
export interface FireServiceContract {
  id: string;
  tenantId: string;

  providerName: string;            // e.g. "Lapel Volunteer Fire Department"
  coverageDescription: string;     // e.g. "Entire township except Town of X"
  startDate: Date;
  endDate?: Date;                  // optional for open-ended contracts

  annualCostCents: number;
  fundId: string;                  // Finance/Fund id paying for the contract

  renewalNoticeDays: number;       // how many days before endDate we want to be alerted

  notes?: string;

  isActive: boolean;
}

/**
 * A performance snapshot for a fire service contract (e.g. runs & response times).
 */
export interface FirePerformanceSnapshot {
  id: string;
  tenantId: string;

  contractId: string;
  periodStart: Date;
  periodEnd: Date;

  runs: number;                    // number of runs in period
  averageResponseMinutes?: number;
  notes?: string;
}