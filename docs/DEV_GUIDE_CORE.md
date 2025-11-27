# Town-in-a-Box CORE Developer Guide

This guide covers the key engines and services in Town-in-a-Box-CORE.
After reading it, you should be able to integrate the CORE library into
CLI scripts, API endpoints, or a React UI.

## Table of Contents

1. [Getting Started](#getting-started)
2. [AI Layer](#ai-layer)
3. [Meetings Engine](#meetings-engine)
4. [Fees Engine](#fees-engine)
5. [Township Assistance Engine](#township-assistance-engine)

---

## Getting Started

### Installation

```bash
npm install town-in-a-box-core
```

### Basic Usage

All engines require a `TenantContext` to identify the municipality and user:

```typescript
import { TenantContext, JurisdictionProfile } from 'town-in-a-box-core';

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
```

---

## AI Layer

The AI layer provides provider-agnostic AI capabilities for summarization,
deadline extraction, and classification.

### Configuration

Set environment variables to configure the AI provider:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | `'openai'` or `'mock'` | `'openai'` |
| `AI_API_KEY` | API key (required unless mock) | - |
| `AI_BASE_URL` | Override API base URL | - |
| `AI_DEFAULT_MODEL` | Model to use | `'gpt-4.1-mini'` |
| `AI_DEFAULT_TEMPERATURE` | Sampling temperature (0-2) | `0.2` |
| `AI_DEFAULT_MAX_TOKENS` | Max tokens to generate | `1024` |
| `AI_TIMEOUT_MS` | Request timeout | `120000` |
| `AI_MAX_RETRIES` | Retry attempts on transient errors | `2` |
| `AI_RETRY_BASE_DELAY_MS` | Base delay for exponential backoff | `250` |

### Bootstrap Usage

```typescript
import { createAiBootstrap } from 'town-in-a-box-core';
import { InMemoryMeetingsService } from 'town-in-a-box-core';

// Wire up AI services from environment
const ai = createAiBootstrap();

// Use extraction service directly
const deadlines = await ai.extraction.extractDeadlines(ctx, noticeText);

// Wrap a meetings service with AI capabilities
const baseMeetings = new InMemoryMeetingsService();
const meetings = ai.aiMeetingsService(baseMeetings);

// Generate AI summary
const meeting = await meetings.generateCouncilSummary(ctx, meetingId, agendaText);
console.log(meeting.aiCouncilSummary);
```

### Error Handling

The AI layer uses typed errors for different failure modes:

```typescript
import { AiError, AiErrorCode } from 'town-in-a-box-core';

try {
  const result = await ai.core.complete(ctx, prompt);
} catch (err) {
  if (err instanceof AiError) {
    switch (err.code) {
      case 'AI_RATE_LIMITED':
        // Back off and retry
        break;
      case 'AI_UNAVAILABLE':
        // Service temporarily unavailable
        break;
      case 'AI_TIMEOUT':
        // Request took too long
        break;
      case 'AI_CONTENT_FILTERED':
        // Content was filtered by the provider
        break;
    }
  }
}
```

### Retries

`AiCoreServiceImpl` automatically retries on transient errors:
- `AI_RATE_LIMITED` - retried
- `AI_UNAVAILABLE` - retried
- `AI_TIMEOUT` - retried
- `AI_CONTENT_FILTERED` - NOT retried (non-transient)
- `AI_CHAT_FAILED` - NOT retried
- `AI_INVALID_RESPONSE` - NOT retried

Retries use exponential backoff: `baseDelay * 2^attempt`.

### JSON Extraction Validation

`AiExtractionServiceImpl` performs strict validation on AI responses:

- `extractDeadlines()` - Validates JSON array with `label` (string) and
  `dueDate` (ISO date format) on each item
- `classifyMatter()` - Validates module is one of the allowed values and
  confidence is a number between 0-1

Invalid responses throw an error rather than returning garbage data.

### Human-in-the-Loop for Deadlines

AI-extracted deadlines require human confirmation:

```typescript
// Extract deadlines from meeting packet
const meeting = await meetings.scanForDeadlines(ctx, meetingId, packetText);

// Each deadline has isConfirmed=false initially
for (const deadline of meeting.aiExtractedDeadlines ?? []) {
  console.log(`${deadline.label}: ${deadline.dueDate} (confidence: ${deadline.confidence})`);
  console.log(`Confirmed: ${deadline.isConfirmed}`);
}

// Human reviews and confirms
await meetings.reviewDeadline(ctx, meetingId, deadlineId, true);
```

---

## Meetings Engine

The Meetings engine handles scheduling, notices, minutes, and Open Door Law compliance.

### Basic Usage

```typescript
import { InMemoryMeetingsService, TenantContext } from 'town-in-a-box-core';

const meetings = new InMemoryMeetingsService();

// Schedule a meeting
const meeting = await meetings.scheduleMeeting(ctx, {
  bodyId: 'council',
  type: 'regular',
  scheduledStart: new Date('2025-02-10T19:00:00'),
  location: 'Town Hall',
});
```

### Open Door Law Compliance (IC 5-14-1.5-5)

Indiana's Open Door Law requires public notice be posted **"at least 48 hours
(excluding Saturdays, Sundays, and legal holidays)"** before a meeting.

The `markNoticePosted` method automatically calculates compliance:

```typescript
const updated = await meetings.markNoticePosted(ctx, {
  meetingId: meeting.id,
  postedAt: new Date('2025-02-07T10:00:00'),
  postedByUserId: 'clerk-jane',
  methods: ['WEBSITE', 'PHYSICAL_POSTING'],
  locations: ['www.town.gov/meetings', 'Town Hall bulletin board'],
});

// Check compliance
console.log(updated.openDoorCompliance);
// {
//   timeliness: 'COMPLIANT' | 'LATE',
//   requiredPostedBy: '2025-02-06T19:00:00.000Z',  // ISO 8601
//   actualPostedAt: '2025-02-07T10:00:00.000Z',
//   notes: '52 business hours lead time (48 required)',
//   lastCheckedAt: Date
// }
```

Key behaviors:

- **Business hours calculation**: Weekends and Indiana state holidays are
  excluded when counting the 48 hours
- **Emergency meetings**: Exempt from the 48-hour rule per IC 5-14-1.5-5(d);
  always marked as `COMPLIANT`
- **ISO 8601 timestamps**: `requiredPostedBy` and `actualPostedAt` are stored
  as ISO strings for serialization

The compliance check uses Indiana state holidays automatically:
- New Year's Day
- Martin Luther King Jr. Day
- Presidents Day
- Memorial Day
- Juneteenth
- Independence Day
- Labor Day
- Columbus Day
- Veterans Day
- Thanksgiving and day after
- Christmas Day

### Meeting Status Lifecycle

```
planned → noticed → inSession → adjourned
    ↓
cancelled
```

- `cancelMeeting()` is idempotent (calling twice returns same result)
- Cannot cancel an `adjourned` meeting
- Status transitions to `noticed` when first notice is posted

---

## Fees Engine

The Fees engine calculates permit fees, impact fees, utility fees, and fines.

### Basic Usage

```typescript
import { InMemoryFeeService, FeeItem, TenantContext } from 'town-in-a-box-core';

// Seed with fee items
const feeService = new InMemoryFeeService({
  feeItems: [
    {
      id: 'fee-001',
      tenantId: 'lapel-in',
      code: 'IMPACT_PARK',
      name: 'Park Impact Fee',
      category: 'impact',
      baseAmountCents: 50000, // $500 per EDU
      isActive: true,
    },
    {
      id: 'fee-002',
      tenantId: 'lapel-in',
      code: 'IMPACT_ROAD',
      name: 'Road Impact Fee',
      category: 'impact',
      baseAmountCents: 75000, // $750 per EDU
      isActive: true,
    },
  ],
});

// Calculate fees
const result = await feeService.calculateFees(ctx, {
  parameters: {
    IMPACT_PARK: 10, // 10 EDUs
    IMPACT_ROAD: 10,
  },
  context: {
    applicantName: 'ABC Builders',
    parcelId: '48-05-36-100-001',
    caseNumber: 'SUB-2025-003',
  },
});

console.log(result);
// {
//   tenantId: 'lapel-in',
//   scheduleId: null,
//   lines: [...],
//   subtotalCents: 1250000,  // $12,500
//   totalCents: 1250000,
//   currency: 'USD',
//   calculatedAt: '2025-01-15T14:30:00.000Z',
//   context: { applicantName: 'ABC Builders', ... }
// }
```

### Key Design Decisions

1. **All amounts in cents** - Avoids floating point issues. Divide by 100
   for display.

2. **`calculatedAt` is ISO 8601** - String format for easy serialization
   and database storage.

3. **`context` echoed back** - The audit context from input is returned
   in the result, creating an "instant case file" for legal defensibility.

4. **Fee schedules optional** - If no `feeScheduleId` is provided, all
   active fee items for the tenant are used.

---

## Township Assistance Engine

The Township Assistance engine manages poor relief applications, cases, and benefits.

### Reporting Service

```typescript
import {
  InMemoryAssistanceReportingService,
  AssistanceStatsRange,
  TenantContext,
} from 'town-in-a-box-core';

const reporting = new InMemoryAssistanceReportingService(assistanceService);

const range: AssistanceStatsRange = {
  fromDate: new Date('2025-01-01'),
  toDate: new Date('2025-03-31'),
};

const stats = await reporting.getStatsForRange(ctx, range);

console.log(stats.caseStats);
// { totalCases: 150, openCases: 12, approvedCases: 95, deniedCases: 43, paidCases: 88 }

console.log(stats.householdBuckets);
// [
//   { bucketLabel: '1', minSize: 1, maxSize: 1, caseCount: 45, approvedCount: 30, deniedCount: 15 },
//   { bucketLabel: '2-3', minSize: 2, maxSize: 3, caseCount: 60, ... },
//   ...
// ]
```

### Invariants

The reporting service enforces a runtime invariant:

```
sum(householdBuckets[*].caseCount) === caseStats.totalCases
```

If this invariant is violated, an error is thrown. This catches data
corruption or logic bugs before they propagate to reports.

### Intended Use Cases

- **TA-7 State Reports** - Required annual statistical reports for Indiana
- **Trustee Dashboards** - Real-time case counts and spending by category
- **Board Presentations** - Quarterly summaries for township board meetings

---

## Testing

### Mock AI Client

For tests, use the mock AI client:

```typescript
import { MockAiClient, createAiBootstrapWithConfig } from 'town-in-a-box-core';

// Option 1: Use mock provider via config
const ai = createAiBootstrapWithConfig({
  provider: 'mock',
  apiKey: '',
  defaultModel: 'test-model',
  defaultTemperature: 0.2,
  defaultMaxTokens: 1024,
  timeoutMs: 1000,
  maxRetries: 0,
  retryBaseDelayMs: 10,
});

// Option 2: Use MockAiClient directly for fine-grained control
const mockClient = new MockAiClient();
mockClient.setNextResponse({ content: 'Mocked response' });
mockClient.setResponses([
  { content: 'First' },
  { content: 'Second' },
  { error: new AiError('AI_RATE_LIMITED', 'Rate limited') },
]);
```

### In-Memory Services

All engines have in-memory implementations for testing:

- `InMemoryMeetingsService`
- `InMemoryFeeService`
- `InMemoryAssistanceReportingService`
- `InMemoryApraService`

These store data in memory and reset between test runs.
