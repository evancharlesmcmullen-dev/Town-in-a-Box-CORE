// src/engines/cemeteries/in-memory-cemetery.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/types';
import {
  Cemetery,
  CemeteryMaintenanceLog,
  CemeteryPlot,
  BurialRecord,
} from './cemetery.types';
import {
  CemeteryService,
  CemeteryFilter,
} from './cemetery.service';

export interface InMemoryCemeterySeedData {
  cemeteries?: Cemetery[];
  maintenanceLogs?: CemeteryMaintenanceLog[];
  plots?: CemeteryPlot[];
  burials?: BurialRecord[];
}

/**
 * In-memory implementation of CemeteryService for demos/tests.
 * Data is scoped per tenant and lasts only for the process lifetime.
 */
export class InMemoryCemeteryService implements CemeteryService {
  private cemeteries: Cemetery[];
  private maintenanceLogs: CemeteryMaintenanceLog[];
  private plots: CemeteryPlot[];
  private burials: BurialRecord[];

  constructor(seed: InMemoryCemeterySeedData = {}) {
    this.cemeteries = seed.cemeteries ? [...seed.cemeteries] : [];
    this.maintenanceLogs = seed.maintenanceLogs ? [...seed.maintenanceLogs] : [];
    this.plots = seed.plots ? [...seed.plots] : [];
    this.burials = seed.burials ? [...seed.burials] : [];
  }

  //
  // CEMETERIES
  //

  async listCemeteries(
    ctx: TenantContext,
    filter?: CemeteryFilter
  ): Promise<Cemetery[]> {
    let results = this.cemeteries.filter(
      (c) => c.tenantId === ctx.tenantId
    );

    if (filter?.status) {
      results = results.filter((c) => c.status === filter.status);
    }

    if (filter?.nameContains) {
      const q = filter.nameContains.toLowerCase();
      results = results.filter((c) =>
        c.name.toLowerCase().includes(q)
      );
    }

    return results;
  }

  async getCemetery(
    ctx: TenantContext,
    id: string
  ): Promise<Cemetery | null> {
    return (
      this.cemeteries.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async upsertCemetery(
    ctx: TenantContext,
    cemetery: Cemetery
  ): Promise<Cemetery> {
    const idx = this.cemeteries.findIndex(
      (c) => c.id === cemetery.id && c.tenantId === ctx.tenantId
    );

    if (idx >= 0) {
      const updated: Cemetery = {
        ...cemetery,
        tenantId: ctx.tenantId,
      };
      this.cemeteries[idx] = updated;
      return updated;
    }

    const created: Cemetery = {
      ...cemetery,
      id: cemetery.id || randomUUID(),
      tenantId: ctx.tenantId,
    };

    this.cemeteries.push(created);
    return created;
  }

  //
  // MAINTENANCE
  //

  async addMaintenanceLog(
    ctx: TenantContext,
    log: CemeteryMaintenanceLog
  ): Promise<CemeteryMaintenanceLog> {
    const entry: CemeteryMaintenanceLog = {
      ...log,
      id: log.id || randomUUID(),
      tenantId: ctx.tenantId,
    };

    this.maintenanceLogs.push(entry);
    return entry;
  }

  async listMaintenanceLogsForCemetery(
    ctx: TenantContext,
    cemeteryId: string
  ): Promise<CemeteryMaintenanceLog[]> {
    return this.maintenanceLogs.filter(
      (l) => l.tenantId === ctx.tenantId && l.cemeteryId === cemeteryId
    );
  }

  //
  // PLOTS & BURIALS
  //

  async listPlotsForCemetery(
    ctx: TenantContext,
    cemeteryId: string
  ): Promise<CemeteryPlot[]> {
    return this.plots.filter(
      (p) => p.tenantId === ctx.tenantId && p.cemeteryId === cemeteryId
    );
  }

  async upsertPlot(
    ctx: TenantContext,
    plot: CemeteryPlot
  ): Promise<CemeteryPlot> {
    const idx = this.plots.findIndex(
      (p) => p.id === plot.id && p.tenantId === ctx.tenantId
    );

    if (idx >= 0) {
      const updated: CemeteryPlot = {
        ...plot,
        tenantId: ctx.tenantId,
      };
      this.plots[idx] = updated;
      return updated;
    }

    const created: CemeteryPlot = {
      ...plot,
      id: plot.id || randomUUID(),
      tenantId: ctx.tenantId,
    };

    this.plots.push(created);
    return created;
  }

  async listBurialsForPlot(
    ctx: TenantContext,
    plotId: string
  ): Promise<BurialRecord[]> {
    return this.burials.filter(
      (b) => b.tenantId === ctx.tenantId && b.plotId === plotId
    );
  }

  async upsertBurial(
    ctx: TenantContext,
    burial: BurialRecord
  ): Promise<BurialRecord> {
    const idx = this.burials.findIndex(
      (b) => b.id === burial.id && b.tenantId === ctx.tenantId
    );

    if (idx >= 0) {
      const updated: BurialRecord = {
        ...burial,
        tenantId: ctx.tenantId,
      };
      this.burials[idx] = updated;
      return updated;
    }

    const created: BurialRecord = {
      ...burial,
      id: burial.id || randomUUID(),
      tenantId: ctx.tenantId,
    };

    this.burials.push(created);
    return created;
  }

  async searchBurialsByName(
    ctx: TenantContext,
    nameQuery: string
  ): Promise<BurialRecord[]> {
    const q = nameQuery.toLowerCase();
    return this.burials.filter(
      (b) =>
        b.tenantId === ctx.tenantId &&
        b.decedentName.toLowerCase().includes(q)
    );
  }
}
