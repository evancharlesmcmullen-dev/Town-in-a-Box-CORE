// src/engines/records/in-memory-apra.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  ApraRequest,
  ApraRequestSummary,
} from './apra.types';
import {
  ApraService,
  CreateApraRequestInput,
  ApraRequestFilter,
} from './apra.service';

/**
 * Very simple in-memory implementation of ApraService.
 * This is only for development/testing; it does NOT persist across restarts.
 */
export class InMemoryApraService implements ApraService {
  private requests: ApraRequest[] = [];

  async createRequest(
    ctx: TenantContext,
    input: CreateApraRequestInput
  ): Promise<ApraRequest> {
    const now = new Date();

    const request: ApraRequest = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      receivedAt: now,
      requester: {
        name: input.requesterName,
        email: input.requesterEmail,
        phone: input.requesterPhone,
        mailingAddressLine1: input.mailingAddressLine1,
        mailingAddressLine2: input.mailingAddressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
      },
      requestText: input.requestText,
      status: 'received',
    };

    this.requests.push(request);
    return request;
  }

  async getRequest(
    ctx: TenantContext,
    id: string
  ): Promise<ApraRequest | null> {
    return (
      this.requests.find(
        (r) => r.id === id && r.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listRequests(
    ctx: TenantContext,
    filter?: ApraRequestFilter
  ): Promise<ApraRequestSummary[]> {
    let results = this.requests.filter(
      (r) => r.tenantId === ctx.tenantId
    );

    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status);
    }

    if (filter?.fromDate) {
      results = results.filter((r) => r.receivedAt >= filter.fromDate!);
    }

    if (filter?.toDate) {
      results = results.filter((r) => r.receivedAt <= filter.toDate!);
    }

    if (filter?.searchText) {
      const q = filter.searchText.toLowerCase();
      results = results.filter(
        (r) =>
          r.requestText.toLowerCase().includes(q) ||
          r.requester.name.toLowerCase().includes(q)
      );
    }

    // Map to summaries
    return results.map<ApraRequestSummary>((r) => ({
      id: r.id,
      receivedAt: r.receivedAt,
      requesterName: r.requester.name,
      status: r.status,
      dueDate: r.dueDate,
    }));
  }
}