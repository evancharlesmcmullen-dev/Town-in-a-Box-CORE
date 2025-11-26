// src/engines/meetings/meetings.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  GoverningBody,
  Meeting,
  MeetingSummary,
  Minutes,
  VoteRecord,
  MeetingType,
  MeetingStatus,
  NoticeMethod,
  MeetingDeadline,
} from './meeting.types';

// Input for scheduling a meeting.
export interface ScheduleMeetingInput {
  bodyId: string;                // GoverningBody.id
  type: MeetingType;
  scheduledStart: Date;
  scheduledEnd?: Date;
  location: string;
}

// Filter options for listing meetings.
export interface MeetingFilter {
  bodyId?: string;
  fromDate?: Date;
  toDate?: Date;
  status?: MeetingStatus;
}

// Input for marking notice as posted (Open Door Law compliance).
export interface MarkNoticePostedInput {
  meetingId: string;
  postedAt: Date;
  postedByUserId: string;
  methods: NoticeMethod[];
  locations: string[];
  proofUris?: string[];
  notes?: string;
  // Override for emergencies or special cases (default is 48 hours)
  requiredLeadTimeHours?: number;
}

/**
 * Public service interface for the Meetings engine.
 *
 * Implementations will:
 * - Use LegalEngine.getMeetingsRules(...) to compute notice deadlines
 * - Use the Notice engine to generate/post notices
 * - Integrate with Records to store agendas, minutes, recordings, etc.
 *
 * For now, this is just an interface (no persistence or behavior).
 */
export interface MeetingsService {
  /**
   * Schedule a new meeting for a governing body.
   */
  scheduleMeeting(
    ctx: TenantContext,
    input: ScheduleMeetingInput
  ): Promise<Meeting>;

  /**
   * Fetch a single meeting by ID.
   */
  getMeeting(
    ctx: TenantContext,
    id: string
  ): Promise<Meeting | null>;

  /**
   * List meetings, optionally filtered by body, date range, and status.
   */
  listMeetings(
    ctx: TenantContext,
    filter?: MeetingFilter
  ): Promise<MeetingSummary[]>;

  /**
   * Record minutes for a meeting.
   */
  recordMinutes(
    ctx: TenantContext,
    minutes: Minutes
  ): Promise<void>;

  /**
   * Record a vote taken during a meeting.
   */
  recordVote(
    ctx: TenantContext,
    vote: VoteRecord
  ): Promise<void>;

  /**
   * Cancel a scheduled meeting.
   * @param reason Optional reason for the cancellation.
   */
  cancelMeeting(
    ctx: TenantContext,
    meetingId: string,
    reason?: string
  ): Promise<Meeting>;

  /**
   * Record that public notice has been posted for a meeting.
   *
   * Evaluates Open Door Law compliance per IC 5-14-1.5-5:
   * - Regular meetings require 48 business hours notice (excluding
   *   Saturdays, Sundays, and Indiana state holidays)
   * - Emergency meetings are exempt from the 48-hour requirement
   */
  markNoticePosted(
    ctx: TenantContext,
    input: MarkNoticePostedInput
  ): Promise<Meeting>;

  // Later we can add:
  // - attachAgenda(...)
  // - attachRecording(...)
}

/**
 * AI-enhanced meetings service interface.
 *
 * Extends base MeetingsService with AI-powered features.
 * Implementations require an AiExtractionService dependency.
 */
export interface AiMeetingsService extends MeetingsService {
  /**
   * Generate an AI summary of the meeting for council/board packets.
   *
   * @param agendaText - The agenda/packet text to summarize
   * @returns The updated meeting with aiCouncilSummary populated
   */
  generateCouncilSummary(
    ctx: TenantContext,
    meetingId: string,
    agendaText: string
  ): Promise<Meeting>;

  /**
   * Scan meeting materials for deadlines using AI.
   *
   * Extracted deadlines are stored on the meeting with isConfirmed=false,
   * requiring human review before being treated as authoritative.
   *
   * @param packetText - Meeting packet/agenda text to scan
   * @returns The updated meeting with aiExtractedDeadlines populated
   */
  scanForDeadlines(
    ctx: TenantContext,
    meetingId: string,
    packetText: string
  ): Promise<Meeting>;

  /**
   * Confirm or reject an AI-extracted deadline after human review.
   */
  reviewDeadline(
    ctx: TenantContext,
    meetingId: string,
    deadlineId: string,
    isConfirmed: boolean
  ): Promise<Meeting>;
}