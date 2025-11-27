# Meetings API Reference

REST API for the Meetings engine, including AI-enhanced endpoints.

## Base URL

```
http://localhost:3000/api/meetings
```

## Authentication

For development, pass tenant and user info via headers:

| Header | Description | Default |
|--------|-------------|---------|
| `x-tenant-id` | Tenant identifier | `lapel-in` |
| `x-user-id` | User identifier | `system` |

Example:
```bash
curl -H "x-tenant-id: lapel-in" -H "x-user-id: clerk-jane" \
  http://localhost:3000/api/meetings
```

---

## Core Endpoints

### List Meetings

```
GET /api/meetings
```

Query parameters:
- `bodyId` - Filter by governing body ID
- `from` - Filter by start date (ISO 8601)
- `to` - Filter by end date (ISO 8601)
- `status` - Filter by status: `planned`, `noticed`, `inSession`, `adjourned`, `cancelled`

**Example Request:**
```bash
curl "http://localhost:3000/api/meetings?status=planned&from=2025-02-01"
```

**Example Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "lapel-in",
    "bodyId": "council",
    "type": "regular",
    "status": "planned",
    "scheduledStart": "2025-02-10T19:00:00.000Z",
    "location": "Town Hall"
  }
]
```

---

### Create Meeting

```
POST /api/meetings
```

**Request Body:**
```json
{
  "bodyId": "council",
  "type": "regular",
  "scheduledStart": "2025-02-10T19:00:00Z",
  "scheduledEnd": "2025-02-10T21:00:00Z",
  "location": "Town Hall, 104 E Main Street"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bodyId` | string | Yes | Governing body ID |
| `type` | string | Yes | `regular`, `special`, `emergency`, `executiveSession` |
| `scheduledStart` | ISO 8601 | Yes | Meeting start time |
| `scheduledEnd` | ISO 8601 | No | Meeting end time |
| `location` | string | Yes | Meeting location |

**Example Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "lapel-in",
  "bodyId": "council",
  "type": "regular",
  "status": "planned",
  "scheduledStart": "2025-02-10T19:00:00.000Z",
  "scheduledEnd": "2025-02-10T21:00:00.000Z",
  "location": "Town Hall, 104 E Main Street",
  "createdByUserId": "clerk-jane",
  "createdAt": "2025-01-15T14:30:00.000Z"
}
```

---

### Get Meeting

```
GET /api/meetings/:id
```

**Example Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "lapel-in",
  "bodyId": "council",
  "type": "regular",
  "status": "noticed",
  "scheduledStart": "2025-02-10T19:00:00.000Z",
  "location": "Town Hall",
  "createdByUserId": "clerk-jane",
  "createdAt": "2025-01-15T14:30:00.000Z",
  "notices": [
    {
      "id": "notice-001",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "postedAt": "2025-02-06T16:00:00.000Z",
      "postedByUserId": "clerk-jane",
      "methods": ["WEBSITE", "PHYSICAL_POSTING"],
      "locations": ["www.lapel.gov/meetings", "Town Hall bulletin board"],
      "requiredLeadTimeHours": 48,
      "isTimely": true
    }
  ],
  "lastNoticePostedAt": "2025-02-06T16:00:00.000Z",
  "openDoorCompliance": {
    "timeliness": "COMPLIANT",
    "requiredPostedBy": "2025-02-06T19:00:00.000Z",
    "actualPostedAt": "2025-02-06T16:00:00.000Z",
    "notes": "51 business hours lead time (48 required)",
    "lastCheckedAt": "2025-02-06T16:00:00.000Z"
  }
}
```

---

### Cancel Meeting

```
POST /api/meetings/:id/cancel
```

**Request Body:**
```json
{
  "reason": "Weather emergency - ice storm warning"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Cancellation reason |

**Notes:**
- Cancellation is idempotent (calling twice returns same result)
- Cannot cancel an `adjourned` meeting (returns 400)

---

### Mark Notice Posted

```
POST /api/meetings/:id/notice
```

Records that public notice has been posted for a meeting. Automatically
calculates Open Door Law compliance.

**Request Body:**
```json
{
  "postedAt": "2025-02-06T16:00:00Z",
  "postedByUserId": "clerk-jane",
  "methods": ["WEBSITE", "PHYSICAL_POSTING"],
  "locations": ["www.lapel.gov/meetings", "Town Hall bulletin board"],
  "proofUris": ["https://storage.example.com/notice-photo.jpg"],
  "notes": "Posted before 5 PM deadline"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `postedAt` | ISO 8601 | Yes | When notice was posted |
| `postedByUserId` | string | Yes | User who posted |
| `methods` | string[] | Yes | `PHYSICAL_POSTING`, `WEBSITE`, `NEWSPAPER`, `EMAIL_LIST` |
| `locations` | string[] | Yes | Where notice was posted |
| `proofUris` | string[] | No | URLs to proof documents |
| `notes` | string | No | Additional notes |

**Response includes `openDoorCompliance`:**
```json
{
  "openDoorCompliance": {
    "timeliness": "COMPLIANT",
    "requiredPostedBy": "2025-02-06T19:00:00.000Z",
    "actualPostedAt": "2025-02-06T16:00:00.000Z",
    "notes": "51 business hours lead time (48 required)",
    "lastCheckedAt": "2025-02-06T16:00:00.000Z"
  }
}
```

**Open Door Law Notes (IC 5-14-1.5-5):**
- Regular meetings require 48 business hours notice
- Weekends and Indiana state holidays are excluded
- Emergency meetings are always marked `COMPLIANT`

---

## AI-Enhanced Endpoints

### Generate Council Summary

```
POST /api/meetings/:id/ai/summary
```

Uses AI to generate a summary of the meeting agenda for council packets.

**Request Body:**
```json
{
  "agendaText": "TOWN COUNCIL MEETING\nFebruary 10, 2025...\n1. Call to Order\n2. ..."
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "lapel-in",
  "aiCouncilSummary": "The February 10 Town Council meeting addresses several key items including a stormwater fee increase, 2025 street paving schedule review, and a new sidewalk improvement district proposal...",
  "aiSummaryGeneratedAt": "2025-01-20T14:30:00.000Z"
}
```

---

### Scan for Deadlines

```
POST /api/meetings/:id/ai/deadlines/scan
```

Uses AI to extract deadlines from meeting materials. Extracted deadlines
require human review (`isConfirmed: false` initially).

**Request Body:**
```json
{
  "packetText": "...Public comment period ends February 15, 2025...\n...Bids due March 1, 2025..."
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "aiExtractedDeadlines": [
    {
      "id": "deadline-001",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Public comment period ends",
      "dueDate": "2025-02-15",
      "confidence": 0.95,
      "isConfirmed": false
    },
    {
      "id": "deadline-002",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Bids due",
      "dueDate": "2025-03-01",
      "confidence": 0.90,
      "isConfirmed": false
    }
  ]
}
```

---

### Review Deadline

```
POST /api/meetings/:id/ai/deadlines/:deadlineId/review
```

Confirm or reject an AI-extracted deadline after human review.

**Request Body:**
```json
{
  "isConfirmed": true
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "aiExtractedDeadlines": [
    {
      "id": "deadline-001",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Public comment period ends",
      "dueDate": "2025-02-15",
      "confidence": 0.95,
      "isConfirmed": true,
      "reviewedByUserId": "clerk-jane",
      "reviewedAt": "2025-01-20T15:00:00.000Z"
    }
  ]
}
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Meeting not found"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid input, business rule violation) |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Full Meeting Object

Here's a complete meeting object with all fields populated:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "lapel-in",
  "bodyId": "council",
  "type": "regular",
  "status": "noticed",
  "scheduledStart": "2025-02-10T19:00:00.000Z",
  "scheduledEnd": "2025-02-10T21:00:00.000Z",
  "location": "Town Hall, 104 E Main Street",
  "createdByUserId": "clerk-jane",
  "createdAt": "2025-01-15T14:30:00.000Z",

  "notices": [
    {
      "id": "notice-001",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "postedAt": "2025-02-06T16:00:00.000Z",
      "postedByUserId": "clerk-jane",
      "methods": ["WEBSITE", "PHYSICAL_POSTING"],
      "locations": ["www.lapel.gov/meetings", "Town Hall bulletin board"],
      "proofUris": ["https://storage.example.com/notice-photo.jpg"],
      "requiredLeadTimeHours": 48,
      "isTimely": true,
      "notes": "Posted before 5 PM deadline"
    }
  ],
  "lastNoticePostedAt": "2025-02-06T16:00:00.000Z",

  "openDoorCompliance": {
    "timeliness": "COMPLIANT",
    "requiredPostedBy": "2025-02-06T19:00:00.000Z",
    "actualPostedAt": "2025-02-06T16:00:00.000Z",
    "notes": "51 business hours lead time (48 required)",
    "lastCheckedAt": "2025-02-06T16:00:00.000Z"
  },

  "aiCouncilSummary": "The February 10 Town Council meeting addresses several key items including a stormwater fee increase from $4.50 to $6.00 per ERU, review of the 2025 street paving schedule, and a new sidewalk improvement district proposal.",
  "aiSummaryGeneratedAt": "2025-01-20T14:30:00.000Z",

  "aiExtractedDeadlines": [
    {
      "id": "deadline-001",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Public comment period ends for Stormwater Fee Increase",
      "dueDate": "2025-02-15",
      "confidence": 0.95,
      "isConfirmed": true,
      "reviewedByUserId": "clerk-jane",
      "reviewedAt": "2025-01-20T15:00:00.000Z"
    },
    {
      "id": "deadline-002",
      "meetingId": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Street paving bids due",
      "dueDate": "2025-03-01",
      "confidence": 0.90,
      "isConfirmed": false
    }
  ]
}
```

---

## Running the Server

### Development (with hot reload)

```bash
# With mock AI provider (no API key needed)
AI_PROVIDER=mock npm run dev

# With OpenAI
AI_PROVIDER=openai AI_API_KEY=sk-... npm run dev
```

### Production

```bash
npm run build
AI_PROVIDER=openai AI_API_KEY=sk-... npm start
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `AI_PROVIDER` | `openai` or `mock` | `openai` |
| `AI_API_KEY` | OpenAI API key | Required if not mock |
| `AI_DEFAULT_MODEL` | Model to use | `gpt-4.1-mini` |
