// src/engines/meetings/domain/services/quorum.service.ts
//
// Quorum calculation and management service.

import {
  GoverningBody,
  MeetingAttendance,
  MemberRecusal,
  QuorumResult,
  QuorumType,
  VoteRecord,
  VoteValue,
} from '../types';

/**
 * Vote tally result.
 */
export interface VoteTally {
  yea: number;
  nay: number;
  abstain: number;
  absent: number;
  recused: number;
  total: number;
  passed: boolean;
  margin: number;
}

/**
 * Calculate quorum for a meeting or agenda item.
 *
 * @param body The governing body
 * @param attendance Attendance records for the meeting
 * @param recusals Recusal records (optionally filtered by agenda item)
 * @param agendaItemId Optional agenda item ID for item-level quorum
 */
export function calculateQuorum(
  body: GoverningBody,
  attendance: MeetingAttendance[],
  recusals: MemberRecusal[] = [],
  agendaItemId?: string
): QuorumResult {
  const totalMembers = body.totalSeats;

  // Count present members (PRESENT or LATE counts as present)
  const presentMembers = attendance.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE'
  ).length;

  // Count recused members for this specific item or entire meeting
  const relevantRecusals = agendaItemId
    ? recusals.filter(
        (r) => r.agendaItemId === agendaItemId || r.agendaItemId === null
      )
    : recusals.filter((r) => r.agendaItemId === null);

  const recusedMembers = relevantRecusals.length;

  // Calculate required quorum based on type
  const requiredForQuorum = calculateRequiredQuorum(
    body.quorumType,
    totalMembers,
    body.quorumNumber
  );

  // Eligible voters = present minus those recused for this item
  const eligibleVoters = presentMembers - recusedMembers;

  // Quorum is met if eligible voters >= required
  const isQuorumMet = eligibleVoters >= requiredForQuorum;

  return {
    isQuorumMet,
    totalMembers,
    presentMembers,
    recusedMembers,
    requiredForQuorum,
    eligibleVoters,
  };
}

/**
 * Calculate required quorum number based on quorum type.
 */
export function calculateRequiredQuorum(
  quorumType: QuorumType,
  totalMembers: number,
  specificNumber?: number
): number {
  switch (quorumType) {
    case 'MAJORITY':
      // Majority = more than half, so floor(n/2) + 1
      return Math.floor(totalMembers / 2) + 1;

    case 'TWO_THIRDS':
      // Two-thirds, rounded up
      return Math.ceil((totalMembers * 2) / 3);

    case 'SPECIFIC':
      // Use the specific number if provided, otherwise default to majority
      return specificNumber ?? Math.floor(totalMembers / 2) + 1;

    default:
      return Math.floor(totalMembers / 2) + 1;
  }
}

/**
 * Calculate vote tally from vote records.
 *
 * @param votes All votes cast
 * @param recusals Recusals for this vote
 * @param passThreshold Fraction required to pass (default 0.5 for simple majority)
 */
export function tallyVotes(
  votes: VoteRecord[],
  recusals: MemberRecusal[] = [],
  passThreshold: number = 0.5
): VoteTally {
  const recusedMemberIds = new Set(recusals.map((r) => r.memberId));

  // Count votes by type
  let yea = 0;
  let nay = 0;
  let abstain = 0;
  let absent = 0;
  let recused = 0;

  for (const vote of votes) {
    // Check if this member was recused
    if (recusedMemberIds.has(vote.memberId) || vote.isRecused) {
      recused++;
      continue;
    }

    switch (vote.vote) {
      case 'YEA':
        yea++;
        break;
      case 'NAY':
        nay++;
        break;
      case 'ABSTAIN':
        abstain++;
        break;
      case 'ABSENT':
        absent++;
        break;
      case 'RECUSED':
        recused++;
        break;
    }
  }

  const total = votes.length;
  const votingMembers = yea + nay; // Only yes/no votes count toward threshold
  const passed = votingMembers > 0 && yea / votingMembers > passThreshold;
  const margin = yea - nay;

  return {
    yea,
    nay,
    abstain,
    absent,
    recused,
    total,
    passed,
    margin,
  };
}

/**
 * Check if a simple majority vote passed.
 */
export function didMotionPass(tally: VoteTally): boolean {
  return tally.passed;
}

/**
 * Check if a super-majority (2/3) vote passed.
 */
export function didSuperMajorityPass(tally: VoteTally): boolean {
  const votingMembers = tally.yea + tally.nay;
  if (votingMembers === 0) return false;
  return tally.yea / votingMembers >= 2 / 3;
}

/**
 * Get vote breakdown as formatted string for minutes.
 */
export function formatVoteTally(tally: VoteTally): string {
  const parts: string[] = [];

  if (tally.yea > 0) parts.push(`${tally.yea} yea`);
  if (tally.nay > 0) parts.push(`${tally.nay} nay`);
  if (tally.abstain > 0) parts.push(`${tally.abstain} abstaining`);
  if (tally.absent > 0) parts.push(`${tally.absent} absent`);
  if (tally.recused > 0) parts.push(`${tally.recused} recused`);

  const result = tally.passed ? 'PASSED' : 'FAILED';

  return `${result} (${parts.join(', ')})`;
}

/**
 * Check if all required members have voted.
 */
export function haveAllMembersVoted(
  votes: VoteRecord[],
  attendance: MeetingAttendance[],
  recusals: MemberRecusal[]
): boolean {
  const presentMemberIds = new Set(
    attendance
      .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
      .map((a) => a.memberId)
  );

  const recusedMemberIds = new Set(recusals.map((r) => r.memberId));

  const votedMemberIds = new Set(votes.map((v) => v.memberId));

  // Check each present non-recused member has voted
  for (const memberId of presentMemberIds) {
    if (!recusedMemberIds.has(memberId) && !votedMemberIds.has(memberId)) {
      return false;
    }
  }

  return true;
}

/**
 * Get list of members who haven't voted yet.
 */
export function getMembersNotVoted(
  votes: VoteRecord[],
  attendance: MeetingAttendance[],
  recusals: MemberRecusal[]
): string[] {
  const presentMemberIds = attendance
    .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
    .map((a) => a.memberId);

  const recusedMemberIds = new Set(recusals.map((r) => r.memberId));
  const votedMemberIds = new Set(votes.map((v) => v.memberId));

  return presentMemberIds.filter(
    (id) => !recusedMemberIds.has(id) && !votedMemberIds.has(id)
  );
}
