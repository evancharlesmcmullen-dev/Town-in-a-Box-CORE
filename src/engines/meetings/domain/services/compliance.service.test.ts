// src/engines/meetings/domain/services/compliance.service.test.ts
//
// Unit tests for compliance validation service.
// Tests the critical Indiana statutory requirements.

import { describe, it, expect } from 'vitest';
import {
  ComplianceError,
  validateOpenDoorNotice,
  validateVoteNotInExecSession,
  validateAllExecSessionsCertified,
  validateNotRecused,
  validateQuorum,
  validateMinutesApproval,
  validateMeetingSchedule,
  filterRecusedVotes,
  assertCompliance,
} from './compliance.service';
import {
  Meeting,
  ExecutiveSession,
  MemberRecusal,
  VoteRecord,
  QuorumResult,
} from '../types';
import { MEETINGS_ERROR_CODES } from '../constants/indiana.constants';

describe('Compliance Service', () => {
  // ===========================================================================
  // OPEN DOOR LAW VALIDATION
  // ===========================================================================

  describe('validateOpenDoorNotice', () => {
    it('should pass for emergency meetings regardless of timing', () => {
      const meeting: Partial<Meeting> = {
        id: 'meeting-1',
        isEmergency: true,
        scheduledStart: new Date('2025-02-10T19:00:00'),
      };
      const postedAt = new Date('2025-02-10T18:00:00'); // 1 hour before

      const result = validateOpenDoorNotice(meeting as Meeting, postedAt);
      expect(result.valid).toBe(true);
    });

    it('should pass when notice is posted with sufficient lead time', () => {
      const meeting: Partial<Meeting> = {
        id: 'meeting-1',
        isEmergency: false,
        scheduledStart: new Date('2025-02-10T19:00:00'),
      };
      const postedAt = new Date('2025-02-07T10:00:00'); // 81 hours before

      const result = validateOpenDoorNotice(meeting as Meeting, postedAt);
      expect(result.valid).toBe(true);
    });

    it('should fail when notice is posted with insufficient lead time', () => {
      const meeting: Partial<Meeting> = {
        id: 'meeting-1',
        isEmergency: false,
        scheduledStart: new Date('2025-02-10T19:00:00'),
      };
      const postedAt = new Date('2025-02-10T10:00:00'); // 9 hours before

      const result = validateOpenDoorNotice(meeting as Meeting, postedAt);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.INSUFFICIENT_NOTICE);
      expect(result.statutoryCite).toBe('IC 5-14-1.5-5');
    });

    it('should include details in error result', () => {
      const meeting: Partial<Meeting> = {
        id: 'meeting-1',
        isEmergency: false,
        scheduledStart: new Date('2025-02-10T19:00:00'),
      };
      const postedAt = new Date('2025-02-09T19:00:00'); // 24 hours before

      const result = validateOpenDoorNotice(meeting as Meeting, postedAt);
      expect(result.valid).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details?.requiredHours).toBe(48);
      expect(result.details?.actualHours).toBe(24);
    });
  });

  // ===========================================================================
  // EXECUTIVE SESSION VALIDATION
  // ===========================================================================

  describe('validateVoteNotInExecSession', () => {
    it('should pass when no executive sessions are active', () => {
      const sessions: ExecutiveSession[] = [
        { status: 'CERTIFIED' } as ExecutiveSession,
        { status: 'ENDED' } as ExecutiveSession,
      ];

      const result = validateVoteNotInExecSession(sessions);
      expect(result.valid).toBe(true);
    });

    it('should fail when an executive session is active', () => {
      const sessions: ExecutiveSession[] = [
        { id: 'session-1', status: 'IN_SESSION', basisCode: 'PERSONNEL' } as ExecutiveSession,
      ];

      const result = validateVoteNotInExecSession(sessions);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.VOTE_DURING_EXEC_SESSION);
      expect(result.statutoryCite).toBe('IC 5-14-1.5-6.1');
    });

    it('should include active session details in error', () => {
      const sessions: ExecutiveSession[] = [
        { id: 'session-1', status: 'IN_SESSION', basisCode: 'LITIGATION' } as ExecutiveSession,
      ];

      const result = validateVoteNotInExecSession(sessions);
      expect(result.details?.activeSessionId).toBe('session-1');
      expect(result.details?.sessionBasis).toBe('LITIGATION');
    });
  });

  describe('validateAllExecSessionsCertified', () => {
    it('should pass when all sessions are certified', () => {
      const sessions: ExecutiveSession[] = [
        { status: 'CERTIFIED' } as ExecutiveSession,
        { status: 'CERTIFIED' } as ExecutiveSession,
      ];

      const result = validateAllExecSessionsCertified(sessions);
      expect(result.valid).toBe(true);
    });

    it('should pass when sessions are either certified or cancelled', () => {
      const sessions: ExecutiveSession[] = [
        { status: 'CERTIFIED' } as ExecutiveSession,
        { status: 'CANCELLED' } as ExecutiveSession,
      ];

      const result = validateAllExecSessionsCertified(sessions);
      expect(result.valid).toBe(true);
    });

    it('should pass when there are no sessions', () => {
      const result = validateAllExecSessionsCertified([]);
      expect(result.valid).toBe(true);
    });

    it('should fail when a session is not certified', () => {
      const sessions: ExecutiveSession[] = [
        { id: 'session-1', status: 'CERTIFIED', basisCode: 'PERSONNEL' } as ExecutiveSession,
        { id: 'session-2', status: 'ENDED', basisCode: 'LITIGATION' } as ExecutiveSession,
      ];

      const result = validateAllExecSessionsCertified(sessions);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.EXEC_SESSION_UNCERTIFIED);
    });

    it('should include uncertified sessions in error details', () => {
      const sessions: ExecutiveSession[] = [
        { id: 'session-1', status: 'ENDED', basisCode: 'PERSONNEL' } as ExecutiveSession,
        { id: 'session-2', status: 'PENDING', basisCode: 'LITIGATION' } as ExecutiveSession,
      ];

      const result = validateAllExecSessionsCertified(sessions);
      expect(result.details?.uncertifiedSessions).toHaveLength(2);
    });
  });

  // ===========================================================================
  // RECUSAL VALIDATION
  // ===========================================================================

  describe('validateNotRecused', () => {
    it('should pass when member is not recused', () => {
      const recusals: MemberRecusal[] = [
        { memberId: 'member-1', agendaItemId: 'item-1' } as MemberRecusal,
      ];

      const result = validateNotRecused('member-2', recusals, 'item-1');
      expect(result.valid).toBe(true);
    });

    it('should fail when member is recused for the item', () => {
      const recusals: MemberRecusal[] = [
        { memberId: 'member-1', agendaItemId: 'item-1' } as MemberRecusal,
      ];

      const result = validateNotRecused('member-1', recusals, 'item-1');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.RECUSED_MEMBER_VOTE);
      expect(result.statutoryCite).toBe('IC 35-44.1-1-4');
    });

    it('should fail when member is recused for entire meeting', () => {
      const recusals: MemberRecusal[] = [
        { memberId: 'member-1', agendaItemId: undefined } as MemberRecusal,
      ];

      const result = validateNotRecused('member-1', recusals, 'item-5');
      expect(result.valid).toBe(false);
    });

    it('should pass when member recusal is for different item', () => {
      const recusals: MemberRecusal[] = [
        { memberId: 'member-1', agendaItemId: 'item-1' } as MemberRecusal,
      ];

      const result = validateNotRecused('member-1', recusals, 'item-2');
      expect(result.valid).toBe(true);
    });
  });

  describe('filterRecusedVotes', () => {
    it('should filter out votes from recused members', () => {
      const votes: VoteRecord[] = [
        { memberId: 'member-1', vote: 'YEA' } as VoteRecord,
        { memberId: 'member-2', vote: 'NAY' } as VoteRecord,
        { memberId: 'member-3', vote: 'YEA' } as VoteRecord,
      ];
      const recusals: MemberRecusal[] = [
        { memberId: 'member-2', agendaItemId: 'item-1' } as MemberRecusal,
      ];

      const filtered = filterRecusedVotes(votes, recusals, 'item-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.map((v) => v.memberId)).toEqual(['member-1', 'member-3']);
    });

    it('should filter votes for meeting-wide recusals', () => {
      const votes: VoteRecord[] = [
        { memberId: 'member-1', vote: 'YEA' } as VoteRecord,
        { memberId: 'member-2', vote: 'NAY' } as VoteRecord,
      ];
      const recusals: MemberRecusal[] = [
        { memberId: 'member-2', agendaItemId: undefined } as MemberRecusal,
      ];

      const filtered = filterRecusedVotes(votes, recusals, 'item-5');
      expect(filtered).toHaveLength(1);
    });
  });

  // ===========================================================================
  // QUORUM VALIDATION
  // ===========================================================================

  describe('validateQuorum', () => {
    it('should pass when quorum is met', () => {
      const quorum: QuorumResult = {
        isQuorumMet: true,
        totalMembers: 5,
        presentMembers: 4,
        recusedMembers: 0,
        requiredForQuorum: 3,
        eligibleVoters: 4,
      };

      const result = validateQuorum(quorum);
      expect(result.valid).toBe(true);
    });

    it('should fail when quorum is not met', () => {
      const quorum: QuorumResult = {
        isQuorumMet: false,
        totalMembers: 5,
        presentMembers: 2,
        recusedMembers: 0,
        requiredForQuorum: 3,
        eligibleVoters: 2,
      };

      const result = validateQuorum(quorum);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.NO_QUORUM);
    });

    it('should include quorum details in error', () => {
      const quorum: QuorumResult = {
        isQuorumMet: false,
        totalMembers: 7,
        presentMembers: 3,
        recusedMembers: 1,
        requiredForQuorum: 4,
        eligibleVoters: 2,
      };

      const result = validateQuorum(quorum);
      expect(result.message).toContain('Required: 4');
      expect(result.message).toContain('Present: 3');
      expect(result.message).toContain('Eligible (minus recused): 2');
    });
  });

  // ===========================================================================
  // MINUTES APPROVAL VALIDATION
  // ===========================================================================

  describe('validateMinutesApproval', () => {
    it('should pass when all exec sessions are certified', () => {
      const meeting: Partial<Meeting> = {
        executiveSessions: [
          { status: 'CERTIFIED' } as ExecutiveSession,
          { status: 'CANCELLED' } as ExecutiveSession,
        ],
      };

      const result = validateMinutesApproval(meeting as Meeting);
      expect(result.valid).toBe(true);
    });

    it('should fail when exec sessions are not certified', () => {
      const meeting: Partial<Meeting> = {
        executiveSessions: [
          { id: 'session-1', status: 'ENDED', basisCode: 'PERSONNEL' } as ExecutiveSession,
        ],
      };

      const result = validateMinutesApproval(meeting as Meeting);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.EXEC_SESSION_UNCERTIFIED);
    });
  });

  // ===========================================================================
  // MEETING SCHEDULE VALIDATION
  // ===========================================================================

  describe('validateMeetingSchedule', () => {
    it('should pass for emergency meetings', () => {
      const meeting: Partial<Meeting> = {
        isEmergency: true,
        scheduledStart: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
      };

      const result = validateMeetingSchedule(meeting);
      expect(result.valid).toBe(true);
    });

    it('should pass when scheduling with sufficient lead time', () => {
      const meeting: Partial<Meeting> = {
        isEmergency: false,
        scheduledStart: new Date(Date.now() + 1000 * 60 * 60 * 72), // 72 hours from now
      };

      const result = validateMeetingSchedule(meeting);
      expect(result.valid).toBe(true);
    });

    it('should fail when scheduling without sufficient lead time', () => {
      const meeting: Partial<Meeting> = {
        isEmergency: false,
        scheduledStart: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      };

      const result = validateMeetingSchedule(meeting);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.INSUFFICIENT_NOTICE);
    });

    it('should fail when scheduledStart is missing', () => {
      const meeting: Partial<Meeting> = {
        isEmergency: false,
      };

      const result = validateMeetingSchedule(meeting);
      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // ASSERT COMPLIANCE
  // ===========================================================================

  describe('assertCompliance', () => {
    it('should not throw for valid results', () => {
      expect(() => assertCompliance({ valid: true })).not.toThrow();
    });

    it('should throw ComplianceError for invalid results', () => {
      const result = {
        valid: false,
        error: MEETINGS_ERROR_CODES.INSUFFICIENT_NOTICE as any,
        statutoryCite: 'IC 5-14-1.5-5',
        details: { hours: 24 },
      };

      expect(() => assertCompliance(result)).toThrow(ComplianceError);
    });

    it('should include error details in thrown exception', () => {
      const result = {
        valid: false,
        error: MEETINGS_ERROR_CODES.VOTE_DURING_EXEC_SESSION as any,
        statutoryCite: 'IC 5-14-1.5-6.1',
        details: { sessionId: 'session-1' },
      };

      try {
        assertCompliance(result);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ComplianceError);
        const ce = err as ComplianceError;
        expect(ce.code).toBe(MEETINGS_ERROR_CODES.VOTE_DURING_EXEC_SESSION);
        expect(ce.statutoryCite).toBe('IC 5-14-1.5-6.1');
        expect(ce.details?.sessionId).toBe('session-1');
      }
    });
  });
});
