// examples/ai-meetings-summary.ts
//
// Demonstrates AI-powered meeting summary generation and deadline extraction.
//
// Run with mock provider:
//   AI_PROVIDER=mock npx tsx examples/ai-meetings-summary.ts
//
// Run with OpenAI:
//   AI_PROVIDER=openai AI_API_KEY=sk-... npx tsx examples/ai-meetings-summary.ts

import {
  createAiBootstrap,
  InMemoryMeetingsService,
  TenantContext,
  JurisdictionProfile,
  MockAiClient,
} from '../src';

const SAMPLE_AGENDA = `
TOWN OF LAPEL
TOWN COUNCIL REGULAR MEETING
February 10, 2025 - 7:00 PM
Town Hall, 104 E Main Street

AGENDA

1. CALL TO ORDER

2. PLEDGE OF ALLEGIANCE

3. APPROVAL OF MINUTES
   - January 13, 2025 Regular Meeting

4. PUBLIC COMMENT (3 minutes per speaker)

5. OLD BUSINESS
   a. Second Reading - Ordinance 2025-02: Stormwater Utility Fee Increase
      - Proposed increase from $4.50 to $6.00 per ERU
      - Public comment period ends February 15, 2025

   b. Final review of 2025 Street Paving Schedule
      - Bids due March 1, 2025

6. NEW BUSINESS
   a. First Reading - Ordinance 2025-03: Sidewalk Improvement District
      - Creates special assessment district for downtown sidewalks
      - Property owner objection deadline: March 15, 2025

   b. Resolution 2025-05: Award of Water Main Contract
      - Lowest responsible bidder: ABC Utilities, $285,000
      - Contract execution deadline: February 28, 2025

   c. Parks Department Update
      - Summer program registration opens April 1, 2025

7. DEPARTMENT REPORTS
   - Police, Fire, Public Works, Utilities

8. COUNCIL COMMENTS

9. ADJOURNMENT
`;

async function main() {
  // Set up context
  const jurisdiction: JurisdictionProfile = {
    tenantId: 'lapel-in',
    state: 'IN',
    kind: 'town',
    name: 'Town of Lapel',
    authorityTags: ['zoningAuthority', 'utilityOperator'],
  };

  const ctx: TenantContext = {
    tenantId: 'lapel-in',
    userId: 'clerk-jane',
    jurisdiction,
  };

  console.log('='.repeat(60));
  console.log('AI Meetings Summary Demo');
  console.log('='.repeat(60));
  console.log();

  // Bootstrap AI services
  const ai = createAiBootstrap();
  console.log(`AI Provider: ${ai.config.provider}`);
  console.log(`Model: ${ai.config.defaultModel}`);
  console.log();

  // If using mock, configure responses
  if (ai.config.provider === 'mock') {
    const mockClient = ai.providerClient as MockAiClient;

    // Set up mock responses for the demo
    mockClient.setResponses([
      // Response for generateCouncilSummary
      {
        content: `The February 10, 2025 Town Council meeting addresses several key items: a stormwater utility fee increase from $4.50 to $6.00 per ERU (second reading), final review of the 2025 street paving schedule, a new sidewalk improvement district proposal (first reading), and awarding a $285,000 water main contract to ABC Utilities. The public comment period for the stormwater ordinance ends February 15, and property owners may object to the sidewalk district by March 15.`,
      },
      // Response for scanForDeadlines
      {
        content: JSON.stringify([
          {
            label: 'Public comment period ends for Stormwater Fee Increase',
            dueDate: '2025-02-15',
            confidence: 0.95,
          },
          {
            label: 'Street paving bids due',
            dueDate: '2025-03-01',
            confidence: 0.9,
          },
          {
            label: 'Sidewalk district property owner objection deadline',
            dueDate: '2025-03-15',
            confidence: 0.92,
          },
          {
            label: 'Water main contract execution deadline',
            dueDate: '2025-02-28',
            confidence: 0.88,
          },
          {
            label: 'Summer program registration opens',
            dueDate: '2025-04-01',
            confidence: 0.85,
          },
        ]),
      },
    ]);

    console.log('(Using mock AI responses for demo)');
    console.log();
  }

  // Create meetings service with AI wrapper
  const baseMeetings = new InMemoryMeetingsService();
  const meetings = ai.aiMeetingsService(baseMeetings);

  // Schedule a meeting
  const meeting = await meetings.scheduleMeeting(ctx, {
    bodyId: 'council',
    type: 'regular',
    scheduledStart: new Date('2025-02-10T19:00:00'),
    location: 'Town Hall, 104 E Main Street',
  });

  console.log(`Created meeting: ${meeting.id}`);
  console.log(`Scheduled: ${meeting.scheduledStart}`);
  console.log();

  // --- Generate Council Summary ---
  console.log('Generating AI summary...');
  console.log('-'.repeat(60));

  const withSummary = await meetings.generateCouncilSummary(
    ctx,
    meeting.id,
    SAMPLE_AGENDA
  );

  console.log();
  console.log('AI Council Summary:');
  console.log();
  console.log(withSummary.aiCouncilSummary);
  console.log();
  console.log(`Generated at: ${withSummary.aiSummaryGeneratedAt}`);
  console.log();

  // --- Scan for Deadlines ---
  console.log('Scanning for deadlines...');
  console.log('-'.repeat(60));

  const withDeadlines = await meetings.scanForDeadlines(
    ctx,
    meeting.id,
    SAMPLE_AGENDA
  );

  console.log();
  console.log('Extracted Deadlines:');
  console.log();

  for (const deadline of withDeadlines.aiExtractedDeadlines ?? []) {
    const confidence = deadline.confidence
      ? `(${Math.round(deadline.confidence * 100)}% confidence)`
      : '';
    console.log(`  - ${deadline.label}`);
    console.log(`    Due: ${deadline.dueDate} ${confidence}`);
    console.log(`    Confirmed: ${deadline.isConfirmed ? 'Yes' : 'Pending review'}`);
    console.log();
  }

  // --- Human Review ---
  console.log('Human review of first deadline...');
  console.log('-'.repeat(60));

  const deadlines = withDeadlines.aiExtractedDeadlines ?? [];
  if (deadlines.length > 0) {
    const reviewed = await meetings.reviewDeadline(
      ctx,
      meeting.id,
      deadlines[0].id,
      true // confirmed
    );

    const confirmedDeadline = reviewed.aiExtractedDeadlines?.find(
      (d) => d.id === deadlines[0].id
    );

    console.log();
    console.log(`Deadline "${confirmedDeadline?.label}":`);
    console.log(`  Confirmed: ${confirmedDeadline?.isConfirmed}`);
    console.log(`  Reviewed by: ${confirmedDeadline?.reviewedByUserId}`);
    console.log(`  Reviewed at: ${confirmedDeadline?.reviewedAt}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
