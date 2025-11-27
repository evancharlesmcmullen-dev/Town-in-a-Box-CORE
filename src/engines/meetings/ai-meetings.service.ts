// src/engines/meetings/ai-meetings.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  Meeting,
  MeetingSummary,
  Minutes,
  VoteRecord,
  MeetingDeadline,
} from './meeting.types';
import {
  MeetingsService,
  ScheduleMeetingInput,
  MeetingFilter,
  MarkNoticePostedInput,
} from './meetings.service';

/**
 * AI provider interface for meeting-related AI operations.
 */
export interface AiMeetingsProvider {
  /**
   * Generate a council-friendly summary from agenda text.
   */
  generateSummary(agendaText: string): Promise<string>;

  /**
   * Extract deadlines from meeting packet text.
   */
  extractDeadlines(packetText: string): Promise<Array<{
    description: string;
    dueDate: Date;
    source: string;
  }>>;
}

/**
 * Mock AI provider for development/testing.
 */
export class MockAiMeetingsProvider implements AiMeetingsProvider {
  async generateSummary(agendaText: string): Promise<string> {
    // Simple mock that returns a canned summary
    const wordCount = agendaText.split(/\s+/).length;
    return `[AI Summary] This meeting covers ${wordCount} words of agenda items. ` +
      `Key topics include routine business and public comments. ` +
      `Council members should review attached materials before the meeting.`;
  }

  async extractDeadlines(packetText: string): Promise<Array<{
    description: string;
    dueDate: Date;
    source: string;
  }>> {
    // Mock deadline extraction - returns sample deadlines
    const now = new Date();
    return [
      {
        description: 'Public comment period closes',
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        source: 'Extracted from packet (mock)',
      },
      {
        description: 'Budget review deadline',
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
        source: 'Extracted from packet (mock)',
      },
    ];
  }
}

/**
 * Extended meetings service interface with AI capabilities.
 */
export interface AiMeetingsService extends MeetingsService {
  /**
   * Generate a council-friendly summary for a meeting using AI.
   */
  generateCouncilSummary(
    ctx: TenantContext,
    meetingId: string,
    agendaText: string
  ): Promise<Meeting>;

  /**
   * Scan meeting packet for deadlines using AI.
   */
  scanForDeadlines(
    ctx: TenantContext,
    meetingId: string,
    packetText: string
  ): Promise<Meeting>;

  /**
   * Mark a deadline as reviewed (confirmed or rejected by staff).
   */
  reviewDeadline(
    ctx: TenantContext,
    meetingId: string,
    deadlineId: string,
    isConfirmed: boolean
  ): Promise<Meeting>;
}

/**
 * AI-enhanced meetings service that wraps a base MeetingsService.
 * Adds AI capabilities for summaries and deadline extraction.
 */
export class AiMeetingsServiceImpl implements AiMeetingsService {
  constructor(
    private readonly base: MeetingsService,
    private readonly aiProvider: AiMeetingsProvider
  ) {}

  // Delegate base methods
  scheduleMeeting(ctx: TenantContext, input: ScheduleMeetingInput): Promise<Meeting> {
    return this.base.scheduleMeeting(ctx, input);
  }

  getMeeting(ctx: TenantContext, id: string): Promise<Meeting | null> {
    return this.base.getMeeting(ctx, id);
  }

  listMeetings(ctx: TenantContext, filter?: MeetingFilter): Promise<MeetingSummary[]> {
    return this.base.listMeetings(ctx, filter);
  }

  recordMinutes(ctx: TenantContext, minutes: Minutes): Promise<void> {
    return this.base.recordMinutes(ctx, minutes);
  }

  recordVote(ctx: TenantContext, vote: VoteRecord): Promise<void> {
    return this.base.recordVote(ctx, vote);
  }

  cancelMeeting(ctx: TenantContext, id: string, reason?: string): Promise<Meeting> {
    return this.base.cancelMeeting(ctx, id, reason);
  }

  markNoticePosted(ctx: TenantContext, input: MarkNoticePostedInput): Promise<Meeting> {
    return this.base.markNoticePosted(ctx, input);
  }

  // AI-enhanced methods
  async generateCouncilSummary(
    ctx: TenantContext,
    meetingId: string,
    agendaText: string
  ): Promise<Meeting> {
    const meeting = await this.base.getMeeting(ctx, meetingId);
    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    const summary = await this.aiProvider.generateSummary(agendaText);
    meeting.aiCouncilSummary = summary;
    meeting.aiSummaryGeneratedAt = new Date().toISOString();

    return meeting;
  }

  async scanForDeadlines(
    ctx: TenantContext,
    meetingId: string,
    packetText: string
  ): Promise<Meeting> {
    const meeting = await this.base.getMeeting(ctx, meetingId);
    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    const extracted = await this.aiProvider.extractDeadlines(packetText);

    meeting.aiExtractedDeadlines = extracted.map((d): MeetingDeadline => ({
      id: randomUUID(),
      meetingId: meeting.id,
      label: d.description,
      dueDate: d.dueDate.toISOString().split('T')[0],
      isConfirmed: false,
    }));

    return meeting;
  }

  async reviewDeadline(
    ctx: TenantContext,
    meetingId: string,
    deadlineId: string,
    isConfirmed: boolean
  ): Promise<Meeting> {
    const meeting = await this.base.getMeeting(ctx, meetingId);
    if (!meeting) {
      throw new Error('Meeting not found for tenant');
    }

    const deadline = meeting.aiExtractedDeadlines?.find((d) => d.id === deadlineId);
    if (!deadline) {
      throw new Error('Deadline not found');
    }

    deadline.isConfirmed = isConfirmed;
    deadline.reviewedAt = new Date().toISOString();
    deadline.reviewedByUserId = ctx.userId;

    return meeting;
  }
}
