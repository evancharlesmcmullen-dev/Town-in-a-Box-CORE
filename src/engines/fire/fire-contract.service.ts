// src/engines/fire/fire-contract.service.ts

import { TenantContext } from '../../core/tenancy/types';
import {
  FireServiceContract,
  FirePerformanceSnapshot,
} from './fire-contract.types';

/**
 * Input for creating/updating a fire service contract.
 */
export interface UpsertFireServiceContractInput {
  id?: string;                  // if present, update; if absent, create new
  providerName: string;
  coverageDescription: string;
  startDate: Date;
  endDate?: Date;
  annualCostCents: number;
  fundId: string;
  renewalNoticeDays: number;
  notes?: string;
  isActive: boolean;
}

/**
 * Filters for listing contracts.
 */
export interface FireContractFilter {
  isActive?: boolean;
  providerNameContains?: string;
}

/**
 * Service interface for Fire Contract Manager.
 *
 * Implementations will:
 * - Track contracts and their key metadata.
 * - Track basic performance snapshots (runs, response times, etc.).
 * - Cooperate with Compliance engine (for renewal reminders) and Finance
 *   (for fire fund budgeting).
 */
export interface FireContractService {
  //
  // CONTRACTS
  //

  listContracts(
    ctx: TenantContext,
    filter?: FireContractFilter
  ): Promise<FireServiceContract[]>;

  getContract(
    ctx: TenantContext,
    id: string
  ): Promise<FireServiceContract | null>;

  upsertContract(
    ctx: TenantContext,
    input: UpsertFireServiceContractInput
  ): Promise<FireServiceContract>;

  //
  // PERFORMANCE
  //

  listPerformanceSnapshots(
    ctx: TenantContext,
    contractId: string
  ): Promise<FirePerformanceSnapshot[]>;

  recordPerformanceSnapshot(
    ctx: TenantContext,
    snapshot: FirePerformanceSnapshot
  ): Promise<FirePerformanceSnapshot>;
}