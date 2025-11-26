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
  MeetingNotice,
} from './meeting.types';
import {
  MeetingsService,
  ScheduleMeetingInput,
  MeetingFilter,
  MarkNoticePostedInput,
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
    meetingId: string,
    reason?: string
  ): Promise<Meeting> {
    const meeting = this.meetings.find(
      (m) => m.id === meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    if (meeting.status === 'cancelled') {
      throw new Error('Meeting is already cancelled');
    }

    if (meeting.status === 'adjourned') {
      throw new Error('Cannot cancel an adjourned meeting');
    }

    meeting.status = 'cancelled';
    meeting.cancelledAt = new Date();
    if (reason) {
      meeting.cancellationReason = reason;
    }

    return meeting;
  }

  async markNoticePosted(
    ctx: TenantContext,
    input: MarkNoticePostedInput
  ): Promise<Meeting> {
    const meeting = this.meetings.find(
      (m) => m.id === input.meetingId && m.tenantId === ctx.tenantId
    );

    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    if (meeting.status === 'cancelled') {
      throw new Error('Cannot post notice for a cancelled meeting');
    }

    if (meeting.status === 'adjourned') {
      throw new Error('Cannot post notice for an adjourned meeting');
    }

    // Default to 48-hour requirement per Indiana Open Door Law (IC 5-14-1.5-5)
    // Emergency meetings have different rules and can override this
    const requiredLeadTimeHours =
      input.requiredLeadTimeHours ?? (meeting.type === 'emergency' ? 0 : 48);

    // Calculate if notice is timely
    const msDiff =
      meeting.scheduledStart.getTime() - input.postedAt.getTime();
    const hoursDiff = msDiff / (1000 * 60 * 60);
    const isTimely =
      hoursDiff >= requiredLeadTimeHours || meeting.type === 'emergency';

    const notice: MeetingNotice = {
      id: randomUUID(),
      meetingId: meeting.id,
      postedAt: input.postedAt,
      postedByUserId: input.postedByUserId,
      methods: input.methods,
      locations: input.locations,
      proofUris: input.proofUris,
      requiredLeadTimeHours,
      isTimely,
      notes: input.notes,
    };

    // Append to notices array
    meeting.notices = [...(meeting.notices ?? []), notice];
    meeting.lastNoticePostedAt = input.postedAt;

    // Update compliance tracking
    meeting.openDoorCompliance = {
      hasTimelyNotice: isTimely,
      lastCheckedAt: new Date(),
    };

    // Transition status to 'noticed' if currently 'planned'
    if (meeting.status === 'planned') {
      meeting.status = 'noticed';
    }

    return meeting;
  }
}
