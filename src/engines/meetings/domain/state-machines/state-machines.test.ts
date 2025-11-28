// src/engines/meetings/domain/state-machines/state-machines.test.ts
//
// Unit tests for meeting state machines.

import { describe, it, expect } from 'vitest';
import {
  canTransitionMeeting,
  validateMeetingTransition,
  getValidMeetingTransitions,
  isMeetingTerminal,
  getTargetStateForAction,
} from './meeting.state-machine';
import {
  canTransitionAgenda,
  validateAgendaTransition,
  canTransitionAgendaItem,
} from './agenda.state-machine';
import {
  canTransitionExecSession,
  validateExecSessionTransition,
  isVoteBlocked,
  isExecSessionActive,
  allSessionsCertified,
} from './executive-session.state-machine';
import {
  canTransitionMinutes,
  validateMinutesTransition,
  canEditMinutes,
} from './minutes.state-machine';

describe('Meeting State Machine', () => {
  describe('canTransitionMeeting', () => {
    it('should allow DRAFT to SCHEDULED', () => {
      expect(canTransitionMeeting('DRAFT', 'SCHEDULED')).toBe(true);
    });

    it('should allow DRAFT to CANCELLED', () => {
      expect(canTransitionMeeting('DRAFT', 'CANCELLED')).toBe(true);
    });

    it('should allow SCHEDULED to NOTICED', () => {
      expect(canTransitionMeeting('SCHEDULED', 'NOTICED')).toBe(true);
    });

    it('should allow SCHEDULED to IN_PROGRESS', () => {
      expect(canTransitionMeeting('SCHEDULED', 'IN_PROGRESS')).toBe(true);
    });

    it('should allow IN_PROGRESS to RECESSED', () => {
      expect(canTransitionMeeting('IN_PROGRESS', 'RECESSED')).toBe(true);
    });

    it('should allow IN_PROGRESS to ADJOURNED', () => {
      expect(canTransitionMeeting('IN_PROGRESS', 'ADJOURNED')).toBe(true);
    });

    it('should allow RECESSED to IN_PROGRESS', () => {
      expect(canTransitionMeeting('RECESSED', 'IN_PROGRESS')).toBe(true);
    });

    it('should not allow ADJOURNED to any state', () => {
      expect(canTransitionMeeting('ADJOURNED', 'DRAFT')).toBe(false);
      expect(canTransitionMeeting('ADJOURNED', 'SCHEDULED')).toBe(false);
      expect(canTransitionMeeting('ADJOURNED', 'IN_PROGRESS')).toBe(false);
    });

    it('should allow CANCELLED to DRAFT (resurrect)', () => {
      expect(canTransitionMeeting('CANCELLED', 'DRAFT')).toBe(true);
    });

    it('should not allow invalid transitions', () => {
      expect(canTransitionMeeting('DRAFT', 'ADJOURNED')).toBe(false);
      expect(canTransitionMeeting('NOTICED', 'DRAFT')).toBe(false);
    });
  });

  describe('validateMeetingTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => validateMeetingTransition('DRAFT', 'SCHEDULED')).not.toThrow();
      expect(() => validateMeetingTransition('IN_PROGRESS', 'ADJOURNED')).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => validateMeetingTransition('DRAFT', 'ADJOURNED')).toThrow();
      expect(() => validateMeetingTransition('ADJOURNED', 'DRAFT')).toThrow();
    });

    it('should include valid options in error message', () => {
      try {
        validateMeetingTransition('SCHEDULED', 'ADJOURNED');
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('NOTICED');
        expect((err as Error).message).toContain('IN_PROGRESS');
        expect((err as Error).message).toContain('CANCELLED');
      }
    });
  });

  describe('getValidMeetingTransitions', () => {
    it('should return valid transitions for DRAFT', () => {
      const transitions = getValidMeetingTransitions('DRAFT');
      expect(transitions).toContain('SCHEDULED');
      expect(transitions).toContain('CANCELLED');
    });

    it('should return empty array for ADJOURNED', () => {
      const transitions = getValidMeetingTransitions('ADJOURNED');
      expect(transitions).toHaveLength(0);
    });
  });

  describe('isMeetingTerminal', () => {
    it('should return true for ADJOURNED', () => {
      expect(isMeetingTerminal('ADJOURNED')).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isMeetingTerminal('DRAFT')).toBe(false);
      expect(isMeetingTerminal('IN_PROGRESS')).toBe(false);
      expect(isMeetingTerminal('CANCELLED')).toBe(false);
    });
  });

  describe('getTargetStateForAction', () => {
    it('should return SCHEDULED for SCHEDULE action on DRAFT', () => {
      expect(getTargetStateForAction('DRAFT', 'SCHEDULE')).toBe('SCHEDULED');
    });

    it('should return NOTICED for POST_NOTICE action on SCHEDULED', () => {
      expect(getTargetStateForAction('SCHEDULED', 'POST_NOTICE')).toBe('NOTICED');
    });

    it('should return IN_PROGRESS for START action', () => {
      expect(getTargetStateForAction('SCHEDULED', 'START')).toBe('IN_PROGRESS');
      expect(getTargetStateForAction('NOTICED', 'START')).toBe('IN_PROGRESS');
    });

    it('should return null for invalid actions', () => {
      expect(getTargetStateForAction('ADJOURNED', 'START')).toBeNull();
      expect(getTargetStateForAction('DRAFT', 'ADJOURN')).toBeNull();
    });
  });
});

describe('Agenda State Machine', () => {
  describe('canTransitionAgenda', () => {
    it('should allow DRAFT to PENDING_APPROVAL', () => {
      expect(canTransitionAgenda('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    });

    it('should allow DRAFT to PUBLISHED (skip approval)', () => {
      expect(canTransitionAgenda('DRAFT', 'PUBLISHED')).toBe(true);
    });

    it('should allow APPROVED to PUBLISHED', () => {
      expect(canTransitionAgenda('APPROVED', 'PUBLISHED')).toBe(true);
    });

    it('should not allow PUBLISHED to DRAFT', () => {
      expect(canTransitionAgenda('PUBLISHED', 'DRAFT')).toBe(false);
    });
  });

  describe('validateAgendaTransition', () => {
    it('should throw for invalid transitions', () => {
      expect(() => validateAgendaTransition('PUBLISHED', 'DRAFT')).toThrow();
    });
  });
});

describe('Agenda Item State Machine', () => {
  describe('canTransitionAgendaItem', () => {
    it('should allow PENDING to IN_PROGRESS', () => {
      expect(canTransitionAgendaItem('PENDING', 'IN_PROGRESS')).toBe(true);
    });

    it('should allow IN_PROGRESS to ACTED_UPON', () => {
      expect(canTransitionAgendaItem('IN_PROGRESS', 'ACTED_UPON')).toBe(true);
    });

    it('should allow tabling from multiple states', () => {
      expect(canTransitionAgendaItem('PENDING', 'TABLED')).toBe(true);
      expect(canTransitionAgendaItem('IN_PROGRESS', 'TABLED')).toBe(true);
      expect(canTransitionAgendaItem('DISCUSSED', 'TABLED')).toBe(true);
    });

    it('should not allow transitions from terminal states', () => {
      expect(canTransitionAgendaItem('WITHDRAWN', 'PENDING')).toBe(false);
      expect(canTransitionAgendaItem('ACTED_UPON', 'DISCUSSED')).toBe(false);
    });
  });
});

describe('Executive Session State Machine', () => {
  describe('canTransitionExecSession', () => {
    it('should allow PENDING to IN_SESSION', () => {
      expect(canTransitionExecSession('PENDING', 'IN_SESSION')).toBe(true);
    });

    it('should allow IN_SESSION to ENDED', () => {
      expect(canTransitionExecSession('IN_SESSION', 'ENDED')).toBe(true);
    });

    it('should allow ENDED to CERTIFIED', () => {
      expect(canTransitionExecSession('ENDED', 'CERTIFIED')).toBe(true);
    });

    it('should not allow CERTIFIED to any state', () => {
      expect(canTransitionExecSession('CERTIFIED', 'PENDING')).toBe(false);
      expect(canTransitionExecSession('CERTIFIED', 'IN_SESSION')).toBe(false);
    });
  });

  describe('isVoteBlocked', () => {
    it('should return true when IN_SESSION', () => {
      expect(isVoteBlocked('IN_SESSION')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(isVoteBlocked('PENDING')).toBe(false);
      expect(isVoteBlocked('ENDED')).toBe(false);
      expect(isVoteBlocked('CERTIFIED')).toBe(false);
    });
  });

  describe('isExecSessionActive', () => {
    it('should return true when IN_SESSION', () => {
      expect(isExecSessionActive('IN_SESSION')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(isExecSessionActive('PENDING')).toBe(false);
      expect(isExecSessionActive('ENDED')).toBe(false);
    });
  });

  describe('allSessionsCertified', () => {
    it('should return true when all are certified', () => {
      const sessions = [{ status: 'CERTIFIED' as const }, { status: 'CERTIFIED' as const }];
      expect(allSessionsCertified(sessions)).toBe(true);
    });

    it('should return true when sessions are certified or cancelled', () => {
      const sessions = [{ status: 'CERTIFIED' as const }, { status: 'CANCELLED' as const }];
      expect(allSessionsCertified(sessions)).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(allSessionsCertified([])).toBe(true);
    });

    it('should return false when some are not certified', () => {
      const sessions = [{ status: 'CERTIFIED' as const }, { status: 'ENDED' as const }];
      expect(allSessionsCertified(sessions)).toBe(false);
    });
  });
});

describe('Minutes State Machine', () => {
  describe('canTransitionMinutes', () => {
    it('should allow DRAFT to PENDING_APPROVAL', () => {
      expect(canTransitionMinutes('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    });

    it('should allow PENDING_APPROVAL to APPROVED', () => {
      expect(canTransitionMinutes('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    });

    it('should allow returning to DRAFT from PENDING_APPROVAL', () => {
      expect(canTransitionMinutes('PENDING_APPROVAL', 'DRAFT')).toBe(true);
    });

    it('should allow APPROVED to AMENDED', () => {
      expect(canTransitionMinutes('APPROVED', 'AMENDED')).toBe(true);
    });
  });

  describe('canEditMinutes', () => {
    it('should return true for DRAFT', () => {
      expect(canEditMinutes('DRAFT')).toBe(true);
    });

    it('should return true for PENDING_APPROVAL', () => {
      expect(canEditMinutes('PENDING_APPROVAL')).toBe(true);
    });

    it('should return false for APPROVED', () => {
      expect(canEditMinutes('APPROVED')).toBe(false);
    });

    it('should return false for AMENDED', () => {
      expect(canEditMinutes('AMENDED')).toBe(false);
    });
  });
});
