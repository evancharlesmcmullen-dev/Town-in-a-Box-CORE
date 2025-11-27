// src/engines/meetings/meeting.types.ts

// Types for meetings, governing bodies, agendas, and minutes.
// These are engine-agnostic and don't depend on storage.

/**
 * A governing body such as a Town Council, Plan Commission, BZA, Utility Board, etc.
 */
export interface GoverningBody {
  id: string;
  tenantId: string;
  name: string;                // e.g. "Town Council", "Plan Commission"
  code?: string;               // e.g. "COUNCIL", "PLANCOM", "BZA"
}

/**
 * High-level type of a meeting.
 */
export type MeetingType =
  | 'regular'
  | 'special'
  | 'emergency'
  | 'executiveSession';

/**
 * Lifecycle status of a meeting.
 */
export type MeetingStatus =
  | 'planned'
  | 'noticed'
  | 'inSession'
  | 'adjourned'
  | 'cancelled';

/**
 * A single agenda item for a meeting.
 */
export interface AgendaItem {
  id: string;
  meetingId: string;
  order: number;
  title: string;
  description?: string;
  // Later: links to cases (APRA, Planning, etc.) or legislative items.
}

/**
 * Minutes summary for a meeting.
 */
export interface Minutes {
  meetingId: string;
  preparedByUserId?: string;
  preparedAt?: Date;
  approvedAt?: Date;
  // For now we just store a free-text body; later we can add structured motions/votes.
  body?: string;
}

/**
 * A single recorded vote by a member of a governing body.
 */
export type VoteValue = 'yes' | 'no' | 'abstain' | 'absent';

export interface VoteRecord {
  id: string;
  meetingId: string;
  agendaItemId?: string;      // optional if it's a general vote
  memberId: string;           // Person/User ID representing the member
  vote: VoteValue;
  votedAt: Date;
}

/**
 * Method used to post public notice of a meeting.
 */
export type NoticeMethod =
  | 'PHYSICAL_POSTING'
  | 'WEBSITE'
  | 'NEWSPAPER'
  | 'EMAIL_LIST';

/**
 * A record of public notice being posted for a meeting.
 * Supports Open Door Law compliance tracking.
 */
export interface MeetingNotice {
  id: string;
  meetingId: string;
  postedAt: Date;
  postedByUserId: string;

  // Where/how notice was posted
  methods: NoticeMethod[];
  locations: string[];        // e.g. ["Town Hall bulletin board", "www.townoflapel.com/meetings"]
  proofUris?: string[];       // file storage URLs / screenshots / signed receipts

  // Compliance info
  requiredLeadTimeHours: number;  // typically 48 for regular meetings
  isTimely: boolean;              // computed: was notice posted with sufficient lead time?
  notes?: string;                 // e.g. "Emergency meeting – posted ASAP"
}

/**
 * Timeliness status for Open Door Law compliance.
 */
export type OpenDoorTimeliness = 'COMPLIANT' | 'LATE' | 'UNKNOWN';

/**
 * Open Door Law compliance status for a meeting.
 *
 * Per IC 5-14-1.5-5, notice must be posted "at least 48 hours
 * (excluding Saturdays, Sundays, and legal holidays)" before the meeting.
 */
export interface OpenDoorCompliance {
  /** Overall compliance status. */
  timeliness: OpenDoorTimeliness;
  /** When notice should have been posted by (ISO 8601). */
  requiredPostedBy?: string;
  /** When notice was actually posted (ISO 8601). */
  actualPostedAt?: string;
  /** Additional notes (e.g., "Emergency meeting - different rules apply"). */
  notes?: string;
  /** When this compliance check was last performed. */
  lastCheckedAt: Date;
}

/**
 * A deadline extracted from meeting materials by AI.
 * Requires human review before being treated as authoritative.
 */
export interface MeetingDeadline {
  id: string;
  meetingId: string;
  /** Brief description of the deadline. */
  label: string;
  /** Due date (ISO 8601 date string, e.g., "2025-02-15"). */
  dueDate: string;
  /** AI confidence in this extraction (0-1). */
  confidence?: number;
  /** Has a human reviewed and confirmed this deadline? */
  reviewedByUserId?: string;
  /** When the deadline was confirmed (or rejected). */
  reviewedAt?: string;
  /** Was the deadline confirmed as accurate? */
  isConfirmed?: boolean;
}

/**
 * A governing body's meeting (single date/time/session).
 */
export interface Meeting {
  id: string;
  tenantId: string;
  bodyId: string;             // GoverningBody.id

  type: MeetingType;
  status: MeetingStatus;

  scheduledStart: Date;
  scheduledEnd?: Date;
  location: string;

  createdByUserId?: string;
  createdAt: Date;

  // Notice tracking for Open Door Law compliance
  notices?: MeetingNotice[];
  noticePostedAt?: Date;      // when first notice was posted (backward compat)
  lastNoticePostedAt?: Date;
  noticeId?: string;          // link into Notice engine later
  openDoorCompliance?: OpenDoorCompliance;

  cancelledAt?: Date;         // when meeting was cancelled (if status=cancelled)
  cancelledByUserId?: string; // who cancelled it
  cancellationReason?: string; // optional reason for cancellation

  // AI-generated content
  aiCouncilSummary?: string;           // AI-generated summary for council packet
  aiSummaryGeneratedAt?: string;       // ISO 8601 timestamp
  aiExtractedDeadlines?: MeetingDeadline[];  // Deadlines extracted from agenda/packet
}

/**
 * Lightweight meeting summary for list views.
 */
export interface MeetingSummary {
  id: string;
  tenantId: string;
  bodyId: string;
  type: MeetingType;
  status: MeetingStatus;
  scheduledStart: Date;
  location: string;
}
