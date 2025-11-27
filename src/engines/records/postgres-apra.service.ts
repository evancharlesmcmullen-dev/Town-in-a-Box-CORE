// src/engines/records/postgres-apra.service.ts
//
// Postgres-backed implementation of ApraService using TenantAwareDb.
// Uses RLS-enforced multi-tenancy following the pattern from PostgresMeetingsService.

import { TenantAwareDb } from '../../db/tenant-aware-db';
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
// Row types for database mapping
// =============================================================================

interface ApraRequestRow {
  id: string;
  tenant_id: string;
  requester_name: string;
  requester_email: string | null;
  description: string;
  reasonably_particular: boolean;
  particularity_reason: string | null;
  received_at: Date;
  statutory_deadline_at: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface ApraRequestScopeRow {
  id: string;
  request_id: string;
  record_type: string | null;
  date_range_start: Date | null;
  date_range_end: Date | null;
  custodians: string[] | null;
  keywords: string[] | null;
}

interface ApraStatusHistoryRow {
  id: string;
  request_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: Date;
  changed_by_user_id: string | null;
  note: string | null;
}

interface ApraClarificationRow {
  id: string;
  request_id: string;
  sent_at: Date;
  responded_at: Date | null;
  message_to_requester: string;
  requester_response: string | null;
}

interface ApraExemptionRow {
  id: string;
  request_id: string;
  citation: string;
  description: string;
  applies_to_scope_id: string | null;
  created_at: Date;
}

interface ApraFulfillmentRow {
  id: string;
  request_id: string;
  fulfilled_at: Date;
  delivery_method: string;
  notes: string | null;
  total_fees_cents: number | null;
}

// =============================================================================
// PostgresApraService
// =============================================================================

/**
 * Postgres-backed implementation of ApraService.
 * Uses TenantAwareDb for RLS-enforced multi-tenancy.
 */
export class PostgresApraService implements ApraService {
  constructor(private readonly db: TenantAwareDb) {}

  // ---------------------------------------------------------------------------
  // Create Request
  // ---------------------------------------------------------------------------

  async createRequest(
    ctx: TenantContext,
    input: CreateApraRequestInput
  ): Promise<ApraRequest> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const now = new Date();

      // Compute the 7 business-day statutory deadline
      const receivedYear = now.getFullYear();
      const holidays = getIndianaStateHolidays(receivedYear);
      if (now.getMonth() >= 10) {
        holidays.push(...getIndianaStateHolidays(receivedYear + 1));
      }
      const deadline = computeApraDeadline(now, { holidays });

      // Insert the request
      const requestResult = await client.query<ApraRequestRow>(
        `
        INSERT INTO apra_requests (
          id, tenant_id, requester_name, requester_email, description,
          reasonably_particular, received_at, statutory_deadline_at,
          status, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          true, $5, $6,
          'RECEIVED', $7, $7
        )
        RETURNING *
        `,
        [
          ctx.tenantId,
          input.requesterName,
          input.requesterEmail ?? null,
          input.description,
          now,
          deadline,
          now,
        ]
      );

      const requestRow = requestResult.rows[0];

      // Create initial status history entry
      await client.query(
        `
        INSERT INTO apra_status_history (
          id, tenant_id, request_id, new_status, changed_at, changed_by_user_id, note
        )
        VALUES (gen_random_uuid(), $1, $2, 'RECEIVED', $3, $4, 'Request received')
        `,
        [ctx.tenantId, requestRow.id, now, ctx.userId ?? null]
      );

      // Create scopes if provided
      if (input.scopes && input.scopes.length > 0) {
        for (const scopeInput of input.scopes) {
          await client.query(
            `
            INSERT INTO apra_request_scopes (
              id, tenant_id, request_id, record_type,
              date_range_start, date_range_end, custodians, keywords
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
            `,
            [
              ctx.tenantId,
              requestRow.id,
              scopeInput.recordType ?? null,
              scopeInput.dateRangeStart ?? null,
              scopeInput.dateRangeEnd ?? null,
              scopeInput.custodians ?? null,
              scopeInput.keywords ?? null,
            ]
          );
        }
      }

      return this.rowToRequest(requestRow);
    });
  }

  // ---------------------------------------------------------------------------
  // Get / List Requests
  // ---------------------------------------------------------------------------

  async getRequest(
    ctx: TenantContext,
    id: string
  ): Promise<ApraRequest | null> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<ApraRequestRow>(
        `SELECT * FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );
      return result.rows.length > 0 ? this.rowToRequest(result.rows[0]) : null;
    });
  }

  async listRequests(
    ctx: TenantContext,
    filter?: ApraRequestFilter
  ): Promise<ApraRequestSummary[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [ctx.tenantId];
      let idx = 2;

      if (filter?.status && filter.status.length > 0) {
        conditions.push(`status = ANY($${idx++})`);
        params.push(filter.status);
      }
      if (filter?.fromDate) {
        conditions.push(`received_at >= $${idx++}`);
        params.push(filter.fromDate);
      }
      if (filter?.toDate) {
        conditions.push(`received_at <= $${idx++}`);
        params.push(filter.toDate);
      }
      if (filter?.searchText) {
        conditions.push(`(description ILIKE $${idx} OR requester_name ILIKE $${idx})`);
        params.push(`%${filter.searchText}%`);
        idx++;
      }

      const result = await client.query<ApraRequestRow>(
        `SELECT * FROM apra_requests WHERE ${conditions.join(' AND ')} ORDER BY received_at DESC`,
        params
      );

      return result.rows.map((row) => this.rowToSummary(row));
    });
  }

  // ---------------------------------------------------------------------------
  // Clarifications
  // ---------------------------------------------------------------------------

  async addClarification(
    ctx: TenantContext,
    requestId: string,
    messageToRequester: string
  ): Promise<ApraClarification> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const now = new Date();

      // Verify request exists
      const check = await client.query<ApraRequestRow>(
        `SELECT * FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const oldStatus = check.rows[0].status;

      // Insert clarification
      const clarResult = await client.query<ApraClarificationRow>(
        `
        INSERT INTO apra_clarifications (
          id, tenant_id, request_id, sent_at, message_to_requester
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING *
        `,
        [ctx.tenantId, requestId, now, messageToRequester]
      );

      // Update request status
      await client.query(
        `
        UPDATE apra_requests
        SET status = 'NEEDS_CLARIFICATION',
            reasonably_particular = false,
            particularity_reason = 'Clarification requested from requester',
            updated_at = $3
        WHERE tenant_id = $1 AND id = $2
        `,
        [ctx.tenantId, requestId, now]
      );

      // Add status history
      await client.query(
        `
        INSERT INTO apra_status_history (
          id, tenant_id, request_id, old_status, new_status, changed_at, changed_by_user_id, note
        )
        VALUES (gen_random_uuid(), $1, $2, $3, 'NEEDS_CLARIFICATION', $4, $5, 'Clarification requested')
        `,
        [ctx.tenantId, requestId, oldStatus, now, ctx.userId ?? null]
      );

      return this.rowToClarification(clarResult.rows[0]);
    });
  }

  async recordClarificationResponse(
    ctx: TenantContext,
    clarificationId: string,
    requesterResponse: string
  ): Promise<ApraClarification> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const now = new Date();

      // Get clarification
      const clarResult = await client.query<ApraClarificationRow>(
        `SELECT * FROM apra_clarifications WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, clarificationId]
      );
      if (clarResult.rows.length === 0) {
        throw new Error('Clarification not found');
      }

      const clarification = clarResult.rows[0];

      // Verify request exists and belongs to tenant
      const requestResult = await client.query<ApraRequestRow>(
        `SELECT * FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, clarification.request_id]
      );
      if (requestResult.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const oldStatus = requestResult.rows[0].status;

      // Update clarification
      await client.query(
        `
        UPDATE apra_clarifications
        SET responded_at = $3, requester_response = $4
        WHERE tenant_id = $1 AND id = $2
        `,
        [ctx.tenantId, clarificationId, now, requesterResponse]
      );

      // Recompute deadline
      const receivedYear = now.getFullYear();
      const holidays = getIndianaStateHolidays(receivedYear);
      if (now.getMonth() >= 10) {
        holidays.push(...getIndianaStateHolidays(receivedYear + 1));
      }
      const newDeadline = computeApraDeadline(now, { holidays });

      // Update request
      await client.query(
        `
        UPDATE apra_requests
        SET status = 'IN_REVIEW',
            reasonably_particular = true,
            particularity_reason = 'Request clarified by requester',
            statutory_deadline_at = $3,
            updated_at = $4
        WHERE tenant_id = $1 AND id = $2
        `,
        [ctx.tenantId, clarification.request_id, newDeadline, now]
      );

      // Add status history
      await client.query(
        `
        INSERT INTO apra_status_history (
          id, tenant_id, request_id, old_status, new_status, changed_at, changed_by_user_id, note
        )
        VALUES (gen_random_uuid(), $1, $2, $3, 'IN_REVIEW', $4, $5, 'Clarification received, deadline reset')
        `,
        [ctx.tenantId, clarification.request_id, oldStatus, now, ctx.userId ?? null]
      );

      // Return updated clarification
      const updated = await client.query<ApraClarificationRow>(
        `SELECT * FROM apra_clarifications WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, clarificationId]
      );
      return this.rowToClarification(updated.rows[0]);
    });
  }

  // ---------------------------------------------------------------------------
  // Status Updates
  // ---------------------------------------------------------------------------

  async updateStatus(
    ctx: TenantContext,
    requestId: string,
    newStatus: ApraRequestStatus,
    note?: string
  ): Promise<ApraRequest> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const now = new Date();

      // Get current request
      const existing = await client.query<ApraRequestRow>(
        `SELECT * FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (existing.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const oldStatus = existing.rows[0].status;
      if (oldStatus === newStatus) {
        return this.rowToRequest(existing.rows[0]);
      }

      // Update request
      const result = await client.query<ApraRequestRow>(
        `
        UPDATE apra_requests
        SET status = $3, updated_at = $4
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
        `,
        [ctx.tenantId, requestId, newStatus, now]
      );

      // Add status history
      await client.query(
        `
        INSERT INTO apra_status_history (
          id, tenant_id, request_id, old_status, new_status, changed_at, changed_by_user_id, note
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
        `,
        [ctx.tenantId, requestId, oldStatus, newStatus, now, ctx.userId ?? null, note ?? null]
      );

      return this.rowToRequest(result.rows[0]);
    });
  }

  // ---------------------------------------------------------------------------
  // Exemptions
  // ---------------------------------------------------------------------------

  async addExemption(
    ctx: TenantContext,
    requestId: string,
    input: AddExemptionInput
  ): Promise<ApraExemptionCitation> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const now = new Date();

      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      // Insert exemption
      const result = await client.query<ApraExemptionRow>(
        `
        INSERT INTO apra_exemptions (
          id, tenant_id, request_id, citation, description, applies_to_scope_id, created_at
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          ctx.tenantId,
          requestId,
          input.citation,
          input.description,
          input.appliesToScopeId ?? null,
          now,
        ]
      );

      // Update request timestamp
      await client.query(
        `UPDATE apra_requests SET updated_at = $3 WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId, now]
      );

      return this.rowToExemption(result.rows[0]);
    });
  }

  // ---------------------------------------------------------------------------
  // Fulfillment
  // ---------------------------------------------------------------------------

  async recordFulfillment(
    ctx: TenantContext,
    requestId: string,
    input: RecordFulfillmentInput
  ): Promise<ApraFulfillment> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const now = new Date();

      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      // Insert fulfillment
      const result = await client.query<ApraFulfillmentRow>(
        `
        INSERT INTO apra_fulfillments (
          id, tenant_id, request_id, fulfilled_at, delivery_method, notes, total_fees_cents
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          ctx.tenantId,
          requestId,
          now,
          input.deliveryMethod,
          input.notes ?? null,
          input.totalFeesCents ?? null,
        ]
      );

      // Update request timestamp
      await client.query(
        `UPDATE apra_requests SET updated_at = $3 WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId, now]
      );

      return this.rowToFulfillment(result.rows[0]);
    });
  }

  // ---------------------------------------------------------------------------
  // Getters for related data
  // ---------------------------------------------------------------------------

  async getStatusHistory(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraStatusHistoryEntry[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const result = await client.query<ApraStatusHistoryRow>(
        `SELECT * FROM apra_status_history WHERE tenant_id = $1 AND request_id = $2 ORDER BY changed_at ASC`,
        [ctx.tenantId, requestId]
      );
      return result.rows.map((row) => this.rowToStatusHistory(row));
    });
  }

  async getScopes(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraRequestScope[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const result = await client.query<ApraRequestScopeRow>(
        `SELECT * FROM apra_request_scopes WHERE tenant_id = $1 AND request_id = $2`,
        [ctx.tenantId, requestId]
      );
      return result.rows.map((row) => this.rowToScope(row));
    });
  }

  async getClarifications(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraClarification[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const result = await client.query<ApraClarificationRow>(
        `SELECT * FROM apra_clarifications WHERE tenant_id = $1 AND request_id = $2 ORDER BY sent_at ASC`,
        [ctx.tenantId, requestId]
      );
      return result.rows.map((row) => this.rowToClarification(row));
    });
  }

  async getExemptions(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraExemptionCitation[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const result = await client.query<ApraExemptionRow>(
        `SELECT * FROM apra_exemptions WHERE tenant_id = $1 AND request_id = $2`,
        [ctx.tenantId, requestId]
      );
      return result.rows.map((row) => this.rowToExemption(row));
    });
  }

  async getFulfillments(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraFulfillment[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Verify request exists
      const check = await client.query(
        `SELECT id FROM apra_requests WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, requestId]
      );
      if (check.rows.length === 0) {
        throw new Error('APRA request not found for tenant');
      }

      const result = await client.query<ApraFulfillmentRow>(
        `SELECT * FROM apra_fulfillments WHERE tenant_id = $1 AND request_id = $2`,
        [ctx.tenantId, requestId]
      );
      return result.rows.map((row) => this.rowToFulfillment(row));
    });
  }

  // ---------------------------------------------------------------------------
  // Row Mappers
  // ---------------------------------------------------------------------------

  private rowToRequest(row: ApraRequestRow): ApraRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      requesterName: row.requester_name,
      requesterEmail: row.requester_email ?? undefined,
      description: row.description,
      reasonablyParticular: row.reasonably_particular,
      particularityReason: row.particularity_reason ?? undefined,
      receivedAt: row.received_at.toISOString(),
      statutoryDeadlineAt: row.statutory_deadline_at?.toISOString(),
      status: row.status as ApraRequestStatus,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private rowToSummary(row: ApraRequestRow): ApraRequestSummary {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      receivedAt: row.received_at.toISOString(),
      requesterName: row.requester_name,
      status: row.status as ApraRequestStatus,
      statutoryDeadlineAt: row.statutory_deadline_at?.toISOString(),
    };
  }

  private rowToScope(row: ApraRequestScopeRow): ApraRequestScope {
    return {
      id: row.id,
      requestId: row.request_id,
      recordType: row.record_type ?? undefined,
      dateRangeStart: row.date_range_start?.toISOString().split('T')[0],
      dateRangeEnd: row.date_range_end?.toISOString().split('T')[0],
      custodians: row.custodians ?? undefined,
      keywords: row.keywords ?? undefined,
    };
  }

  private rowToStatusHistory(row: ApraStatusHistoryRow): ApraStatusHistoryEntry {
    return {
      id: row.id,
      requestId: row.request_id,
      oldStatus: row.old_status as ApraRequestStatus | undefined,
      newStatus: row.new_status as ApraRequestStatus,
      changedAt: row.changed_at.toISOString(),
      changedByUserId: row.changed_by_user_id ?? undefined,
      note: row.note ?? undefined,
    };
  }

  private rowToClarification(row: ApraClarificationRow): ApraClarification {
    return {
      id: row.id,
      requestId: row.request_id,
      sentAt: row.sent_at.toISOString(),
      respondedAt: row.responded_at?.toISOString(),
      messageToRequester: row.message_to_requester,
      requesterResponse: row.requester_response ?? undefined,
    };
  }

  private rowToExemption(row: ApraExemptionRow): ApraExemptionCitation {
    return {
      id: row.id,
      requestId: row.request_id,
      citation: row.citation,
      description: row.description,
      appliesToScopeId: row.applies_to_scope_id ?? undefined,
      createdAt: row.created_at.toISOString(),
    };
  }

  private rowToFulfillment(row: ApraFulfillmentRow): ApraFulfillment {
    return {
      id: row.id,
      requestId: row.request_id,
      fulfilledAt: row.fulfilled_at.toISOString(),
      deliveryMethod: row.delivery_method as ApraFulfillment['deliveryMethod'],
      notes: row.notes ?? undefined,
      totalFeesCents: row.total_fees_cents ?? undefined,
    };
  }
}
