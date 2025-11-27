// examples/meetings-open-door-demo.ts
//
// Demonstrates Open Door Law compliance checking for meeting notices.
//
// Run with: npx tsx examples/meetings-open-door-demo.ts

import {
  InMemoryMeetingsService,
  TenantContext,
  JurisdictionProfile,
} from '../src';

async function main() {
  // Set up context for Town of Lapel
  const jurisdiction: JurisdictionProfile = {
    tenantId: 'lapel-in',
    state: 'IN',
    kind: 'town',
    name: 'Town of Lapel',
    authorityTags: ['zoningAuthority'],
  };

  const ctx: TenantContext = {
    tenantId: 'lapel-in',
    userId: 'clerk-jane',
    jurisdiction,
  };

  const meetings = new InMemoryMeetingsService();

  console.log('='.repeat(60));
  console.log('Open Door Law Compliance Demo');
  console.log('='.repeat(60));
  console.log();

  // --- Scenario 1: Monday meeting, notice posted Thursday (COMPLIANT) ---
  console.log('Scenario 1: Monday meeting, notice posted Thursday');
  console.log('-'.repeat(60));

  const mondayMeeting = await meetings.scheduleMeeting(ctx, {
    bodyId: 'council',
    type: 'regular',
    scheduledStart: new Date('2025-02-10T19:00:00'), // Monday at 7 PM
    location: 'Town Hall',
  });

  // Post notice on Thursday before 7 PM (48 biz hours = Thu 7 PM deadline)
  const compliantNotice = await meetings.markNoticePosted(ctx, {
    meetingId: mondayMeeting.id,
    postedAt: new Date('2025-02-06T16:00:00'), // Thursday 4 PM
    postedByUserId: 'clerk-jane',
    methods: ['WEBSITE', 'PHYSICAL_POSTING'],
    locations: ['www.lapel.gov/meetings', 'Town Hall bulletin board'],
  });

  console.log(`Meeting: Monday Feb 10, 2025 at 7:00 PM`);
  console.log(`Notice posted: Thursday Feb 6, 2025 at 4:00 PM`);
  console.log();
  console.log('Compliance result:');
  console.log(`  Timeliness: ${compliantNotice.openDoorCompliance?.timeliness}`);
  console.log(`  Required by: ${compliantNotice.openDoorCompliance?.requiredPostedBy}`);
  console.log(`  Actually posted: ${compliantNotice.openDoorCompliance?.actualPostedAt}`);
  console.log(`  Notes: ${compliantNotice.openDoorCompliance?.notes}`);
  console.log();

  // --- Scenario 2: Monday meeting, notice posted Friday (LATE) ---
  console.log('Scenario 2: Monday meeting, notice posted Friday');
  console.log('-'.repeat(60));

  const mondayMeeting2 = await meetings.scheduleMeeting(ctx, {
    bodyId: 'council',
    type: 'regular',
    scheduledStart: new Date('2025-02-17T19:00:00'), // Monday at 7 PM
    location: 'Town Hall',
  });

  // Post notice on Friday (after Thursday 7 PM deadline - LATE)
  const lateNotice = await meetings.markNoticePosted(ctx, {
    meetingId: mondayMeeting2.id,
    postedAt: new Date('2025-02-14T10:00:00'), // Friday 10 AM
    postedByUserId: 'clerk-jane',
    methods: ['WEBSITE'],
    locations: ['www.lapel.gov/meetings'],
  });

  console.log(`Meeting: Monday Feb 17, 2025 at 7:00 PM`);
  console.log(`Notice posted: Friday Feb 14, 2025 at 10:00 AM`);
  console.log();
  console.log('Compliance result:');
  console.log(`  Timeliness: ${lateNotice.openDoorCompliance?.timeliness}`);
  console.log(`  Required by: ${lateNotice.openDoorCompliance?.requiredPostedBy}`);
  console.log(`  Actually posted: ${lateNotice.openDoorCompliance?.actualPostedAt}`);
  console.log(`  Notes: ${lateNotice.openDoorCompliance?.notes}`);
  console.log();

  // --- Scenario 3: Emergency meeting (always COMPLIANT) ---
  console.log('Scenario 3: Emergency meeting');
  console.log('-'.repeat(60));

  const emergencyMeeting = await meetings.scheduleMeeting(ctx, {
    bodyId: 'council',
    type: 'emergency',
    scheduledStart: new Date('2025-02-20T18:00:00'), // Thursday 6 PM
    location: 'Town Hall',
  });

  // Post notice just 2 hours before (emergency meetings are exempt)
  const emergencyNotice = await meetings.markNoticePosted(ctx, {
    meetingId: emergencyMeeting.id,
    postedAt: new Date('2025-02-20T16:00:00'), // 2 hours before
    postedByUserId: 'clerk-jane',
    methods: ['EMAIL_LIST', 'WEBSITE'],
    locations: ['Emergency email blast', 'www.lapel.gov/meetings'],
  });

  console.log(`Meeting: Thursday Feb 20, 2025 at 6:00 PM (EMERGENCY)`);
  console.log(`Notice posted: Thursday Feb 20, 2025 at 4:00 PM (2 hours before)`);
  console.log();
  console.log('Compliance result:');
  console.log(`  Timeliness: ${emergencyNotice.openDoorCompliance?.timeliness}`);
  console.log(`  Notes: ${emergencyNotice.openDoorCompliance?.notes}`);
  console.log();

  // --- Scenario 4: Meeting after New Year's holiday ---
  console.log('Scenario 4: Meeting after New Year\'s holiday');
  console.log('-'.repeat(60));

  const janMeeting = await meetings.scheduleMeeting(ctx, {
    bodyId: 'council',
    type: 'regular',
    scheduledStart: new Date('2025-01-02T19:00:00'), // Thursday Jan 2 at 7 PM
    location: 'Town Hall',
  });

  // Post notice on Monday Dec 30 (Jan 1 is a holiday, so it's skipped)
  const holidayNotice = await meetings.markNoticePosted(ctx, {
    meetingId: janMeeting.id,
    postedAt: new Date('2024-12-30T10:00:00'), // Monday Dec 30 at 10 AM
    postedByUserId: 'clerk-jane',
    methods: ['WEBSITE'],
    locations: ['www.lapel.gov/meetings'],
  });

  console.log(`Meeting: Thursday Jan 2, 2025 at 7:00 PM`);
  console.log(`Notice posted: Monday Dec 30, 2024 at 10:00 AM`);
  console.log(`(New Year's Day Jan 1 is excluded from calculation)`);
  console.log();
  console.log('Compliance result:');
  console.log(`  Timeliness: ${holidayNotice.openDoorCompliance?.timeliness}`);
  console.log(`  Required by: ${holidayNotice.openDoorCompliance?.requiredPostedBy}`);
  console.log(`  Actually posted: ${holidayNotice.openDoorCompliance?.actualPostedAt}`);
  console.log(`  Notes: ${holidayNotice.openDoorCompliance?.notes}`);
  console.log();

  console.log('='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
