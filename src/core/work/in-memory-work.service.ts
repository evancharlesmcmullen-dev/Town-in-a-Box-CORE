// src/core/work/in-memory-work.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import { WorkService } from './work.service';
import { ServiceRequest, WorkOrder, Crew, Route } from './work.types';

export interface InMemoryWorkSeedData {
  serviceRequests?: ServiceRequest[];
  workOrders?: WorkOrder[];
  crews?: Crew[];
  routes?: Route[];
}

/**
 * In-memory implementation of WorkService. Data is scoped per tenant and
 * persists only for the process lifetime.
 */
export class InMemoryWorkService implements WorkService {
  private serviceRequests: ServiceRequest[];
  private workOrders: WorkOrder[];
  private crews: Crew[];
  private routes: Route[];

  constructor(seed: InMemoryWorkSeedData = {}) {
    this.serviceRequests = seed.serviceRequests ? [...seed.serviceRequests] : [];
    this.workOrders = seed.workOrders ? [...seed.workOrders] : [];
    this.crews = seed.crews ? [...seed.crews] : [];
    this.routes = seed.routes ? [...seed.routes] : [];
  }

  async createServiceRequest(
    ctx: TenantContext,
    request: Omit<ServiceRequest, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<ServiceRequest> {
    const created: ServiceRequest = {
      ...request,
      id: randomUUID(),
      tenantId: ctx.tenantId,
      createdAt: new Date(),
      status: 'open',
    };

    this.serviceRequests.push(created);
    return created;
  }

  async listServiceRequests(
    ctx: TenantContext,
    filter: { status?: ServiceRequest['status']; category?: string } = {}
  ): Promise<ServiceRequest[]> {
    let results = this.serviceRequests.filter(
      (r) => r.tenantId === ctx.tenantId
    );

    if (filter.status) {
      results = results.filter((r) => r.status === filter.status);
    }

    if (filter.category) {
      results = results.filter((r) => r.category === filter.category);
    }

    return results;
  }

  async createWorkOrder(
    ctx: TenantContext,
    order: Omit<WorkOrder, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<WorkOrder> {
    const created: WorkOrder = {
      ...order,
      id: randomUUID(),
      tenantId: ctx.tenantId,
      createdAt: new Date(),
      status: 'open',
    };

    this.workOrders.push(created);
    return created;
  }

  async listWorkOrders(
    ctx: TenantContext,
    filter: { status?: WorkOrder['status']; assetId?: string } = {}
  ): Promise<WorkOrder[]> {
    let results = this.workOrders.filter((w) => w.tenantId === ctx.tenantId);

    if (filter.status) {
      results = results.filter((w) => w.status === filter.status);
    }

    if (filter.assetId) {
      results = results.filter((w) => w.assetId === filter.assetId);
    }

    return results;
  }

  async listCrews(ctx: TenantContext): Promise<Crew[]> {
    return this.crews.filter((c) => c.tenantId === ctx.tenantId);
  }

  async listRoutes(ctx: TenantContext): Promise<Route[]> {
    return this.routes.filter((r) => r.tenantId === ctx.tenantId);
  }
}
