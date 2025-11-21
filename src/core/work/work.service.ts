// src/core/work/work.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { ServiceRequest, WorkOrder, Crew, Route } from './work.types';

export interface WorkService {
  //
  // SERVICE REQUESTS
  //

  createServiceRequest(
    ctx: TenantContext,
    request: Omit<ServiceRequest, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<ServiceRequest>;

  listServiceRequests(
    ctx: TenantContext,
    filter?: { status?: ServiceRequest['status']; category?: string }
  ): Promise<ServiceRequest[]>;

  //
  // WORK ORDERS
  //

  createWorkOrder(
    ctx: TenantContext,
    order: Omit<WorkOrder, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<WorkOrder>;

  listWorkOrders(
    ctx: TenantContext,
    filter?: { status?: WorkOrder['status']; assetId?: string }
  ): Promise<WorkOrder[]>;

  //
  // CREWS AND ROUTES (read-only for now)
  //

  listCrews(ctx: TenantContext): Promise<Crew[]>;
  listRoutes(ctx: TenantContext): Promise<Route[]>;
}