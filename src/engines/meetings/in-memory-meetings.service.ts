// src/engines/meetings/in-memory-meetings.service.ts

import { randomUUID } from 'crypto';
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
  OpenDoorCompliance,
} from './meetings.service';

export interface InMemoryMeetingsSeedData {
  meetings?: Meeting[];
  minutes?: Minutes[];
  votes?: VoteRecord[];
}

/**
 * In-memory MeetingsService for tests/demos. Data is scoped per tenant
 * and stored only for the lifetime of the process.
 */
export class InMemoryMeetingsService implements MeetingsService {
  private meetings: Meeting[];
  private minutes: Minutes[];
  private votes: VoteRecord[];

  constructor(seed: InMemoryMeetingsSeedData = {}) {
    this.meetings = seed.meetings ? [...seed.meetings] : [];
    this.minutes = seed.minutes ? [...seed.minutes] : [];
    this.votes = seed.votes ? [...seed.votes] : [];
  }

  async scheduleMeeting(
    ctx: TenantContext,
    input: ScheduleMeetingInput
  ): Promise<Meeting> {
    const now = new Date();
    const meetingType: MeetingType = input.type;
    const initialStatus: MeetingStatus = 'planned';

    const meeting: Meeting = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      bodyId: input.bodyId,
      type: meetingType,
      status: initialStatus,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      location: input.location,
      createdByUserId: ctx.userId,
      createdAt: now,
    };

    this.meetings.push(meeting);
    return meeting;
  }

  async getMeeting(
    ctx: TenantContext,
    id: string
  ): Promise<Meeting | null> {
    return (
      this.meetings.find(
        (m) => m.id === id && m.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listMeetings(
    ctx: TenantContext,
    filter: MeetingFilter = {}
  ): Promise<MeetingSummary[]> {
    let results = this.meetings.filter(
      (m) => m.tenantId === ctx.tenantId
    );

    if (filter.bodyId) {
      results = results.filter((m) => m.bodyId === filter.bodyId);
    }

    if (filter.status) {
      results = results.filter((m) => m.status === filter.status);
    }

    if (filter.fromDate) {
      results = results.filter(
        (m) => m.scheduledStart >= filter.fromDate!
      );
    }

    if (filter.toDate) {
      results = results.filter(
        (m) => m.scheduledStart <= filter.toDate!
      );
    }

    return results.map<MeetingSummary>((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      bodyId: m.bodyId,
      type: m.type,
      status: m.status,
      scheduledStart: m.scheduledStart,
      location: m.location,
    }));
  }

  async recordMinutes(
    ctx: TenantContext,
    minutes: Minutes
  ): Promise<void> {
    const meeting = this.meetings.find(
      (m) => m.id === minutes.meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    // Replace existing minutes for this meeting if present.
    this.minutes = this.minutes.filter(
      (m) => m.meetingId !== minutes.meetingId
    );
    this.minutes.push({
      ...minutes,
      preparedAt: minutes.preparedAt ?? new Date(),
    });
  }

  async recordVote(
    ctx: TenantContext,
    vote: VoteRecord
  ): Promise<void> {
    const meeting = this.meetings.find(
      (m) => m.id === vote.meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    this.votes.push(vote.id ? vote : { ...vote, id: randomUUID() });
  }

  async cancelMeeting(
    ctx: TenantContext,
    meetingId: string
  ): Promise<Meeting> {
    const meeting = this.meetings.find(
      (m) => m.id === meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    meeting.status = 'cancelled';
    meeting.cancelledAt = new Date();
    meeting.cancelledByUserId = ctx.userId;

    return meeting;
  }

  async markNoticePosted(
    ctx: TenantContext,
    meetingId: string,
    input: MarkNoticePostedInput
  ): Promise<{ meeting: Meeting; openDoorCompliance: OpenDoorCompliance }> {
    const meeting = this.meetings.find(
      (m) => m.id === meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    meeting.noticePostedAt = input.postedAt;
    meeting.status = 'noticed';

    // Compute required posted by time (48 hours before meeting for regular)
    const hoursRequired = meeting.type === 'emergency' ? 0 : 48;
    const requiredPostedBy = new Date(
      meeting.scheduledStart.getTime() - hoursRequired * 60 * 60 * 1000
    );

    // Determine timeliness
    let timeliness: 'onTime' | 'late' | 'notPosted';
    if (!input.postedAt) {
      timeliness = 'notPosted';
    } else if (input.postedAt <= requiredPostedBy) {
      timeliness = 'onTime';
    } else {
      timeliness = 'late';
    }

    const compliance: OpenDoorCompliance = {
      requiredPostedBy,
      actualPostedAt: input.postedAt,
      timeliness,
      methods: input.methods,
      locations: input.locations,
      notes: input.notes,
    };

    return { meeting, openDoorCompliance: compliance };
  }

  /**
   * Update a meeting's AI summary. Used by AI routes.
   */
  async updateAiSummary(
    ctx: TenantContext,
    meetingId: string,
    summary: string
  ): Promise<Meeting> {
    const meeting = this.meetings.find(
      (m) => m.id === meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    meeting.aiCouncilSummary = summary;
    return meeting;
  }
}
