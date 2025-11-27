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

  noticePostedAt?: Date;      // when notice was actually posted
  noticeId?: string;          // link into Notice engine later

  cancelledAt?: Date;         // when meeting was cancelled
  cancelledByUserId?: string; // who cancelled it

  aiCouncilSummary?: string;  // AI-generated summary of agenda
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