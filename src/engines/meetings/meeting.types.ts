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
 * Posting method used for meeting notice (Open Door compliance).
 */
export type NoticePostingMethod = 'physicalBoard' | 'website' | 'newspaper' | 'email' | 'other';

/**
 * Information about how/where notice was posted.
 */
export interface NoticePostingRecord {
  postedAt: Date;
  postedByUserId: string;
  methods: NoticePostingMethod[];
  locations?: string[];        // e.g. ["Town Hall Bulletin Board", "www.townoflapel.org"]
  notes?: string;
}

/**
 * A deadline extracted by AI from meeting packets.
 */
export interface MeetingDeadline {
  id: string;
  description: string;
  dueDate: Date;
  source: string;              // e.g. "Page 3 of agenda packet"
  isConfirmed: boolean;        // staff-reviewed
  reviewedAt?: Date;
  reviewedByUserId?: string;
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

  // Cancellation tracking
  cancelledAt?: Date;
  cancelReason?: string;

  // Notice tracking (Open Door compliance)
  noticePostedAt?: Date;      // when notice was actually posted
  noticeId?: string;          // link into Notice engine later
  noticePosting?: NoticePostingRecord;

  // AI-generated fields
  aiSummary?: string;         // council-friendly summary of agenda
  aiDeadlines?: MeetingDeadline[];  // extracted deadlines from packet
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