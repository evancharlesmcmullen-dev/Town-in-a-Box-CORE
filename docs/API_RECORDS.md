# Records (APRA) API Reference

REST API for the Records engine, handling Indiana Access to Public Records Act (APRA) requests. Includes AI-assisted analysis, fee calculation, and deadline monitoring.

## Base URL

```
http://localhost:3000/api/records
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
  http://localhost:3000/api/records/requests
```

---

## Core Endpoints

### Create Request

```
POST /api/records/requests
```

Creates a new public records request. Automatically computes the 7 business day statutory deadline per IC 5-14-3-9.

**Request Body:**
```json
{
  "requesterName": "John Smith",
  "requesterEmail": "john.smith@example.com",
  "description": "All emails between the mayor and town council regarding the 2024 budget from January to March 2024",
  "scopes": [
    {
      "recordType": "email",
      "dateRangeStart": "2024-01-01",
      "dateRangeEnd": "2024-03-31",
      "custodians": ["mayor", "council"],
      "keywords": ["budget", "2024"]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requesterName` | string | Yes | Name of the requester |
| `requesterEmail` | string | No | Email for response delivery |
| `description` | string | Yes | Description of records requested |
| `scopes` | array | No | Structured scope definitions |

**Example Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "lapel-in",
  "requesterName": "John Smith",
  "requesterEmail": "john.smith@example.com",
  "description": "All emails between the mayor and town council regarding the 2024 budget from January to March 2024",
  "reasonablyParticular": true,
  "receivedAt": "2025-01-20T14:30:00.000Z",
  "statutoryDeadlineAt": "2025-01-29T17:00:00.000Z",
  "status": "RECEIVED",
  "createdAt": "2025-01-20T14:30:00.000Z",
  "updatedAt": "2025-01-20T14:30:00.000Z"
}
```

---

### List Requests

```
GET /api/records/requests
```

Query parameters:
- `status` - Comma-separated list of statuses (e.g., `RECEIVED,IN_REVIEW`)
- `from` - Filter by received date start (ISO 8601)
- `to` - Filter by received date end (ISO 8601)
- `search` - Free text search

**Example Request:**
```bash
curl "http://localhost:3000/api/records/requests?status=RECEIVED,IN_REVIEW"
```

**Example Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "lapel-in",
    "receivedAt": "2025-01-20T14:30:00.000Z",
    "requesterName": "John Smith",
    "status": "RECEIVED",
    "statutoryDeadlineAt": "2025-01-29T17:00:00.000Z"
  }
]
```

---

### Get Request

```
GET /api/records/requests/:id
```

Returns the full APRA request with all details.

---

### Update Status

```
POST /api/records/requests/:id/status
```

Updates the status of an APRA request.

**Request Body:**
```json
{
  "newStatus": "IN_REVIEW",
  "note": "Beginning document search"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newStatus` | string | Yes | New status value |
| `note` | string | No | Note explaining the change |

**Valid Statuses:**
- `RECEIVED` - Initial state when request is logged
- `NEEDS_CLARIFICATION` - Waiting for requester to clarify
- `IN_REVIEW` - Staff is searching for records
- `PARTIALLY_FULFILLED` - Some records delivered
- `FULFILLED` - All records delivered
- `DENIED` - Request denied (must cite exemption)
- `CLOSED` - Administratively closed

---

### Add Clarification

```
POST /api/records/requests/:id/clarifications
```

Sends a clarification request to the requester. Per IC 5-14-3-9(b), the 7-day clock pauses until clarification is received.

**Request Body:**
```json
{
  "messageToRequester": "Please specify the date range for the emails you are requesting."
}
```

**Response (201 Created):**
```json
{
  "id": "clar-001",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "sentAt": "2025-01-21T10:00:00.000Z",
  "messageToRequester": "Please specify the date range for the emails you are requesting."
}
```

---

### Record Clarification Response

```
POST /api/records/clarifications/:id/response
```

Records the requester's response to a clarification request. Restarts the 7-day deadline clock.

**Request Body:**
```json
{
  "requesterResponse": "I am looking for emails from January 1 to March 31, 2024"
}
```

---

### Add Exemption

```
POST /api/records/requests/:id/exemptions
```

Records an exemption citation for withholding records. Per IC 5-14-3-4, the specific exemption must be cited.

**Request Body:**
```json
{
  "citation": "IC 5-14-3-4(b)(6)",
  "description": "Attorney-client privileged communications regarding pending litigation",
  "appliesToScopeId": "scope-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `citation` | string | Yes | Legal citation (e.g., "IC 5-14-3-4(b)(6)") |
| `description` | string | Yes | Plain English explanation |
| `appliesToScopeId` | string | No | Specific scope this exemption applies to |

---

### Record Fulfillment

```
POST /api/records/requests/:id/fulfill
```

Records delivery of records to the requester.

**Request Body:**
```json
{
  "deliveryMethod": "EMAIL",
  "notes": "Sent 15 PDF files totaling 2.3 MB",
  "totalFeesCents": 150
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deliveryMethod` | string | Yes | `EMAIL`, `PORTAL`, `MAIL`, `IN_PERSON` |
| `notes` | string | No | Delivery notes |
| `totalFeesCents` | number | No | Fees charged in cents |

---

## Related Data Endpoints

### Get Status History

```
GET /api/records/requests/:id/history
```

Returns the audit trail of status changes.

**Response:**
```json
[
  {
    "id": "hist-001",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "oldStatus": null,
    "newStatus": "RECEIVED",
    "changedAt": "2025-01-20T14:30:00.000Z",
    "changedByUserId": "system"
  },
  {
    "id": "hist-002",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "oldStatus": "RECEIVED",
    "newStatus": "IN_REVIEW",
    "changedAt": "2025-01-21T09:00:00.000Z",
    "changedByUserId": "clerk-jane",
    "note": "Beginning document search"
  }
]
```

### Other Related Endpoints

- `GET /api/records/requests/:id/scopes` - Get scope definitions
- `GET /api/records/requests/:id/clarifications` - Get clarification history
- `GET /api/records/requests/:id/exemptions` - Get exemption citations
- `GET /api/records/requests/:id/fulfillments` - Get fulfillment records

---

## AI-Enhanced Endpoints

All AI outputs are **assistive and require human review** before use.

### Analyze Particularity

```
POST /api/records/requests/:id/ai/particularity
```

Uses AI to analyze whether the request meets the "reasonably particular" requirement under IC 5-14-3-3(a).

**Response:**
```json
{
  "isParticular": true,
  "confidence": 0.85,
  "reasoning": "The request identifies specific records (emails), a specific time period (January-March 2024), specific parties (mayor and council), and a specific subject (budget). This level of specificity should allow staff to locate responsive records.",
  "suggestedClarifications": []
}
```

When the request is **not** particular:
```json
{
  "isParticular": false,
  "confidence": 0.90,
  "reasoning": "The request for 'all records' does not identify any specific record type, time period, or subject matter. Per IC 5-14-3-3(a), a request must identify records with reasonable particularity.",
  "suggestedClarifications": [
    "What type of records are you seeking (emails, contracts, meeting minutes)?",
    "What is the date range for the records?",
    "Is there a specific topic or subject matter?"
  ]
}
```

---

### Suggest Exemptions

```
POST /api/records/requests/:id/ai/exemptions
```

Analyzes the request and suggests potentially applicable exemptions under IC 5-14-3-4.

**Response:**
```json
[
  {
    "citation": "IC 5-14-3-4(b)(1)",
    "description": "Personnel file of a public employee",
    "confidence": 0.85,
    "reasoning": "The request for 'police officer personnel files' directly implicates this exemption which protects personnel files from disclosure."
  },
  {
    "citation": "IC 5-14-3-4(b)(14)",
    "description": "Investigatory records of law enforcement agencies",
    "confidence": 0.60,
    "reasoning": "Some personnel files may contain internal investigation materials that would be exempt under this provision."
  }
]
```

---

### Analyze Scope

```
POST /api/records/requests/:id/ai/scope
```

Extracts structured scope information from the free-text request description.

**Response:**
```json
{
  "recordTypes": ["email"],
  "suggestedCustodians": ["mayor", "town-council", "clerk-treasurer"],
  "keywords": ["budget", "2024", "appropriation"],
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-03-31"
  },
  "confidence": 0.80
}
```

---

### Draft Response Letter

```
POST /api/records/requests/:id/ai/response-letter
```

Generates a professional response letter based on the request's current state.

**Response:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "letter": "Dear Mr. Smith,\n\nThank you for your public records request dated January 20, 2025, submitted pursuant to Indiana's Access to Public Records Act (IC 5-14-3).\n\nWe have completed our search for responsive records and are pleased to provide the following documents...\n\nPursuant to IC 5-14-3-8, a copying fee of $1.50 has been assessed for the 15 pages provided.\n\nIf you believe this response is inadequate or if records have been improperly withheld, you may file a formal complaint with the Public Access Counselor within 30 days.\n\nSincerely,\nTown of Lapel"
}
```

---

### Review Particularity

```
POST /api/records/requests/:id/ai/particularity/review
```

Human review of the AI particularity assessment.

**Request Body:**
```json
{
  "isParticular": false,
  "reason": "Request is too vague - needs to specify record type and date range"
}
```

**Response:** Returns the updated request with `reasonablyParticular` and `particularityReason` fields set.

---

## Fee Endpoints

### Calculate Fee Quote

```
POST /api/records/requests/:id/fees/quote
```

Calculates a fee quote based on Indiana's APRA fee guidelines (IC 5-14-3-8).

**Request Body:**
```json
{
  "bwPages": 50,
  "colorPages": 5,
  "largeFormatPages": 2,
  "cdDvdMedia": 0,
  "usbMedia": 0,
  "requiresMailing": true,
  "laborHours": 0,
  "certifications": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `bwPages` | number | Black & white pages ($0.10/page) |
| `colorPages` | number | Color pages ($0.25/page) |
| `largeFormatPages` | number | Large format pages ($0.50/page) |
| `cdDvdMedia` | number | CD/DVD discs ($1.00/disc) |
| `usbMedia` | number | USB drives ($5.00/drive) |
| `requiresMailing` | boolean | Whether mailing is needed ($5.00 default) |
| `laborHours` | number | Staff hours (first 2 free, then $20/hr) |
| `certifications` | number | Certified copies ($2.00/copy) |

**Response:**
```json
{
  "totalCents": 1275,
  "formattedTotal": "$12.75",
  "totalPages": 57,
  "isExtensive": false,
  "lines": [
    {
      "code": "BW_COPY",
      "name": "Black & White Copies",
      "quantity": 50,
      "unitAmountCents": 10,
      "lineTotalCents": 500
    },
    {
      "code": "COLOR_COPY",
      "name": "Color Copies",
      "quantity": 5,
      "unitAmountCents": 25,
      "lineTotalCents": 125
    },
    {
      "code": "LARGE_FORMAT",
      "name": "Large Format Copies (11x17+)",
      "quantity": 2,
      "unitAmountCents": 50,
      "lineTotalCents": 100
    },
    {
      "code": "MAILING",
      "name": "Mailing/Postage",
      "quantity": 1,
      "unitAmountCents": 500,
      "lineTotalCents": 500
    }
  ],
  "calculatedAt": "2025-01-20T14:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "requesterName": "John Smith"
}
```

**Fee Notes:**
- Fee quotes are non-binding previews
- Per IC 5-14-3-8(c), labor may only be charged after the first 2 hours for extensive requests
- Agencies may set lower fees but not higher than state maximums

---

## Deadline Monitoring

### Check Deadlines

```
POST /api/records/deadlines/check
```

Checks all open requests for approaching or past statutory deadlines. Sends notifications for requests within the warning window.

**Response:**
```json
{
  "requestsChecked": 5,
  "approachingDeadline": [
    {
      "requestId": "550e8400-e29b-41d4-a716-446655440000",
      "requesterName": "John Smith",
      "statutoryDeadlineAt": "2025-01-29T17:00:00.000Z",
      "status": "IN_REVIEW",
      "daysRemaining": 2
    }
  ],
  "pastDeadline": [],
  "notificationsSent": 1,
  "checkedAt": "2025-01-27T09:00:00.000Z"
}
```

**Business Rules:**
- Warning notifications sent at 2 days before deadline
- Urgent notifications sent at 1 day before deadline
- Overdue notifications sent for past deadlines

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "APRA request not found"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid input, missing required field) |
| 404 | Resource not found |
| 501 | Feature not configured (AI/fees/notifications disabled) |
| 500 | Internal server error |

---

## Indiana APRA Business Rules

This API implements the following Indiana statutes:

### IC 5-14-3-3 - Request Requirements
- Requests must be in writing
- Requests must identify records with "reasonable particularity"

### IC 5-14-3-4 - Exemptions
- Lists records exempt from disclosure
- When records are withheld, the specific exemption must be cited

### IC 5-14-3-8 - Fees
- Agencies may charge reasonable copying fees
- Fees cannot exceed actual cost
- Labor charges only allowed for extensive requests (over 2 hours)

### IC 5-14-3-9 - Response Time
- Agencies must respond within **7 business days**
- If clarification is needed, the clock pauses until response is received
- Weekends and Indiana state holidays are excluded from the count

---

## Full Request Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "lapel-in",
  "requesterName": "John Smith",
  "requesterEmail": "john.smith@example.com",
  "description": "All emails between the mayor and town council regarding the 2024 budget from January to March 2024",
  "reasonablyParticular": true,
  "particularityReason": "Request specifies record type, parties, subject, and date range",
  "receivedAt": "2025-01-20T14:30:00.000Z",
  "statutoryDeadlineAt": "2025-01-29T17:00:00.000Z",
  "status": "FULFILLED",
  "createdAt": "2025-01-20T14:30:00.000Z",
  "updatedAt": "2025-01-28T16:00:00.000Z"
}
```
