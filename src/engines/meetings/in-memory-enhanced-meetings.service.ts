// src/engines/meetings/in-memory-enhanced-meetings.service.ts
//
// In-memory implementation of the Enhanced Meetings Service.
// For testing and development purposes.

import { randomUUID } from 'crypto';
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
  MeetingStatus,
  AgendaStatus,
  AgendaItemStatus,
  ExecutiveSessionStatus,
  MinutesStatus,
  ActionResult,
} from './domain/types';
import {
  EnhancedMeetingsService,
  CreateAgendaInput,
  CreateAgendaItemInput,
  UpdateAgendaItemInput,
  CreateExecSessionInput,
  EnterExecSessionInput,
  EndExecSessionInput,
  CreateRecusalInput,
  CreateActionInput,
  SecondActionInput,
  RecordVoteInput,
  CreateMinutesInput,
  UpdateMinutesInput,
  RecordAttendanceInput,
  UploadMediaInput,
} from './enhanced-meetings.service';
import {
  ScheduleMeetingInput,
  MeetingFilter,
  MarkNoticePostedInput,
} from './meetings.service';
import {
  validateMeetingTransition,
  canTransitionMeeting,
  validateAgendaTransition,
  validateExecSessionTransition,
  validateMinutesTransition,
  isExecSessionActive as checkExecSessionActive,
  allSessionsCertified,
} from './domain/state-machines';
import {
  ComplianceError,
  validateVoteNotInExecSession,
  validateNotRecused,
  validateAllExecSessionsCertified,
  assertCompliance,
} from './domain/services/compliance.service';
import {
  calculateQuorum as calcQuorum,
  tallyVotes,
} from './domain/services/quorum.service';
import {
  INDIANA_EXEC_SESSION_BASES,
  getExecSessionBasis,
  MEETINGS_ERROR_CODES,
} from './domain/constants/indiana.constants';

// =============================================================================
// IN-MEMORY STORAGE
// =============================================================================

interface InMemoryStore {
  meetings: Map<string, Meeting>;
  agendas: Map<string, Agenda>;
  agendaItems: Map<string, AgendaItem>;
  execSessions: Map<string, ExecutiveSession>;
  recusals: Map<string, MemberRecusal>;
  actions: Map<string, MeetingAction>;
  votes: Map<string, VoteRecord>;
  attendance: Map<string, MeetingAttendance>;
  minutes: Map<string, Minutes>;
  media: Map<string, MeetingMedia>;
  bodies: Map<string, GoverningBody>;
  locations: Map<string, Location>;
  bundles: Map<string, MeetingRecordBundle>;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export class InMemoryEnhancedMeetingsService implements EnhancedMeetingsService {
  private store: InMemoryStore = {
    meetings: new Map(),
    agendas: new Map(),
    agendaItems: new Map(),
    execSessions: new Map(),
    recusals: new Map(),
    actions: new Map(),
    votes: new Map(),
    attendance: new Map(),
    minutes: new Map(),
    media: new Map(),
    bodies: new Map(),
    locations: new Map(),
    bundles: new Map(),
  };

  constructor(seed?: Partial<InMemoryStore>) {
    if (seed) {
      if (seed.meetings) this.store.meetings = new Map(seed.meetings);
      if (seed.bodies) this.store.bodies = new Map(seed.bodies);
      if (seed.locations) this.store.locations = new Map(seed.locations);
    }
  }

  // ===========================================================================
  // BASE MEETINGS SERVICE METHODS
  // ===========================================================================

  async scheduleMeeting(
    ctx: TenantContext,
    input: ScheduleMeetingInput
  ): Promise<Meeting> {
    const now = new Date();
    const meeting: Meeting = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      bodyId: input.bodyId,
      type: input.type.toUpperCase() as any,
      status: 'SCHEDULED',
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      location: input.location,
      isHybrid: false,
      isEmergency: input.type === 'emergency',
      createdByUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };

    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async getMeeting(ctx: TenantContext, id: string): Promise<Meeting | null> {
    const meeting = this.store.meetings.get(id);
    if (!meeting || meeting.tenantId !== ctx.tenantId) return null;
    return this.hydrateMeeting(meeting);
  }

  async listMeetings(
    ctx: TenantContext,
    filter: MeetingFilter = {}
  ): Promise<MeetingSummary[]> {
    let results = Array.from(this.store.meetings.values()).filter(
      (m) => m.tenantId === ctx.tenantId
    );

    if (filter.bodyId) {
      results = results.filter((m) => m.bodyId === filter.bodyId);
    }
    if (filter.status) {
      results = results.filter(
        (m) => m.status.toLowerCase() === filter.status!.toLowerCase()
      );
    }
    if (filter.fromDate) {
      results = results.filter((m) => m.scheduledStart >= filter.fromDate!);
    }
    if (filter.toDate) {
      results = results.filter((m) => m.scheduledStart <= filter.toDate!);
    }

    return results.map((m) => this.toSummary(m));
  }

  async recordMinutes(
    ctx: TenantContext,
    minutes: { meetingId: string; body?: string; preparedByUserId?: string }
  ): Promise<void> {
    await this.createMinutes(ctx, {
      meetingId: minutes.meetingId,
      body: minutes.body,
    });
  }

  async recordVote(
    ctx: TenantContext,
    vote: { meetingId: string; memberId: string; vote: string }
  ): Promise<void> {
    // This is the legacy method - delegate to new system
    const voteRecord: VoteRecord = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: vote.meetingId,
      memberId: vote.memberId,
      vote: vote.vote.toUpperCase() as any,
      isRecused: false,
      votedAt: new Date(),
    };
    this.store.votes.set(voteRecord.id, voteRecord);
  }

  async cancelMeeting(
    ctx: TenantContext,
    meetingId: string,
    reason?: string
  ): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    if (meeting.status === 'CANCELLED') return meeting;
    if (meeting.status === 'ADJOURNED') {
      throw new Error('Cannot cancel an adjourned meeting');
    }

    validateMeetingTransition(meeting.status, 'CANCELLED');

    meeting.status = 'CANCELLED';
    meeting.cancelledAt = new Date();
    meeting.cancelledByUserId = ctx.userId;
    meeting.cancellationReason = reason;
    meeting.updatedAt = new Date();

    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async markNoticePosted(
    ctx: TenantContext,
    input: MarkNoticePostedInput
  ): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, input.meetingId);
    if (!meeting) throw new Error('Meeting not found');

    meeting.noticePostedAt = input.postedAt;
    meeting.lastNoticePostedAt = input.postedAt;

    if (meeting.status === 'SCHEDULED') {
      meeting.status = 'NOTICED';
    }

    meeting.updatedAt = new Date();
    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  // ===========================================================================
  // GOVERNING BODY MANAGEMENT
  // ===========================================================================

  async getGoverningBody(
    ctx: TenantContext,
    bodyId: string
  ): Promise<GoverningBody | null> {
    const body = this.store.bodies.get(bodyId);
    if (!body || body.tenantId !== ctx.tenantId) return null;
    return body;
  }

  async listGoverningBodies(ctx: TenantContext): Promise<GoverningBody[]> {
    return Array.from(this.store.bodies.values()).filter(
      (b) => b.tenantId === ctx.tenantId
    );
  }

  async getBodyMembers(
    ctx: TenantContext,
    bodyId: string
  ): Promise<GoverningBody> {
    const body = await this.getGoverningBody(ctx, bodyId);
    if (!body) throw new Error('Governing body not found');
    return body;
  }

  // ===========================================================================
  // LOCATION MANAGEMENT
  // ===========================================================================

  async getLocation(
    ctx: TenantContext,
    locationId: string
  ): Promise<Location | null> {
    const location = this.store.locations.get(locationId);
    if (!location || location.tenantId !== ctx.tenantId) return null;
    return location;
  }

  async listLocations(ctx: TenantContext): Promise<Location[]> {
    return Array.from(this.store.locations.values()).filter(
      (l) => l.tenantId === ctx.tenantId
    );
  }

  // ===========================================================================
  // MEETING LIFECYCLE
  // ===========================================================================

  async startMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    validateMeetingTransition(meeting.status, 'IN_PROGRESS');

    meeting.status = 'IN_PROGRESS';
    meeting.actualStart = new Date();
    meeting.updatedAt = new Date();

    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async recessMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    validateMeetingTransition(meeting.status, 'RECESSED');

    meeting.status = 'RECESSED';
    meeting.recessedAt = new Date();
    meeting.updatedAt = new Date();

    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async resumeMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    validateMeetingTransition(meeting.status, 'IN_PROGRESS');

    meeting.status = 'IN_PROGRESS';
    meeting.updatedAt = new Date();

    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async adjournMeeting(ctx: TenantContext, meetingId: string): Promise<Meeting> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    validateMeetingTransition(meeting.status, 'ADJOURNED');

    // CRITICAL: Cannot adjourn if any executive session is pending certification
    // IC 5-14-1.5-6.1 requires certification before meeting can properly conclude
    const execSessions = await this.getExecSessions(ctx, meetingId);
    const uncertified = execSessions.filter(
      (es) => es.status === 'ENDED' || es.status === 'IN_SESSION'
    );
    if (uncertified.length > 0) {
      throw new ComplianceError(
        MEETINGS_ERROR_CODES.EXEC_SESSION_UNCERTIFIED,
        'IC 5-14-1.5-6.1',
        {
          message: 'Cannot adjourn meeting with uncertified executive sessions',
          uncertifiedSessions: uncertified.map((es) => ({
            id: es.id,
            status: es.status,
            basisCode: es.basisCode,
          })),
        }
      );
    }

    meeting.status = 'ADJOURNED';
    meeting.actualEnd = new Date();
    meeting.adjournedAt = new Date();
    meeting.adjournedByUserId = ctx.userId;
    meeting.updatedAt = new Date();

    this.store.meetings.set(meeting.id, meeting);
    return meeting;
  }

  // ===========================================================================
  // AGENDA MANAGEMENT
  // ===========================================================================

  async createAgenda(
    ctx: TenantContext,
    input: CreateAgendaInput
  ): Promise<Agenda> {
    const now = new Date();
    const agenda: Agenda = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      status: 'DRAFT',
      version: 1,
      title: input.title,
      preamble: input.preamble,
      postamble: input.postamble,
      createdByUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };

    this.store.agendas.set(agenda.id, agenda);
    return agenda;
  }

  async getAgenda(
    ctx: TenantContext,
    meetingId: string
  ): Promise<Agenda | null> {
    const agenda = Array.from(this.store.agendas.values()).find(
      (a) => a.meetingId === meetingId && a.tenantId === ctx.tenantId
    );
    if (!agenda) return null;

    // Hydrate with items
    agenda.items = Array.from(this.store.agendaItems.values())
      .filter((i) => i.agendaId === agenda.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return agenda;
  }

  async addAgendaItem(
    ctx: TenantContext,
    input: CreateAgendaItemInput
  ): Promise<AgendaItem> {
    const agenda = this.store.agendas.get(input.agendaId);
    if (!agenda || agenda.tenantId !== ctx.tenantId) {
      throw new Error('Agenda not found');
    }

    const item: AgendaItem = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: agenda.meetingId,
      agendaId: input.agendaId,
      orderIndex: input.orderIndex,
      title: input.title,
      description: input.description,
      status: 'PENDING',
      itemType: input.itemType ?? 'REGULAR',
      parentItemId: input.parentItemId,
      durationMinutes: input.durationMinutes,
      requiresVote: input.requiresVote ?? false,
      requiresPublicHearing: input.requiresPublicHearing ?? false,
      presenterName: input.presenterName,
      presenterUserId: input.presenterUserId,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
    };

    this.store.agendaItems.set(item.id, item);
    return item;
  }

  async updateAgendaItem(
    ctx: TenantContext,
    itemId: string,
    input: UpdateAgendaItemInput
  ): Promise<AgendaItem> {
    const item = this.store.agendaItems.get(itemId);
    if (!item || item.tenantId !== ctx.tenantId) {
      throw new Error('Agenda item not found');
    }

    if (input.title !== undefined) item.title = input.title;
    if (input.description !== undefined) item.description = input.description;
    if (input.orderIndex !== undefined) item.orderIndex = input.orderIndex;
    if (input.status !== undefined) item.status = input.status;
    if (input.discussionNotes !== undefined)
      item.discussionNotes = input.discussionNotes;

    this.store.agendaItems.set(item.id, item);
    return item;
  }

  async removeAgendaItem(ctx: TenantContext, itemId: string): Promise<void> {
    const item = this.store.agendaItems.get(itemId);
    if (!item || item.tenantId !== ctx.tenantId) {
      throw new Error('Agenda item not found');
    }
    this.store.agendaItems.delete(itemId);
  }

  async reorderAgendaItems(
    ctx: TenantContext,
    agendaId: string,
    itemIds: string[]
  ): Promise<Agenda> {
    itemIds.forEach((id, index) => {
      const item = this.store.agendaItems.get(id);
      if (item && item.tenantId === ctx.tenantId) {
        item.orderIndex = index;
        this.store.agendaItems.set(id, item);
      }
    });

    const agenda = this.store.agendas.get(agendaId);
    if (!agenda) throw new Error('Agenda not found');
    return this.getAgenda(ctx, agenda.meetingId) as Promise<Agenda>;
  }

  async submitAgendaForApproval(
    ctx: TenantContext,
    agendaId: string
  ): Promise<Agenda> {
    const agenda = this.store.agendas.get(agendaId);
    if (!agenda || agenda.tenantId !== ctx.tenantId) {
      throw new Error('Agenda not found');
    }

    validateAgendaTransition(agenda.status, 'PENDING_APPROVAL');
    agenda.status = 'PENDING_APPROVAL';
    agenda.updatedAt = new Date();

    this.store.agendas.set(agenda.id, agenda);
    return agenda;
  }

  async approveAgenda(ctx: TenantContext, agendaId: string): Promise<Agenda> {
    const agenda = this.store.agendas.get(agendaId);
    if (!agenda || agenda.tenantId !== ctx.tenantId) {
      throw new Error('Agenda not found');
    }

    validateAgendaTransition(agenda.status, 'APPROVED');
    agenda.status = 'APPROVED';
    agenda.approvedAt = new Date();
    agenda.approvedByUserId = ctx.userId;
    agenda.updatedAt = new Date();

    this.store.agendas.set(agenda.id, agenda);
    return agenda;
  }

  async publishAgenda(ctx: TenantContext, agendaId: string): Promise<Agenda> {
    const agenda = this.store.agendas.get(agendaId);
    if (!agenda || agenda.tenantId !== ctx.tenantId) {
      throw new Error('Agenda not found');
    }

    validateAgendaTransition(agenda.status, 'PUBLISHED');
    agenda.status = 'PUBLISHED';
    agenda.publishedAt = new Date();
    agenda.publishedByUserId = ctx.userId;
    agenda.updatedAt = new Date();

    this.store.agendas.set(agenda.id, agenda);
    return agenda;
  }

  // ===========================================================================
  // EXECUTIVE SESSION MANAGEMENT
  // ===========================================================================

  async createExecSession(
    ctx: TenantContext,
    input: CreateExecSessionInput
  ): Promise<ExecutiveSession> {
    const basis = getExecSessionBasis(input.basisCode);
    if (!basis) {
      throw new Error(`Invalid executive session basis code: ${input.basisCode}`);
    }

    const session: ExecutiveSession = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      status: 'PENDING',
      basisCode: input.basisCode,
      basisDescription: basis.description,
      statutoryCite: basis.cite,
      subject: input.subject,
      scheduledStart: input.scheduledStart,
      createdByUserId: ctx.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.execSessions.set(session.id, session);
    return session;
  }

  async getExecSessions(
    ctx: TenantContext,
    meetingId: string
  ): Promise<ExecutiveSession[]> {
    return Array.from(this.store.execSessions.values()).filter(
      (s) => s.meetingId === meetingId && s.tenantId === ctx.tenantId
    );
  }

  async enterExecSession(
    ctx: TenantContext,
    input: EnterExecSessionInput
  ): Promise<ExecutiveSession> {
    const session = this.store.execSessions.get(input.sessionId);
    if (!session || session.tenantId !== ctx.tenantId) {
      throw new Error('Executive session not found');
    }

    validateExecSessionTransition(session.status, 'IN_SESSION');

    session.status = 'IN_SESSION';
    session.actualStart = new Date();
    session.preCertStatement = input.preCertStatement;
    session.preCertByUserId = ctx.userId;
    session.preCertAt = new Date();
    session.attendeeUserIds = input.attendeeUserIds;
    session.updatedAt = new Date();

    this.store.execSessions.set(session.id, session);
    return session;
  }

  async endExecSession(
    ctx: TenantContext,
    input: EndExecSessionInput
  ): Promise<ExecutiveSession> {
    const session = this.store.execSessions.get(input.sessionId);
    if (!session || session.tenantId !== ctx.tenantId) {
      throw new Error('Executive session not found');
    }

    validateExecSessionTransition(session.status, 'ENDED');

    session.status = 'ENDED';
    session.actualEnd = new Date();
    session.postCertStatement = input.postCertStatement;
    session.postCertByUserId = ctx.userId;
    session.postCertAt = new Date();
    session.updatedAt = new Date();

    this.store.execSessions.set(session.id, session);
    return session;
  }

  async certifyExecSession(
    ctx: TenantContext,
    sessionId: string
  ): Promise<ExecutiveSession> {
    const session = this.store.execSessions.get(sessionId);
    if (!session || session.tenantId !== ctx.tenantId) {
      throw new Error('Executive session not found');
    }

    validateExecSessionTransition(session.status, 'CERTIFIED');

    session.status = 'CERTIFIED';
    session.updatedAt = new Date();

    this.store.execSessions.set(session.id, session);
    return session;
  }

  async cancelExecSession(
    ctx: TenantContext,
    sessionId: string
  ): Promise<ExecutiveSession> {
    const session = this.store.execSessions.get(sessionId);
    if (!session || session.tenantId !== ctx.tenantId) {
      throw new Error('Executive session not found');
    }

    if (session.status !== 'PENDING') {
      throw new Error('Can only cancel pending executive sessions');
    }

    session.status = 'CANCELLED';
    session.updatedAt = new Date();

    this.store.execSessions.set(session.id, session);
    return session;
  }

  async isExecSessionActive(
    ctx: TenantContext,
    meetingId: string
  ): Promise<boolean> {
    const sessions = await this.getExecSessions(ctx, meetingId);
    return sessions.some((s) => checkExecSessionActive(s.status));
  }

  // ===========================================================================
  // RECUSAL MANAGEMENT
  // ===========================================================================

  async recordRecusal(
    ctx: TenantContext,
    input: CreateRecusalInput
  ): Promise<MemberRecusal> {
    const recusal: MemberRecusal = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      memberId: input.memberId,
      reason: input.reason,
      statutoryCite: input.statutoryCite,
      disclosedAt: new Date(),
    };

    this.store.recusals.set(recusal.id, recusal);
    return recusal;
  }

  async getRecusals(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MemberRecusal[]> {
    return Array.from(this.store.recusals.values()).filter(
      (r) => r.meetingId === meetingId && r.tenantId === ctx.tenantId
    );
  }

  async getItemRecusals(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<MemberRecusal[]> {
    return Array.from(this.store.recusals.values()).filter(
      (r) => r.agendaItemId === agendaItemId && r.tenantId === ctx.tenantId
    );
  }

  // ===========================================================================
  // QUORUM MANAGEMENT
  // ===========================================================================

  async calculateQuorum(
    ctx: TenantContext,
    meetingId: string,
    agendaItemId?: string
  ): Promise<QuorumResult> {
    const meeting = await this.getMeeting(ctx, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    const body = await this.getGoverningBody(ctx, meeting.bodyId);
    if (!body) throw new Error('Governing body not found');

    const attendance = await this.getAttendance(ctx, meetingId);
    const recusals = await this.getRecusals(ctx, meetingId);

    return calcQuorum(body, attendance, recusals, agendaItemId);
  }

  async hasQuorum(
    ctx: TenantContext,
    meetingId: string,
    agendaItemId?: string
  ): Promise<boolean> {
    const quorum = await this.calculateQuorum(ctx, meetingId, agendaItemId);
    return quorum.isQuorumMet;
  }

  // ===========================================================================
  // ACTION & VOTING MANAGEMENT
  // ===========================================================================

  async createAction(
    ctx: TenantContext,
    input: CreateActionInput
  ): Promise<MeetingAction> {
    const action: MeetingAction = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      actionType: input.actionType,
      title: input.title,
      description: input.description,
      movedByUserId: input.movedByUserId,
      movedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.actions.set(action.id, action);
    return action;
  }

  async secondAction(
    ctx: TenantContext,
    input: SecondActionInput
  ): Promise<MeetingAction> {
    const action = this.store.actions.get(input.actionId);
    if (!action || action.tenantId !== ctx.tenantId) {
      throw new Error('Action not found');
    }

    action.secondedByUserId = input.secondedByUserId;
    action.updatedAt = new Date();

    this.store.actions.set(action.id, action);
    return action;
  }

  async recordActionVote(
    ctx: TenantContext,
    input: RecordVoteInput
  ): Promise<VoteRecord> {
    const action = this.store.actions.get(input.actionId);
    if (!action || action.tenantId !== ctx.tenantId) {
      throw new Error('Action not found');
    }

    // CRITICAL: Check if executive session is active
    const execSessions = await this.getExecSessions(ctx, action.meetingId);
    const execCheck = validateVoteNotInExecSession(execSessions);
    assertCompliance(execCheck);

    // CRITICAL: Check if member is recused
    const recusals = await this.getRecusals(ctx, action.meetingId);
    const recusalCheck = validateNotRecused(
      input.memberId,
      recusals,
      action.agendaItemId
    );

    // If recused, mark the vote as recused but don't throw
    const isRecused = !recusalCheck.valid;

    const vote: VoteRecord = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: action.meetingId,
      agendaItemId: action.agendaItemId,
      actionId: input.actionId,
      memberId: input.memberId,
      vote: isRecused ? 'RECUSED' : input.vote,
      isRecused,
      votedAt: new Date(),
    };

    this.store.votes.set(vote.id, vote);
    return vote;
  }

  async closeVoting(
    ctx: TenantContext,
    actionId: string
  ): Promise<MeetingAction> {
    const action = this.store.actions.get(actionId);
    if (!action || action.tenantId !== ctx.tenantId) {
      throw new Error('Action not found');
    }

    // Get all votes for this action
    const votes = Array.from(this.store.votes.values()).filter(
      (v) => v.actionId === actionId && v.tenantId === ctx.tenantId
    );

    const recusals = await this.getRecusals(ctx, action.meetingId);
    const tally = tallyVotes(votes, recusals);

    action.result = tally.passed ? 'PASSED' : 'FAILED';
    action.votes = votes;
    action.updatedAt = new Date();

    this.store.actions.set(action.id, action);
    return action;
  }

  async getActions(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingAction[]> {
    return Array.from(this.store.actions.values()).filter(
      (a) => a.meetingId === meetingId && a.tenantId === ctx.tenantId
    );
  }

  // ===========================================================================
  // ATTENDANCE MANAGEMENT
  // ===========================================================================

  async recordAttendance(
    ctx: TenantContext,
    input: RecordAttendanceInput
  ): Promise<MeetingAttendance> {
    const attendance: MeetingAttendance = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      memberId: input.memberId,
      status: input.status,
      arrivedAt: input.arrivedAt ?? new Date(),
      notes: input.notes,
    };

    this.store.attendance.set(attendance.id, attendance);
    return attendance;
  }

  async getAttendance(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingAttendance[]> {
    return Array.from(this.store.attendance.values()).filter(
      (a) => a.meetingId === meetingId && a.tenantId === ctx.tenantId
    );
  }

  async markMemberDeparted(
    ctx: TenantContext,
    meetingId: string,
    memberId: string
  ): Promise<MeetingAttendance> {
    const attendance = Array.from(this.store.attendance.values()).find(
      (a) =>
        a.meetingId === meetingId &&
        a.memberId === memberId &&
        a.tenantId === ctx.tenantId
    );

    if (!attendance) throw new Error('Attendance record not found');

    attendance.status = 'LEFT_EARLY';
    attendance.departedAt = new Date();

    this.store.attendance.set(attendance.id, attendance);
    return attendance;
  }

  // ===========================================================================
  // MINUTES MANAGEMENT
  // ===========================================================================

  async createMinutes(
    ctx: TenantContext,
    input: CreateMinutesInput
  ): Promise<Minutes> {
    const minutes: Minutes = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      status: 'DRAFT',
      version: 1,
      body: input.body,
      preparedByUserId: ctx.userId,
      preparedAt: new Date(),
    };

    this.store.minutes.set(minutes.id, minutes);
    return minutes;
  }

  async getMinutes(
    ctx: TenantContext,
    meetingId: string
  ): Promise<Minutes | null> {
    return (
      Array.from(this.store.minutes.values()).find(
        (m) => m.meetingId === meetingId && m.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async updateMinutes(
    ctx: TenantContext,
    input: UpdateMinutesInput
  ): Promise<Minutes> {
    const minutes = this.store.minutes.get(input.minutesId);
    if (!minutes || minutes.tenantId !== ctx.tenantId) {
      throw new Error('Minutes not found');
    }

    if (input.body !== undefined) minutes.body = input.body;
    if (input.status !== undefined) {
      validateMinutesTransition(minutes.status, input.status);
      minutes.status = input.status;
    }

    this.store.minutes.set(minutes.id, minutes);
    return minutes;
  }

  async submitMinutesForApproval(
    ctx: TenantContext,
    minutesId: string
  ): Promise<Minutes> {
    const minutes = this.store.minutes.get(minutesId);
    if (!minutes || minutes.tenantId !== ctx.tenantId) {
      throw new Error('Minutes not found');
    }

    validateMinutesTransition(minutes.status, 'PENDING_APPROVAL');
    minutes.status = 'PENDING_APPROVAL';

    this.store.minutes.set(minutes.id, minutes);
    return minutes;
  }

  async approveMinutes(
    ctx: TenantContext,
    minutesId: string,
    approvalMeetingId: string
  ): Promise<Minutes> {
    const minutes = this.store.minutes.get(minutesId);
    if (!minutes || minutes.tenantId !== ctx.tenantId) {
      throw new Error('Minutes not found');
    }

    // CRITICAL: Check all executive sessions are certified
    const execSessions = await this.getExecSessions(ctx, minutes.meetingId);
    const certCheck = validateAllExecSessionsCertified(execSessions);
    assertCompliance(certCheck);

    validateMinutesTransition(minutes.status, 'APPROVED');
    minutes.status = 'APPROVED';
    minutes.approvedAt = new Date();
    minutes.approvedByUserId = ctx.userId;
    minutes.approvalMeetingId = approvalMeetingId;

    this.store.minutes.set(minutes.id, minutes);
    return minutes;
  }

  // ===========================================================================
  // MEDIA MANAGEMENT
  // ===========================================================================

  async uploadMedia(
    ctx: TenantContext,
    input: UploadMediaInput
  ): Promise<MeetingMedia> {
    const media: MeetingMedia = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      mediaType: input.mediaType,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      provider: input.provider,
      status: 'AVAILABLE',
      isPublic: true,
      uploadedByUserId: ctx.userId,
      uploadedAt: new Date(),
    };

    this.store.media.set(media.id, media);
    return media;
  }

  async getMedia(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingMedia[]> {
    return Array.from(this.store.media.values()).filter(
      (m) => m.meetingId === meetingId && m.tenantId === ctx.tenantId
    );
  }

  // ===========================================================================
  // RECORD BUNDLE (APRA Compliance)
  // ===========================================================================

  async assembleRecordBundle(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingRecordBundle> {
    const bundle: MeetingRecordBundle = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      meetingId,
      status: 'COMPLETE',
      assembledAt: new Date(),
      assembledByUserId: ctx.userId,
    };

    this.store.bundles.set(bundle.id, bundle);
    return bundle;
  }

  async getRecordBundle(
    ctx: TenantContext,
    meetingId: string
  ): Promise<MeetingRecordBundle | null> {
    return (
      Array.from(this.store.bundles.values()).find(
        (b) => b.meetingId === meetingId && b.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async hydrateMeeting(meeting: Meeting): Promise<Meeting> {
    // Hydrate with related entities
    meeting.agenda = await this.getAgenda(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    ) ?? undefined;
    meeting.executiveSessions = await this.getExecSessions(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    );
    meeting.recusals = await this.getRecusals(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    );
    meeting.attendance = await this.getAttendance(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    );
    meeting.actions = await this.getActions(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    );
    meeting.minutes = await this.getMinutes(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    ) ?? undefined;
    meeting.media = await this.getMedia(
      { tenantId: meeting.tenantId } as TenantContext,
      meeting.id
    );

    return meeting;
  }

  private toSummary(meeting: Meeting): MeetingSummary {
    return {
      id: meeting.id,
      tenantId: meeting.tenantId,
      bodyId: meeting.bodyId,
      type: meeting.type,
      status: meeting.status,
      scheduledStart: meeting.scheduledStart,
      location: meeting.location,
      isEmergency: meeting.isEmergency,
      hasNotice: !!meeting.noticePostedAt,
      hasAgenda: false, // Would need to check
      hasMinutes: false, // Would need to check
    };
  }
}
