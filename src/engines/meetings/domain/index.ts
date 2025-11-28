// src/engines/meetings/domain/index.ts
//
// Re-exports all domain components for the meetings module.

// Types
export * from './types';

// State machines
export * from './state-machines';

// Constants
export * from './constants/indiana.constants';
export * from './constants/audit-actions';

// Services - explicit exports to avoid naming conflicts
// Compliance service exports (excluding calculateQuorum which is in quorum.service)
export {
  ComplianceError,
  ComplianceOptions,
  ValidationResult,
  validateOpenDoorNotice,
  validateVoteNotInExecSession,
  validateAllExecSessionsCertified,
  validateExecSessionPreCert,
  validateExecSessionPostCert,
  validateQuorum,
  validateNotRecused,
  filterRecusedVotes,
  validateActionHasSecond,
  validateMinutesApproval,
  validateMeetingSchedule,
  assertCompliance,
  validateFindingsComplete,
  validateApprovalSupported,
  validateDenialSupported,
  validateFindingsForAction,
  validateFindingsNotLocked,
} from './services/compliance.service';

// Quorum service - calculateQuorum is the canonical implementation
export {
  VoteTally,
  calculateQuorum,
  calculateRequiredQuorum,
  tallyVotes,
  didMotionPass,
  didSuperMajorityPass,
  formatVoteTally,
  haveAllMembersVoted,
  getMembersNotVoted,
} from './services/quorum.service';

// Notice & Publication Engine Services
export * from './services/publication-rule.service';
export * from './services/newspaper-schedule.service';
export * from './services/deadline-calculator.service';
export * from './services/notice-requirement.service';

// Findings of Fact Engine Services
export * from './services/findings-template.service';
export * from './services/findings.service';
