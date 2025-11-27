// src/states/in/legal/town/meetings/in-town-meetings.opinions.ts

import { LegalOpinion, StatutoryCitation } from '../../../../../core/state';

/**
 * Indiana Town Meetings Legal Opinions
 *
 * Pre-researched legal interpretations for Open Door Law questions
 * specific to Indiana towns.
 */

export const IN_TOWN_MEETINGS_OPINIONS: LegalOpinion[] = [
  {
    id: 'in-town-mtg-001',
    domain: 'meetings',
    topic: 'Notice Requirements',
    question: 'How much notice must be given for a regular town council meeting?',
    answer:
      'At least 48 hours notice is required, excluding Saturdays, Sundays, and legal holidays. The notice must state the date, time, and place of the meeting. It must be posted at the principal office of the town (or if none, at the building where the meeting will be held). The 48-hour period is measured backward from the scheduled start time.',
    citations: [
      { code: 'IC 5-14-1.5-5(a)', title: 'Regular Meeting Notice' },
      { code: 'IC 5-14-1.5-5(c)', title: 'Posting Location' },
    ],
    tags: ['notice', 'regular-meetings', 'posting'],
  },
  {
    id: 'in-town-mtg-002',
    domain: 'meetings',
    topic: 'Executive Sessions',
    question: 'When can an Indiana town council go into executive session?',
    answer:
      'Executive sessions are permitted only for specific topics listed in IC 5-14-1.5-6.1, including: (1) personnel matters (job performance, not salary); (2) strategy for pending or threatened litigation; (3) security matters; (4) labor negotiations strategy; (5) purchase/lease of real property before public offering; (6) discussion of records classified as confidential. Final action must be taken in a public meeting.',
    citations: [
      { code: 'IC 5-14-1.5-6.1', title: 'Executive Sessions' },
    ],
    tags: ['executive-session', 'closed-session', 'odl'],
  },
  {
    id: 'in-town-mtg-003',
    domain: 'meetings',
    topic: 'Quorum',
    question: 'What constitutes a quorum for an Indiana town council?',
    answer:
      'A majority of the members of the council constitutes a quorum for the transaction of business. For a 5-member council, 3 members must be present. For a 3-member council, 2 members must be present. Without a quorum, no official action can be taken, though the meeting may convene and adjourn.',
    citations: [
      { code: 'IC 36-5-2-9', title: 'Town Council Quorum' },
    ],
    tags: ['quorum', 'voting', 'council'],
  },
  {
    id: 'in-town-mtg-004',
    domain: 'meetings',
    topic: 'Emergency Meetings',
    question: 'Can an Indiana town hold an emergency meeting without 48 hours notice?',
    answer:
      'Yes, in cases of emergency. The notice must state the date, time, place, and purpose (limited to the emergency). Notice must be given at least 2 hours before the meeting by telephone or other means to news media that have requested notice, and by posting at the usual location. Only the emergency matter may be addressed.',
    citations: [
      { code: 'IC 5-14-1.5-5(d)', title: 'Emergency Meeting Notice' },
    ],
    tags: ['emergency', 'notice', 'special-meetings'],
  },
  {
    id: 'in-town-mtg-005',
    domain: 'meetings',
    topic: 'Public Comment',
    question: 'Must Indiana town council meetings allow public comment?',
    answer:
      'The Open Door Law requires that the public be permitted to observe and record meetings, but does not require that the public be allowed to speak. However, many towns establish public comment periods by policy or ordinance. If public comment is allowed, reasonable time limits and rules of decorum may be established.',
    citations: [
      { code: 'IC 5-14-1.5-3(a)', title: 'Right to Attend and Observe' },
      { code: 'PAC Opinions', notes: 'Public comment not required but permitted' },
    ],
    tags: ['public-comment', 'participation', 'meetings'],
  },
  {
    id: 'in-town-mtg-006',
    domain: 'meetings',
    topic: 'Virtual Meetings',
    question: 'Can Indiana town councils meet virtually?',
    answer:
      'Yes, under IC 5-14-1.5-3.5 (as amended), governing bodies may meet electronically if certain conditions are met: (1) all members can simultaneously communicate; (2) the public can observe and hear; (3) the public notice includes how to access electronically; (4) members identify themselves before voting. At least 50% of meetings in a calendar year must be held in person.',
    citations: [
      { code: 'IC 5-14-1.5-3.5', title: 'Electronic Meetings' },
      { code: 'IC 5-14-1.5-3.6', title: 'Electronic Meeting Requirements' },
    ],
    tags: ['virtual', 'electronic', 'remote-meetings'],
  },
];

/**
 * Get all town meetings opinions.
 */
export function getINTownMeetingsOpinions(): LegalOpinion[] {
  return IN_TOWN_MEETINGS_OPINIONS;
}

/**
 * Find opinions by tag.
 */
export function findOpinionsByTag(tag: string): LegalOpinion[] {
  return IN_TOWN_MEETINGS_OPINIONS.filter((o) => o.tags?.includes(tag));
}

/**
 * Find opinion by ID.
 */
export function findOpinionById(id: string): LegalOpinion | undefined {
  return IN_TOWN_MEETINGS_OPINIONS.find((o) => o.id === id);
}
