// src/engines/cemeteries/cemetery.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  Cemetery,
  CemeteryMaintenanceLog,
  CemeteryPlot,
  BurialRecord,
} from './cemetery.types';

export interface CemeteryFilter {
  status?: Cemetery['status'];
  nameContains?: string;
}

/**
 * Service interface for the Cemetery Registry.
 *
 * Implementations will:
 * - Track cemeteries (inventory),
 * - Track maintenance logs,
 * - Track plots and burials,
 * - Tie into Records/APRA for deed maps and public lookup.
 */
export interface CemeteryService {
  //
  // CEMETERIES
  //

  listCemeteries(
    ctx: TenantContext,
    filter?: CemeteryFilter
  ): Promise<Cemetery[]>;

  getCemetery(
    ctx: TenantContext,
    id: string
  ): Promise<Cemetery | null>;

  upsertCemetery(
    ctx: TenantContext,
    cemetery: Cemetery
  ): Promise<Cemetery>;

  //
  // MAINTENANCE
  //

  addMaintenanceLog(
    ctx: TenantContext,
    log: CemeteryMaintenanceLog
  ): Promise<CemeteryMaintenanceLog>;

  listMaintenanceLogsForCemetery(
    ctx: TenantContext,
    cemeteryId: string
  ): Promise<CemeteryMaintenanceLog[]>;

  //
  // PLOTS & BURIALS
  //

  listPlotsForCemetery(
    ctx: TenantContext,
    cemeteryId: string
  ): Promise<CemeteryPlot[]>;

  upsertPlot(
    ctx: TenantContext,
    plot: CemeteryPlot
  ): Promise<CemeteryPlot>;

  listBurialsForPlot(
    ctx: TenantContext,
    plotId: string
  ): Promise<BurialRecord[]>;

  upsertBurial(
    ctx: TenantContext,
    burial: BurialRecord
  ): Promise<BurialRecord>;

  /**
   * Search burials by decedent name (for genealogists, families).
   */
  searchBurialsByName(
    ctx: TenantContext,
    nameQuery: string
  ): Promise<BurialRecord[]>;
}