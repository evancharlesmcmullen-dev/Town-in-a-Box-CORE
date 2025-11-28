// src/engines/records/in-memory-apra.service.ts
//
// In-memory implementation of ApraService for testing and development.
// Mirrors the structure of InMemoryMeetingsService.

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  ApraRequest,
  ApraRequestSummary,
  ApraRequestStatus,
  ApraRequestScope,
  ApraClarification,
  ApraExemptionCitation,
  ApraFulfillment,
  ApraStatusHistoryEntry,
} from './apra.types';
import {
  ApraService,
  CreateApraRequestInput,
  ApraRequestFilter,
  AddExemptionInput,
  RecordFulfillmentInput,
} from './apra.service';
import {
  computeApraDeadline,
  getIndianaStateHolidays,
} from '../../core/calendar/open-door.calendar';

// =============================================================================
// APRA Workflow Integration (v1)
// =============================================================================
//
// The following imports provide access to the APRA workflow state machine.
// These can be used to manage request workflows with proper status validation
// and deadline tracking.
//
// TODO: In a future version, integrate workflow context into the service:
// 1. Store ApraRequestWorkflowContext alongside each request
// 2. Use transitionApraStatus() to validate status changes
// 3. Use resetApraDeadline() when clarification is received
// 4. Persist workflow context to database
//
// For now, the existing status tracking remains unchanged to avoid breaking
// the current API. The workflow types/services are available for use in
// new features or gradual migration.
//
import {
  ApraRequestWorkflowContext,
  ApraRequestStatus as WorkflowStatus,
} from '../../core/records/apra-workflow.types';
import {
  initializeApraWorkflow,
  transitionApraStatus,
  isValidTransition,
  getValidNextStatuses,
} from '../../core/records/apra-workflow.service';
import { calculateApraDeadlines } from '../../core/records/apra-deadlines.service';

/**
 * Seed data for initializing the in-memory service.
 */
export interface InMemoryApraSeedData {
  requests?: ApraRequest[];
  scopes?: ApraRequestScope[];
  statusHistory?: ApraStatusHistoryEntry[];
  clarifications?: ApraClarification[];
  exemptions?: ApraExemptionCitation[];
  fulfillments?: ApraFulfillment[];
}

/**
 * In-memory ApraService implementation for tests and demos.
 *
 * Data is scoped per tenant and stored only for the lifetime of the process.
 * This implementation:
 * - Computes 7 business-day statutory deadline using Indiana calendar
 * - Tracks all status changes with history entries
 * - Manages clarifications, exemptions, and fulfillments
 */
export class InMemoryApraService implements ApraService {
  private requests: ApraRequest[];
  private scopes: ApraRequestScope[];
  private statusHistory: ApraStatusHistoryEntry[];
  private clarifications: ApraClarification[];
  private exemptions: ApraExemptionCitation[];
  private fulfillments: ApraFulfillment[];

  constructor(seed: InMemoryApraSeedData = {}) {
    this.requests = seed.requests ? [...seed.requests] : [];
    this.scopes = seed.scopes ? [...seed.scopes] : [];
    this.statusHistory = seed.statusHistory ? [...seed.statusHistory] : [];
    this.clarifications = seed.clarifications ? [...seed.clarifications] : [];
    this.exemptions = seed.exemptions ? [...seed.exemptions] : [];
    this.fulfillments = seed.fulfillments ? [...seed.fulfillments] : [];
  }

  /**
   * Create a new APRA request with computed statutory deadline.
   */
  async createRequest(
    ctx: TenantContext,
    input: CreateApraRequestInput
  ): Promise<ApraRequest> {
    const now = new Date();
    const nowIso = now.toISOString();
    const requestId = randomUUID();

    // Compute the 7 business-day statutory deadline
    const receivedYear = now.getFullYear();
    const holidays = getIndianaStateHolidays(receivedYear);
    // Include next year's holidays in case deadline spans year boundary
    if (now.getMonth() >= 10) {
      holidays.push(...getIndianaStateHolidays(receivedYear + 1));
    }
    const deadline = computeApraDeadline(now, { holidays });

    const request: ApraRequest = {
      id: requestId,
      tenantId: ctx.tenantId,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      description: input.description,
      reasonablyParticular: true, // Assume particular unless clarification needed
      receivedAt: nowIso,
      statutoryDeadlineAt: deadline.toISOString(),
      status: 'RECEIVED',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.requests.push(request);

    // Create initial status history entry
    const historyEntry: ApraStatusHistoryEntry = {
      id: randomUUID(),
      requestId,
      newStatus: 'RECEIVED',
      changedAt: nowIso,
      changedByUserId: ctx.userId,
      note: 'Request received',
    };
    this.statusHistory.push(historyEntry);

    // Create scopes if provided
    if (input.scopes && input.scopes.length > 0) {
      for (const scopeInput of input.scopes) {
        const scope: ApraRequestScope = {
          id: randomUUID(),
          requestId,
          recordType: scopeInput.recordType,
          dateRangeStart: scopeInput.dateRangeStart,
          dateRangeEnd: scopeInput.dateRangeEnd,
          custodians: scopeInput.custodians,
          keywords: scopeInput.keywords,
        };
        this.scopes.push(scope);
      }
    }

    return request;
  }

  /**
   * Fetch a single APRA request by ID, scoped to tenant.
   */
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

  /**
   * List APRA requests with optional filtering.
   */
  async listRequests(
    ctx: TenantContext,
    filter?: ApraRequestFilter
  ): Promise<ApraRequestSummary[]> {
    let results = this.requests.filter(
      (r) => r.tenantId === ctx.tenantId
    );

    if (filter?.status && filter.status.length > 0) {
      results = results.filter((r) => filter.status!.includes(r.status));
    }

    if (filter?.fromDate) {
      const fromIso = filter.fromDate.toISOString();
      results = results.filter((r) => r.receivedAt >= fromIso);
    }

    if (filter?.toDate) {
      const toIso = filter.toDate.toISOString();
      results = results.filter((r) => r.receivedAt <= toIso);
    }

    if (filter?.searchText) {
      const q = filter.searchText.toLowerCase();
      results = results.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q)
      );
    }

    // Map to summaries
    return results.map<ApraRequestSummary>((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      receivedAt: r.receivedAt,
      requesterName: r.requesterName,
      status: r.status,
      statutoryDeadlineAt: r.statutoryDeadlineAt,
    }));
  }

  /**
   * Add a clarification request and update status.
   */
  async addClarification(
    ctx: TenantContext,
    requestId: string,
    messageToRequester: string
  ): Promise<ApraClarification> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const clarification: ApraClarification = {
      id: randomUUID(),
      requestId,
      sentAt: nowIso,
      messageToRequester,
    };

    this.clarifications.push(clarification);

    // Update request status to NEEDS_CLARIFICATION
    const oldStatus = request.status;
    request.status = 'NEEDS_CLARIFICATION';
    request.reasonablyParticular = false;
    request.particularityReason = 'Clarification requested from requester';
    request.updatedAt = nowIso;

    // Add status history entry
    const historyEntry: ApraStatusHistoryEntry = {
      id: randomUUID(),
      requestId,
      oldStatus,
      newStatus: 'NEEDS_CLARIFICATION',
      changedAt: nowIso,
      changedByUserId: ctx.userId,
      note: 'Clarification requested',
    };
    this.statusHistory.push(historyEntry);

    return clarification;
  }

  /**
   * Record a clarification response and optionally update status.
   */
  async recordClarificationResponse(
    ctx: TenantContext,
    clarificationId: string,
    requesterResponse: string
  ): Promise<ApraClarification> {
    const clarification = this.clarifications.find(
      (c) => c.id === clarificationId
    );

    if (!clarification) {
      throw new Error('Clarification not found');
    }

    const request = this.requests.find(
      (r) => r.id === clarification.requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Update clarification
    clarification.respondedAt = nowIso;
    clarification.requesterResponse = requesterResponse;

    // Recompute the statutory deadline from the response date
    const receivedYear = now.getFullYear();
    const holidays = getIndianaStateHolidays(receivedYear);
    if (now.getMonth() >= 10) {
      holidays.push(...getIndianaStateHolidays(receivedYear + 1));
    }
    const newDeadline = computeApraDeadline(now, { holidays });

    // Update request
    const oldStatus = request.status;
    request.status = 'IN_REVIEW';
    request.reasonablyParticular = true;
    request.particularityReason = 'Request clarified by requester';
    request.statutoryDeadlineAt = newDeadline.toISOString();
    request.updatedAt = nowIso;

    // Add status history entry
    const historyEntry: ApraStatusHistoryEntry = {
      id: randomUUID(),
      requestId: request.id,
      oldStatus,
      newStatus: 'IN_REVIEW',
      changedAt: nowIso,
      changedByUserId: ctx.userId,
      note: 'Clarification received, deadline reset',
    };
    this.statusHistory.push(historyEntry);

    return clarification;
  }

  /**
   * Update the status of an APRA request.
   */
  async updateStatus(
    ctx: TenantContext,
    requestId: string,
    newStatus: ApraRequestStatus,
    note?: string
  ): Promise<ApraRequest> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const oldStatus = request.status;

    // Validate status transition (basic validation)
    if (oldStatus === newStatus) {
      // No-op, return as-is
      return request;
    }

    // Update request
    request.status = newStatus;
    request.updatedAt = nowIso;

    // Add status history entry
    const historyEntry: ApraStatusHistoryEntry = {
      id: randomUUID(),
      requestId,
      oldStatus,
      newStatus,
      changedAt: nowIso,
      changedByUserId: ctx.userId,
      note,
    };
    this.statusHistory.push(historyEntry);

    return request;
  }

  /**
   * Add an exemption citation for withholding records.
   */
  async addExemption(
    ctx: TenantContext,
    requestId: string,
    input: AddExemptionInput
  ): Promise<ApraExemptionCitation> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const exemption: ApraExemptionCitation = {
      id: randomUUID(),
      requestId,
      citation: input.citation,
      description: input.description,
      appliesToScopeId: input.appliesToScopeId,
      createdAt: nowIso,
    };

    this.exemptions.push(exemption);
    request.updatedAt = nowIso;

    return exemption;
  }

  /**
   * Record fulfillment/delivery of records.
   */
  async recordFulfillment(
    ctx: TenantContext,
    requestId: string,
    input: RecordFulfillmentInput
  ): Promise<ApraFulfillment> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const fulfillment: ApraFulfillment = {
      id: randomUUID(),
      requestId,
      fulfilledAt: nowIso,
      deliveryMethod: input.deliveryMethod,
      notes: input.notes,
      totalFeesCents: input.totalFeesCents,
    };

    this.fulfillments.push(fulfillment);
    request.updatedAt = nowIso;

    return fulfillment;
  }

  /**
   * Get the status history for a request.
   */
  async getStatusHistory(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraStatusHistoryEntry[]> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    return this.statusHistory
      .filter((h) => h.requestId === requestId)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }

  /**
   * Get scopes associated with a request.
   */
  async getScopes(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraRequestScope[]> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    return this.scopes.filter((s) => s.requestId === requestId);
  }

  /**
   * Get clarifications for a request.
   */
  async getClarifications(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraClarification[]> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    return this.clarifications.filter((c) => c.requestId === requestId);
  }

  /**
   * Get exemptions cited for a request.
   */
  async getExemptions(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraExemptionCitation[]> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    return this.exemptions.filter((e) => e.requestId === requestId);
  }

  /**
   * Get fulfillments for a request.
   */
  async getFulfillments(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraFulfillment[]> {
    const request = this.requests.find(
      (r) => r.id === requestId && r.tenantId === ctx.tenantId
    );

    if (!request) {
      throw new Error('APRA request not found for tenant');
    }

    return this.fulfillments.filter((f) => f.requestId === requestId);
  }

  // ===========================================================================
  // WORKFLOW INTEGRATION HELPERS (v1)
  // ===========================================================================
  //
  // These methods demonstrate how to integrate the new APRA workflow engine.
  // They are provided as examples and for gradual adoption.

  /**
   * Create a workflow context for a request.
   *
   * This creates a workflow context that can be used for status validation
   * and deadline tracking. The context is independent of the stored request
   * and must be persisted separately if needed.
   *
   * @param request - The APRA request to create a workflow for
   * @param config - APRA configuration (from INApraConfig)
   * @returns Workflow context
   *
   * @example
   * ```typescript
   * const request = await service.getRequest(ctx, requestId);
   * const config = getApraConfig(tenantConfig, tenantIdentity);
   * const workflow = service.createWorkflowContext(request, config);
   *
   * // Check if transition is valid before attempting
   * const canTransition = isValidTransition(workflow.currentStatus, 'IN_REVIEW');
   * ```
   */
  createWorkflowContext(
    request: ApraRequest,
    config: { standardResponseDays?: number; extensionResponseDays?: number; businessDaysOnly?: boolean }
  ): ApraRequestWorkflowContext {
    return initializeApraWorkflow({
      requestId: request.id,
      tenantId: request.tenantId,
      receivedAt: new Date(request.receivedAt),
      config,
    });
  }

  /**
   * Check if a status transition is valid.
   *
   * Uses the workflow engine to validate transitions without
   * modifying the request.
   *
   * @param currentStatus - Current request status
   * @param targetStatus - Desired target status
   * @returns true if the transition is allowed
   *
   * @example
   * ```typescript
   * if (service.canTransitionTo(request.status, 'FULFILLED')) {
   *   await service.updateStatus(ctx, request.id, 'FULFILLED');
   * }
   * ```
   */
  canTransitionTo(
    currentStatus: ApraRequestStatus,
    targetStatus: ApraRequestStatus
  ): boolean {
    // Map the engine types to workflow types (they're compatible)
    return isValidTransition(
      currentStatus as WorkflowStatus,
      targetStatus as WorkflowStatus
    );
  }

  /**
   * Get valid next statuses for a request.
   *
   * Returns the list of statuses the request can transition to.
   *
   * @param currentStatus - Current request status
   * @returns Array of valid next statuses
   *
   * @example
   * ```typescript
   * const validStatuses = service.getNextStatuses(request.status);
   * // Show only valid status options in UI
   * ```
   */
  getNextStatuses(currentStatus: ApraRequestStatus): ApraRequestStatus[] {
    return getValidNextStatuses(currentStatus as WorkflowStatus) as ApraRequestStatus[];
  }
}
