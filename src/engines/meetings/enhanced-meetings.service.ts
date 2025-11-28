// src/engines/meetings/enhanced-meetings.service.ts
//
// Enhanced Meetings Service Interface.
// Extends the base MeetingsService with full agenda, executive session,
// quorum, and minutes management capabilities.

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  Meeting,
  MeetingSummary,
  Agenda,
  AgendaItem,
  ExecutiveSession,
  MemberRecusal,
  MeetingAction,
  VoteRecord,
  Minutes,
  MeetingAttendance,
  MeetingMedia,
  QuorumResult,
  GoverningBody,
  Location,
  MeetingRecordBundle,
  AgendaStatus,
  AgendaItemStatus,
  ExecutiveSessionStatus,
  MinutesStatus,
  ActionResult,
  AttendanceStatus,
} from './domain/types';
import { MeetingsService, ScheduleMeetingInput, MeetingFilter } from './meetings.service';

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface CreateAgendaInput {
  meetingId: string;
  title?: string;
  preamble?: string;
  postamble?: string;
}

export interface CreateAgendaItemInput {
  agendaId: string;
  orderIndex: number;
  title: string;
  description?: string;
  itemType?: 'REGULAR' | 'CONSENT' | 'PUBLIC_HEARING' | 'EXECUTIVE_SESSION' | 'CEREMONIAL';
  parentItemId?: string;
  durationMinutes?: number;
  requiresVote?: boolean;
  requiresPublicHearing?: boolean;
  presenterName?: string;
  presenterUserId?: string;
  relatedType?: string;
  relatedId?: string;
}

export interface UpdateAgendaItemInput {
  title?: string;
  description?: string;
  orderIndex?: number;
  status?: AgendaItemStatus;
  discussionNotes?: string;
}

export interface CreateExecSessionInput {
  meetingId: string;
  agendaItemId?: string;
  basisCode: string;
  subject: string;
  scheduledStart?: Date;
}

export interface EnterExecSessionInput {
  sessionId: string;
  preCertStatement: string;
  attendeeUserIds: string[];
}

export interface EndExecSessionInput {
  sessionId: string;
  postCertStatement: string;
}

export interface CreateRecusalInput {
  meetingId: string;
  agendaItemId?: string;
  memberId: string;
  reason?: string;
  statutoryCite?: string;
}

export interface CreateActionInput {
  meetingId: string;
  agendaItemId?: string;
  actionType: 'MOTION' | 'RESOLUTION' | 'ORDINANCE' | 'AMENDMENT' | 'NOMINATION';
  title: string;
  description?: string;
  movedByUserId: string;
}

export interface SecondActionInput {
  actionId: string;
  secondedByUserId: string;
}

export interface RecordVoteInput {
  actionId: string;
  memberId: string;
  vote: 'YEA' | 'NAY' | 'ABSTAIN' | 'ABSENT';
}

export interface CreateMinutesInput {
  meetingId: string;
  body?: string;
}

export interface UpdateMinutesInput {
  minutesId: string;
  body?: string;
  status?: MinutesStatus;
}

export interface RecordAttendanceInput {
  meetingId: string;
  memberId: string;
  status: AttendanceStatus;
  arrivedAt?: Date;
  notes?: string;
}

export interface UploadMediaInput {
  meetingId: string;
  mediaType: 'VIDEO' | 'AUDIO' | 'PRESENTATION' | 'DOCUMENT';
  title: string;
  description?: string;
  externalUrl?: string;
  provider?: string;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Enhanced Meetings Service with full feature set.
 *
 * Implements:
 * - Agenda management with status workflow
 * - Executive session management with vote blocking
 * - Quorum calculation with recusals
 * - Meeting actions and voting
 * - Minutes with approval workflow
 * - Attendance tracking
 * - Media management
 */
export interface EnhancedMeetingsService extends MeetingsService {
  // ===========================================================================
  // GOVERNING BODY MANAGEMENT
  // ===========================================================================

  /**
   * Get a governing body by ID.
   */
  getGoverningBody(
    ctx: TenantContext,
    bodyId: string
  ): Promise<GoverningBody | null>;

  /**
   * List governing bodies for a tenant.
   */
  listGoverningBodies(ctx: TenantContext): Promise<GoverningBody[]>;

  /**
   * Get members of a governing body.
   */
  getBodyMembers(
    ctx: TenantContext,
    bodyId: string
  ): Promise<GoverningBody>;

  // ===========================================================================
  // LOCATION MANAGEMENT
  // ===========================================================================

  /**
   * Get a location by ID.
   */
  getLocation(ctx: TenantContext, locationId: string): Promise<Location | null>;

  /**
   * List locations for a tenant.
   */
  listLocations(ctx: TenantContext): Promise<Location[]>;

  // ===========================================================================
  // MEETING LIFECYCLE (extensions)
  // ===========================================================================

  /**
   * Start a meeting (transition to IN_PROGRESS).
   */
  startMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting>;

  /**
   * Recess a meeting (transition to RECESSED).
   */
  recessMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting>;

  /**
   * Resume a recessed meeting (transition back to IN_PROGRESS).
   */
  resumeMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting>;

  /**
   * Adjourn a meeting (transition to ADJOURNED).
   */
  adjournMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting>;

  // ===========================================================================
  // AGENDA MANAGEMENT
  // ===========================================================================

  /**
   * Create an agenda for a meeting.
   */
  createAgenda(ctx: TenantContext, input: CreateAgendaInput): Promise<Agenda>;

  /**
   * Get the agenda for a meeting.
   */
  getAgenda(ctx: TenantContext, meetingId: string): Promise<Agenda | null>;

  /**
   * Add an item to an agenda.
   */
  addAgendaItem(
    ctx: TenantContext,
    input: CreateAgendaItemInput
  ): Promise<AgendaItem>;

  /**
   * Update an agenda item.
   */
  updateAgendaItem(
    ctx: TenantContext,
    itemId: string,
    input: UpdateAgendaItemInput
  ): Promise<AgendaItem>;

  /**
   * Remove an agenda item.
   */
  removeAgendaItem(ctx: TenantContext, itemId: string): Promise<void>;

  /**
   * Reorder agenda items.
   */
  reorderAgendaItems(
    ctx: TenantContext,
    agendaId: string,
    itemIds: string[]
  ): Promise<Agenda>;

  /**
   * Submit agenda for approval.
   */
  submitAgendaForApproval(
    ctx: TenantContext,
    agendaId: string
  ): Promise<Agenda>;

  /**
   * Approve an agenda.
   */
  approveAgenda(ctx: TenantContext, agendaId: string): Promise<Agenda>;

  /**
   * Publish an agenda.
   */
  publishAgenda(ctx: TenantContext, agendaId: string): Promise<Agenda>;

  // ===========================================================================
  // EXECUTIVE SESSION MANAGEMENT
  // ===========================================================================

  /**
   * Create an executive session for a meeting.
   */
  createExecSession(
    ctx: TenantContext,
    input: CreateExecSessionInput
  ): Promise<ExecutiveSession>;

  /**
   * Get executive sessions for a meeting.
   */
  getExecSessions(
    ctx: TenantContext,
    meetingId: string
  ): Promise<ExecutiveSession[]>;

  /**
   * Enter an executive session (with pre-certification).
   * Blocks voting until session ends.
   */
  enterExecSession(
    ctx: TenantContext,
    input: EnterExecSessionInput
  ): Promise<ExecutiveSession>;

  /**
   * End an executive session (with post-certification).
   * Unblocks voting.
   */
  endExecSession(
    ctx: TenantContext,
    input: EndExecSessionInput
  ): Promise<ExecutiveSession>;

  /**
   * Certify an ended executive session.
   */
  certifyExecSession(
    ctx: TenantContext,
    sessionId: string
  ): Promise<ExecutiveSession>;

  /**
   * Cancel an executive session.
   */
  cancelExecSession(
    ctx: TenantContext,
    sessionId: string
  ): Promise<ExecutiveSession>;

  /**
   * Check if any executive session is active (blocking votes).
   */
  isExecSessionActive(ctx: TenantContext, meetingId: string): Promise<boolean>;

  // ===========================================================================
  // RECUSAL MANAGEMENT
  // ===========================================================================

  /**
   * Record a member recusal.
   */
  recordRecusal(
    ctx: TenantContext,
    input: CreateRecusalInput
  ): Promise<MemberRecusal>;

  /**
   * Get recusals for a meeting.
   */
  getRecusals(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MemberRecusal[]>;

  /**
   * Get recusals for an agenda item.
   */
  getItemRecusals(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<MemberRecusal[]>;

  // ===========================================================================
  // QUORUM MANAGEMENT
  // ===========================================================================

  /**
   * Calculate quorum for a meeting.
   */
  calculateQuorum(
    ctx: TenantContext,
    meetingId: string,
    agendaItemId?: string
  ): Promise<QuorumResult>;

  /**
   * Check if quorum is present.
   */
  hasQuorum(
    ctx: TenantContext,
    meetingId: string,
    agendaItemId?: string
  ): Promise<boolean>;

  // ===========================================================================
  // ACTION & VOTING MANAGEMENT
  // ===========================================================================

  /**
   * Create a meeting action (motion, resolution, etc.).
   */
  createAction(
    ctx: TenantContext,
    input: CreateActionInput
  ): Promise<MeetingAction>;

  /**
   * Second a motion.
   */
  secondAction(
    ctx: TenantContext,
    input: SecondActionInput
  ): Promise<MeetingAction>;

  /**
   * Record a vote on an action.
   * Validates that no exec session is active and member is not recused.
   */
  recordActionVote(
    ctx: TenantContext,
    input: RecordVoteInput
  ): Promise<VoteRecord>;

  /**
   * Complete voting on an action and determine result.
   */
  closeVoting(
    ctx: TenantContext,
    actionId: string
  ): Promise<MeetingAction>;

  /**
   * Get actions for a meeting.
   */
  getActions(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingAction[]>;

  // ===========================================================================
  // ATTENDANCE MANAGEMENT
  // ===========================================================================

  /**
   * Record member attendance.
   */
  recordAttendance(
    ctx: TenantContext,
    input: RecordAttendanceInput
  ): Promise<MeetingAttendance>;

  /**
   * Get attendance for a meeting.
   */
  getAttendance(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingAttendance[]>;

  /**
   * Mark a member as departed.
   */
  markMemberDeparted(
    ctx: TenantContext,
    meetingId: string,
    memberId: string
  ): Promise<MeetingAttendance>;

  // ===========================================================================
  // MINUTES MANAGEMENT
  // ===========================================================================

  /**
   * Create minutes for a meeting.
   */
  createMinutes(
    ctx: TenantContext,
    input: CreateMinutesInput
  ): Promise<Minutes>;

  /**
   * Get minutes for a meeting.
   */
  getMinutes(ctx: TenantContext, meetingId: string): Promise<Minutes | null>;

  /**
   * Update minutes.
   */
  updateMinutes(
    ctx: TenantContext,
    input: UpdateMinutesInput
  ): Promise<Minutes>;

  /**
   * Submit minutes for approval.
   */
  submitMinutesForApproval(
    ctx: TenantContext,
    minutesId: string
  ): Promise<Minutes>;

  /**
   * Approve minutes (validates all exec sessions certified).
   */
  approveMinutes(
    ctx: TenantContext,
    minutesId: string,
    approvalMeetingId: string
  ): Promise<Minutes>;

  // ===========================================================================
  // MEDIA MANAGEMENT
  // ===========================================================================

  /**
   * Upload media for a meeting.
   */
  uploadMedia(
    ctx: TenantContext,
    input: UploadMediaInput
  ): Promise<MeetingMedia>;

  /**
   * Get media for a meeting.
   */
  getMedia(ctx: TenantContext, meetingId: string): Promise<MeetingMedia[]>;

  // ===========================================================================
  // RECORD BUNDLE (APRA Compliance)
  // ===========================================================================

  /**
   * Assemble a record bundle for a meeting.
   */
  assembleRecordBundle(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingRecordBundle>;

  /**
   * Get the record bundle for a meeting.
   */
  getRecordBundle(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingRecordBundle | null>;
}
