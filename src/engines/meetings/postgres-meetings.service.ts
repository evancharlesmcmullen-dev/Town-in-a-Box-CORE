// src/engines/meetings/postgres-meetings.service.ts

import { TenantAwareDb } from '../../db/tenant-aware-db';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  Meeting,
  MeetingSummary,
  Minutes,
  VoteRecord,
  MeetingType,
  MeetingStatus,
} from './meeting.types';
import {
  MeetingsService,
  ScheduleMeetingInput,
  MeetingFilter,
  MarkNoticePostedInput,
} from './meetings.service';
import {
  calculateNoticeDeadline,
  isNoticeCompliant,
} from '../../core/calendar/indiana-business-calendar';

/** Row shape from meetings table */
interface MeetingRow {
  id: string;
  tenant_id: string;
  body_id: string;
  type: string;
  status: string;
  scheduled_start: Date;
  scheduled_end: Date | null;
  location: string;
  notice_posted_at: Date | null;
  last_notice_posted_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Postgres-backed implementation of MeetingsService.
 * Uses TenantAwareDb for RLS-enforced multi-tenancy.
 */
export class PostgresMeetingsService implements MeetingsService {
  constructor(private readonly db: TenantAwareDb) {}

  async scheduleMeeting(
    ctx: TenantContext,
    input: ScheduleMeetingInput
  ): Promise<Meeting> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<MeetingRow>(
        `
        INSERT INTO meetings (
          id, tenant_id, body_id, type, status,
          scheduled_start, scheduled_end, location,
          created_by_user_id, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, 'planned',
          $4, $5, $6, $7, now(), now()
        )
        RETURNING *
        `,
        [
          ctx.tenantId,
          input.bodyId,
          input.type,
          input.scheduledStart,
          input.scheduledEnd ?? null,
          input.location,
          ctx.userId ?? null,
        ]
      );
      return this.rowToMeeting(result.rows[0]);
    });
  }

  async getMeeting(ctx: TenantContext, id: string): Promise<Meeting | null> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<MeetingRow>(
        `SELECT * FROM meetings WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );
      return result.rows.length > 0 ? this.rowToMeeting(result.rows[0]) : null;
    });
  }

  async listMeetings(
    ctx: TenantContext,
    filter: MeetingFilter = {}
  ): Promise<MeetingSummary[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [ctx.tenantId];
      let idx = 2;

      if (filter.bodyId) {
        conditions.push(`body_id = $${idx++}`);
        params.push(filter.bodyId);
      }
      if (filter.status) {
        conditions.push(`status = $${idx++}`);
        params.push(filter.status);
      }
      if (filter.fromDate) {
        conditions.push(`scheduled_start >= $${idx++}`);
        params.push(filter.fromDate);
      }
      if (filter.toDate) {
        conditions.push(`scheduled_start <= $${idx++}`);
        params.push(filter.toDate);
      }

      const result = await client.query<MeetingRow>(
        `SELECT * FROM meetings WHERE ${conditions.join(' AND ')} ORDER BY scheduled_start DESC`,
        params
      );
      return result.rows.map((row) => this.rowToSummary(row));
    });
  }

  async recordMinutes(ctx: TenantContext, minutes: Minutes): Promise<void> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const check = await client.query(
        `SELECT id FROM meetings WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, minutes.meetingId]
      );
      if (check.rows.length === 0) {
        throw new Error('Meeting not found for tenant');
      }

      await client.query(
        `
        INSERT INTO minutes (id, tenant_id, meeting_id, prepared_by_user_id, prepared_at, approved_at, body)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        ON CONFLICT (meeting_id) DO UPDATE SET
          prepared_by_user_id = EXCLUDED.prepared_by_user_id,
          prepared_at = EXCLUDED.prepared_at,
          approved_at = EXCLUDED.approved_at,
          body = EXCLUDED.body
        `,
        [
          ctx.tenantId,
          minutes.meetingId,
          minutes.preparedByUserId ?? null,
          minutes.preparedAt ?? new Date(),
          minutes.approvedAt ?? null,
          minutes.body ?? null,
        ]
      );
    });
  }

  async recordVote(ctx: TenantContext, vote: VoteRecord): Promise<void> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const check = await client.query(
        `SELECT id FROM meetings WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, vote.meetingId]
      );
      if (check.rows.length === 0) {
        throw new Error('Meeting not found for tenant');
      }

      await client.query(
        `
        INSERT INTO vote_records (id, tenant_id, meeting_id, agenda_item_id, member_id, vote, voted_at)
        VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
        `,
        [
          vote.id ?? null,
          ctx.tenantId,
          vote.meetingId,
          vote.agendaItemId ?? null,
          vote.memberId,
          vote.vote,
          vote.votedAt,
        ]
      );
    });
  }

  async cancelMeeting(
    ctx: TenantContext,
    meetingId: string,
    reason?: string
  ): Promise<Meeting> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const existing = await client.query<MeetingRow>(
        `SELECT * FROM meetings WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, meetingId]
      );

      if (existing.rows.length === 0) {
        throw new Error('Meeting not found for tenant');
      }

      const meeting = existing.rows[0];

      // Idempotent: already cancelled
      if (meeting.status === 'cancelled') {
        return this.rowToMeeting(meeting);
      }

      // Cannot cancel adjourned meeting
      if (meeting.status === 'adjourned') {
        throw new Error('Cannot cancel an adjourned meeting');
      }

      const result = await client.query<MeetingRow>(
        `
        UPDATE meetings
        SET status = 'cancelled',
            cancelled_at = now(),
            cancellation_reason = $3,
            updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
        `,
        [ctx.tenantId, meetingId, reason ?? null]
      );

      return this.rowToMeeting(result.rows[0]);
    });
  }

  async markNoticePosted(
    ctx: TenantContext,
    input: MarkNoticePostedInput
  ): Promise<Meeting> {
    const { meetingId, postedAt } = input;

    return this.db.withTenant(ctx.tenantId, async (client) => {
      const existing = await client.query<MeetingRow>(
        `SELECT * FROM meetings WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, meetingId]
      );

      if (existing.rows.length === 0) {
        throw new Error('Meeting not found for tenant');
      }

      const meeting = existing.rows[0];
      const compliant = isNoticeCompliant(postedAt, meeting.scheduled_start);

      // Determine new status
      const newStatus = meeting.status === 'planned' ? 'noticed' : meeting.status;

      // Update notice timestamps
      const result = await client.query<MeetingRow>(
        `
        UPDATE meetings
        SET status = $3,
            notice_posted_at = COALESCE(notice_posted_at, $4),
            last_notice_posted_at = $4,
            updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
        `,
        [ctx.tenantId, meetingId, newStatus, postedAt]
      );

      return this.rowToMeeting(result.rows[0]);
    });
  }

  // ---- Helpers ----

  private rowToMeeting(row: MeetingRow): Meeting {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      bodyId: row.body_id,
      type: row.type as MeetingType,
      status: row.status as MeetingStatus,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end ?? undefined,
      location: row.location,
      noticePostedAt: row.notice_posted_at ?? undefined,
      lastNoticePostedAt: row.last_notice_posted_at ?? undefined,
      cancelledAt: row.cancelled_at ?? undefined,
      cancellationReason: row.cancellation_reason ?? undefined,
      createdByUserId: row.created_by_user_id ?? undefined,
      createdAt: row.created_at,
    };
  }

  private rowToSummary(row: MeetingRow): MeetingSummary {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      bodyId: row.body_id,
      type: row.type as MeetingType,
      status: row.status as MeetingStatus,
      scheduledStart: row.scheduled_start,
      location: row.location,
    };
  }
}
