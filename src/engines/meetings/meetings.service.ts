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

// Input for cancelling a meeting.
export interface CancelMeetingInput {
  reason?: string;
}

// Result of marking notice posted, includes compliance info.
export interface NoticePostedResult {
  meeting: Meeting;
  isCompliant: boolean;
  deadline: Date;
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
   * - Idempotent: returns the meeting unchanged if already cancelled.
   * - Throws if meeting is adjourned (cannot cancel a completed meeting).
   */
  cancelMeeting(
    ctx: TenantContext,
    id: string,
    input?: CancelMeetingInput
  ): Promise<Meeting>;

  /**
   * Mark that Open Door notice has been posted for a meeting.
   * Updates status to 'noticed' if currently 'planned'.
   * Validates 48 business hour compliance (IC 5-14-1.5-5).
   *
   * @param postedAt - When the notice was posted (defaults to now)
   * @returns The updated meeting and compliance info
   */
  markNoticePosted(
    ctx: TenantContext,
    id: string,
    postedAt?: Date
  ): Promise<NoticePostedResult>;

  // Future additions:
  // - attachAgenda(...)
  // - attachRecording(...)
}