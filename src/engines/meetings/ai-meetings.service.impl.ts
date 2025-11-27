// src/engines/meetings/ai-meetings.service.impl.ts
//
// AI-enhanced meetings service implementation.

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { AiExtractionService } from '../../core/ai/ai.service';
import { Meeting, MeetingDeadline } from './meeting.types';
import { MeetingsService, AiMeetingsService } from './meetings.service';

/**
 * Wraps any MeetingsService implementation with AI capabilities.
 *
 * Uses composition to add AI features to an existing meetings service.
 * Requires an AiExtractionService for summarization and deadline extraction.
 *
 * @example
 * const baseService = new InMemoryMeetingsService();
 * const aiService = new AiMeetingsServiceImpl(baseService, extractionService);
 * const meeting = await aiService.generateCouncilSummary(ctx, meetingId, agendaText);
 */
export class AiMeetingsServiceImpl implements AiMeetingsService {
  constructor(
    private readonly base: MeetingsService,
    private readonly aiExtraction: AiExtractionService
  ) {}

  // ---------- Delegated methods ----------

  scheduleMeeting = this.base.scheduleMeeting.bind(this.base);
  getMeeting = this.base.getMeeting.bind(this.base);
  listMeetings = this.base.listMeetings.bind(this.base);
  recordMinutes = this.base.recordMinutes.bind(this.base);
  recordVote = this.base.recordVote.bind(this.base);
  cancelMeeting = this.base.cancelMeeting.bind(this.base);
  markNoticePosted = this.base.markNoticePosted.bind(this.base);

  // ---------- AI-enhanced methods ----------

  async generateCouncilSummary(
    ctx: TenantContext,
    meetingId: string,
    agendaText: string
  ): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Generate summary using AI
    const summary = await this.aiExtraction.summarizeForCouncil(ctx, agendaText, {
      maxWords: 200,
    });

    // Update meeting with AI-generated summary
    meeting.aiCouncilSummary = summary;
    meeting.aiSummaryGeneratedAt = new Date().toISOString();

    return meeting;
  }

  async scanForDeadlines(
    ctx: TenantContext,
    meetingId: string,
    packetText: string
  ): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Extract deadlines using AI
    const extracted = await this.aiExtraction.extractDeadlines(ctx, packetText);

    // Convert to MeetingDeadline format with human review flags
    const deadlines: MeetingDeadline[] = extracted.map((d) => ({
      id: randomUUID(),
      meetingId,
      label: d.label,
      dueDate: d.dueDate,
      confidence: d.confidence,
      isConfirmed: false, // Requires human review
    }));

    // Append to existing deadlines (don't replace)
    meeting.aiExtractedDeadlines = [
      ...(meeting.aiExtractedDeadlines ?? []),
      ...deadlines,
    ];

    return meeting;
  }

  async reviewDeadline(
    ctx: TenantContext,
    meetingId: string,
    deadlineId: string,
    isConfirmed: boolean
  ): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (!meeting.aiExtractedDeadlines) {
      throw new Error('No deadlines to review');
    }

    const deadline = meeting.aiExtractedDeadlines.find((d) => d.id === deadlineId);
    if (!deadline) {
      throw new Error('Deadline not found');
    }

    // Mark as reviewed
    deadline.reviewedByUserId = ctx.userId;
    deadline.reviewedAt = new Date().toISOString();
    deadline.isConfirmed = isConfirmed;

    return meeting;
  }
}
