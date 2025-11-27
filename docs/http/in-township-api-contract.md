# Indiana Township API Contract

This document defines the REST API contract for Indiana Township modules in Town-in-a-Box.

**Base URL:** `/api/township`

**Authentication:** Use `x-tenant-id` header with a township tenant ID (e.g., `fall-creek-twp`).

**Note:** All township endpoints return `403 Forbidden` if the tenant is not a township.

---

## Table of Contents

1. [Township Assistance](#township-assistance)
2. [Fence Viewer](#fence-viewer)
3. [Weed Control](#weed-control)
4. [Cemeteries](#cemeteries)
5. [Fire Contracts](#fire-contracts)
6. [Insurance & Bonds](#insurance--bonds)
7. [Policies](#policies-shared)

---

## Township Assistance

Base path: `/api/township/assistance`

Township assistance (poor relief) management per IC 12-20.

### Program Policies

#### GET /policies
List program policies.

**Response:** `AssistanceProgramPolicy[]`

#### GET /policies/:id
Get a program policy by ID.

**Response:** `AssistanceProgramPolicy`

### Applications

#### POST /applications
Create a new assistance application.

**Request Body:**
```json
{
  "applicantName": "string (required)",
  "applicantEmail": "string",
  "applicantPhone": "string",
  "addressLine1": "string",
  "addressLine2": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "household": [
    { "name": "string", "age": "number", "relationship": "string" }
  ],
  "monthlyIncomeCents": "number",
  "monthlyExpensesCents": "number",
  "requestedBenefitTypes": ["rent", "mortgage", "utilities", "food", "transportation", "medical", "other"],
  "requestedAmountCents": "number"
}
```

**Response:** `201 Created` with `AssistanceApplication`

#### GET /applications/:id
Get an application by ID.

**Response:** `AssistanceApplication`

### Cases

#### GET /cases
List cases with optional filters.

**Query Parameters:**
- `status`: `open | pendingDocumentation | underReview | approved | denied | paid | closed`
- `applicantName`: Filter by applicant name (partial match)
- `from`: ISO 8601 date
- `to`: ISO 8601 date

**Response:** `AssistanceCaseSummary[]`

#### GET /cases/:id
Get a case by ID.

**Response:** `AssistanceCase`

#### POST /applications/:id/case
Create a case for an application.

**Request Body:**
```json
{
  "programPolicyId": "string (optional)"
}
```

**Response:** `201 Created` with `AssistanceCase`

#### POST /cases/:id/status
Update case status.

**Request Body:**
```json
{
  "status": "open | pendingDocumentation | underReview | approved | denied | paid | closed"
}
```

**Response:** `AssistanceCase`

### Benefits

#### POST /benefits
Create a benefit payment.

**Request Body:**
```json
{
  "caseId": "string (required)",
  "type": "rent | mortgage | utilities | food | transportation | medical | other (required)",
  "amountCents": "number (required)",
  "payeeName": "string (required)",
  "payeeAddressLine1": "string",
  "payeeAddressLine2": "string",
  "payeeCity": "string",
  "payeeState": "string",
  "payeePostalCode": "string"
}
```

**Response:** `201 Created` with `AssistanceBenefit`

#### GET /cases/:id/benefits
List benefits for a case.

**Response:** `AssistanceBenefit[]`

### Reporting

#### GET /stats
Get assistance statistics.

**Query Parameters:**
- `range`: `ytd | last30days | last12months | all` (default: `ytd`)

**Response:** `AssistanceStatsSummary`

---

## Fence Viewer

Base path: `/api/township/fence-viewer`

Fence dispute resolution per IC 32-26.

### Cases

#### GET /cases
List fence viewer cases.

**Query Parameters:**
- `status`: `petition_received | inspection_scheduled | inspection_completed | decision_issued | appealed | closed`
- `disputeType`: `boundary | repair | replacement | removal`
- `partyName`: Filter by party name (partial match)
- `from`: ISO 8601 date
- `to`: ISO 8601 date

**Response:** `FenceViewerCaseSummary[]`

#### POST /cases
Create a new fence viewer case.

**Request Body:**
```json
{
  "disputeType": "boundary | repair | replacement | removal (required)",
  "fenceLocationDescription": "string (required)",
  "petitionReceivedAt": "ISO 8601 date",
  "notes": "string"
}
```

**Response:** `201 Created` with `FenceViewerCase`

#### GET /cases/:id
Get a case by ID.

**Response:** `FenceViewerCase`

#### PATCH /cases/:id
Update a case.

**Request Body:**
```json
{
  "disputeType": "string",
  "status": "string",
  "fenceLocationDescription": "string",
  "scheduledInspectionAt": "ISO 8601 date",
  "notes": "string"
}
```

**Response:** `FenceViewerCase`

#### POST /cases/:id/schedule-inspection
Schedule an inspection.

**Request Body:**
```json
{
  "scheduledAt": "ISO 8601 date (required)"
}
```

**Response:** `FenceViewerCase`

#### POST /cases/:id/close
Close a case.

**Request Body:**
```json
{
  "reason": "string"
}
```

**Response:** `FenceViewerCase`

### Parties

#### GET /cases/:id/parties
List parties for a case.

**Response:** `FenceViewerParty[]`

#### POST /parties
Add a party to a case.

**Request Body:**
```json
{
  "caseId": "string (required)",
  "name": "string (required)",
  "role": "petitioner | respondent (required)",
  "addressLine1": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "phone": "string",
  "email": "string",
  "parcelNumber": "string",
  "parcelDescription": "string",
  "notes": "string"
}
```

**Response:** `201 Created` with `FenceViewerParty`

#### DELETE /parties/:id
Remove a party.

**Response:** `204 No Content`

### Inspections

#### GET /cases/:id/inspections
List inspections for a case.

**Response:** `FenceInspection[]`

#### POST /inspections
Record an inspection.

**Request Body:**
```json
{
  "caseId": "string (required)",
  "inspectionDate": "ISO 8601 date (required)",
  "inspectorName": "string (required)",
  "locationDescription": "string (required)",
  "currentFenceCondition": "string",
  "measurements": "string",
  "photoAttachmentIds": ["string"],
  "findings": "string (required)",
  "recommendations": "string"
}
```

**Response:** `201 Created` with `FenceInspection`

### Decisions

#### GET /cases/:id/decision
Get the decision for a case.

**Response:** `FenceViewerDecision` or `404 Not Found`

#### POST /decisions
Issue a decision.

**Request Body:**
```json
{
  "caseId": "string (required)",
  "decisionDate": "ISO 8601 date",
  "issuedByName": "string (required)",
  "petitionerSharePercent": "number (required)",
  "respondentSharePercent": "number (required)",
  "estimatedTotalCostCents": "number",
  "fenceTypeRequired": "string",
  "fenceLocationDescription": "string",
  "decisionNarrative": "string (required)",
  "statutoryCitation": "string",
  "appealDeadlineDays": "number (default: 10)"
}
```

**Response:** `201 Created` with `FenceViewerDecision`

#### POST /cases/:id/appeal
Record an appeal.

**Request Body:**
```json
{
  "appealOutcome": "string"
}
```

**Response:** `FenceViewerCase`

---

## Weed Control

Base path: `/api/township/weed-control`

Noxious weed enforcement per IC 15-16-8.

### Complaints

#### GET /complaints
List weed complaints.

**Query Parameters:**
- `status`: Complaint status
- `violationType`: `noxious_weeds | tall_grass | brush | other`
- `propertyOwner`: Filter by owner name (partial match)
- `siteAddress`: Filter by address (partial match)
- `from`: ISO 8601 date
- `to`: ISO 8601 date
- `overdue`: `true` to filter overdue only

**Response:** `WeedComplaintSummary[]`

#### POST /complaints
Create a weed complaint.

**Request Body:**
```json
{
  "violationType": "noxious_weeds | tall_grass | brush | other (required)",
  "violationDescription": "string (required)",
  "complainantName": "string",
  "complainantPhone": "string",
  "complainantEmail": "string",
  "isAnonymous": "boolean",
  "propertyOwnerName": "string",
  "propertyOwnerAddressLine1": "string",
  "siteAddressLine1": "string",
  "parcelNumber": "string",
  "notes": "string"
}
```

**Response:** `201 Created` with `WeedComplaint`

#### GET /complaints/:id
Get a complaint by ID.

**Response:** `WeedComplaint`

#### PATCH /complaints/:id
Update a complaint.

#### POST /complaints/:id/comply
Mark complaint as complied (owner resolved issue).

#### POST /complaints/:id/close
Close a complaint.

### Notices

#### GET /complaints/:id/notices
List notices for a complaint.

#### POST /notices
Send a notice to property owner.

**Request Body:**
```json
{
  "complaintId": "string (required)",
  "noticeType": "initial | follow_up | final (required)",
  "deliveryMethod": "certified_mail | regular_mail | personal | posting (required)",
  "sentToName": "string (required)",
  "sentToAddress": "string (required)",
  "complianceDeadlineDays": "number (required)",
  "noticeContent": "string",
  "statutoryCitation": "string",
  "trackingNumber": "string"
}
```

#### POST /notices/:id/delivered
Record notice delivery.

#### POST /notices/:id/returned
Record notice returned undeliverable.

### Inspections

#### GET /complaints/:id/inspections
List inspections for a complaint.

#### POST /inspections
Record an inspection.

### Abatement

#### GET /complaints/:id/abatement
Get abatement record for a complaint.

#### POST /abatements
Record township abatement.

**Request Body:**
```json
{
  "complaintId": "string (required)",
  "abatementDate": "ISO 8601 date",
  "performedBy": "string (required)",
  "workDescription": "string (required)",
  "laborCostCents": "number",
  "equipmentCostCents": "number",
  "materialsCostCents": "number",
  "administrativeCostCents": "number",
  "notes": "string"
}
```

#### POST /abatements/:id/certify
Certify costs to county auditor for tax lien.

#### POST /abatements/:id/recover
Record cost recovery.

### Reporting

#### GET /overdue
Get complaints with overdue deadlines.

#### GET /stats
Get case statistics.

---

## Cemeteries

Base path: `/api/township/cemeteries`

Cemetery management per IC 23-14-68.

### Cemeteries

#### GET /
List cemeteries.

**Query Parameters:**
- `status`: `active | inactive | pioneer | abandoned`
- `name`: Filter by name (partial match)

**Response:** `Cemetery[]`

#### GET /:id
Get a cemetery by ID.

#### POST /
Create or update a cemetery.

**Request Body:**
```json
{
  "id": "string (optional, for update)",
  "name": "string (required)",
  "status": "active | inactive | pioneer | abandoned",
  "addressLine1": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "latitude": "number",
  "longitude": "number",
  "notes": "string"
}
```

#### PUT /:id
Update a cemetery.

### Maintenance

#### GET /:id/maintenance
List maintenance logs for a cemetery.

#### POST /:id/maintenance
Add a maintenance log.

**Request Body:**
```json
{
  "description": "string (required)",
  "date": "ISO 8601 date",
  "performedBy": "string"
}
```

### Plots

#### GET /:id/plots
List plots for a cemetery.

#### POST /:id/plots
Create or update a plot.

**Request Body:**
```json
{
  "section": "string",
  "lot": "string",
  "grave": "string",
  "deedHolderName": "string",
  "deedIssuedAt": "ISO 8601 date",
  "notes": "string"
}
```

### Burials

#### GET /plots/:plotId/burials
List burials for a plot.

#### POST /plots/:plotId/burials
Record a burial.

**Request Body:**
```json
{
  "decedentName": "string (required)",
  "dateOfBirth": "ISO 8601 date",
  "dateOfDeath": "ISO 8601 date",
  "burialDate": "ISO 8601 date",
  "veteran": "boolean",
  "notes": "string"
}
```

#### GET /burials/search?name={query}
Search burials by decedent name.

---

## Fire Contracts

Base path: `/api/township/fire`

Fire service contract management per IC 36-8.

### Contracts

#### GET /contracts
List fire service contracts.

**Query Parameters:**
- `isActive`: `true | false`
- `provider`: Filter by provider name (partial match)

#### GET /contracts/:id
Get a contract by ID.

#### POST /contracts
Create or update a contract.

**Request Body:**
```json
{
  "id": "string (optional, for update)",
  "providerName": "string (required)",
  "coverageDescription": "string (required)",
  "startDate": "ISO 8601 date (required)",
  "endDate": "ISO 8601 date",
  "annualCostCents": "number (required)",
  "fundId": "string (required)",
  "renewalNoticeDays": "number (default: 90)",
  "notes": "string",
  "isActive": "boolean (default: true)"
}
```

#### PUT /contracts/:id
Update a contract.

### Performance

#### GET /contracts/:id/performance
List performance snapshots for a contract.

#### POST /contracts/:id/performance
Record a performance snapshot.

**Request Body:**
```json
{
  "periodStart": "ISO 8601 date (required)",
  "periodEnd": "ISO 8601 date (required)",
  "runs": "number",
  "averageResponseMinutes": "number",
  "notes": "string"
}
```

---

## Insurance & Bonds

Base path: `/api/township/insurance`

Insurance and official bonds per IC 5-4-1.

### Carriers

#### GET /carriers
List insurance carriers.

#### GET /carriers/:id
Get a carrier by ID.

#### POST /carriers
Create a carrier.

#### PUT /carriers/:id
Update a carrier.

### Policies

#### GET /policies
List insurance policies.

**Query Parameters:**
- `policyType`: `general_liability | auto | property | workers_comp | errors_omissions | umbrella | cyber | other`
- `status`: `active | expired | cancelled | pending`
- `carrierId`: Filter by carrier
- `expiringWithinDays`: Filter by expiration

#### GET /policies/:id
Get a policy by ID.

#### POST /policies
Create a policy.

**Request Body:**
```json
{
  "policyType": "string (required)",
  "policyNumber": "string (required)",
  "carrierId": "string (required)",
  "effectiveDate": "ISO 8601 date (required)",
  "expirationDate": "ISO 8601 date (required)",
  "premiumAmountCents": "number (required)",
  "paymentFrequency": "annual | semi_annual | quarterly | monthly",
  "fundId": "string",
  "renewalNoticeDays": "number",
  "notes": "string"
}
```

#### PUT /policies/:id
Update a policy.

#### POST /policies/:id/renew
Renew a policy.

### Policy Coverages

#### GET /policies/:id/coverages
List coverages for a policy.

#### POST /policies/:id/coverages
Add a coverage.

#### DELETE /coverages/:id
Remove a coverage.

### Official Bonds

#### GET /bonds
List official bonds.

**Query Parameters:**
- `bondType`: `trustee | clerk | deputy | other`
- `status`: `active | expired | cancelled`
- `officialName`: Filter by official name (partial match)
- `expiringWithinDays`: Filter by expiration

#### GET /bonds/:id
Get a bond by ID.

#### POST /bonds
Create a bond.

**Request Body:**
```json
{
  "bondType": "trustee | clerk | deputy | other (required)",
  "officialName": "string (required)",
  "officialTitle": "string (required)",
  "bondNumber": "string",
  "carrierId": "string",
  "bondAmountCents": "number (required)",
  "premiumAmountCents": "number",
  "effectiveDate": "ISO 8601 date (required)",
  "expirationDate": "ISO 8601 date (required)",
  "renewalNoticeDays": "number",
  "notes": "string"
}
```

#### PUT /bonds/:id
Update a bond.

#### POST /bonds/:id/file
Record bond filing with county.

#### POST /bonds/:id/renew
Renew a bond.

### Renewals

#### GET /renewals?days={number}
Get upcoming renewals (policies and bonds).

---

## Policies (Shared)

Base path: `/api/policies`

Policy and resolution registry (shared across all unit types).

**Note:** This endpoint does NOT require township tenant.

### Documents

#### GET /
List policy documents.

**Query Parameters:**
- `documentType`: `policy | resolution | ordinance | standard | guideline`
- `category`: `eligibility | administration | safety | personnel | finance | governance | compliance | other`
- `status`: `draft | active | superseded | archived`
- `title`: Filter by title (partial match)
- `keyword`: Filter by keyword

#### GET /search?q={query}
Search policies by text.

#### GET /:id
Get a policy document by ID.

#### POST /
Create a policy document.

#### PUT /:id
Update a policy document.

#### POST /:id/version
Create a new version of a policy.

#### POST /:id/activate
Activate a draft policy.

#### POST /:id/archive
Archive a policy.

#### GET /:id/history
Get version history.

#### GET /by-number/:number
Get current version by document number.

#### GET /category/:category
Get all active policies in a category.

### Reviews

#### GET /:id/reviews
List reviews for a policy.

#### POST /:id/reviews
Schedule a review.

#### POST /reviews/:reviewId/complete
Complete a review.

#### GET /reviews/upcoming?days={number}
Get upcoming reviews.

### Acknowledgments

#### GET /:id/acknowledgments
List acknowledgments for a policy.

#### POST /:id/acknowledgments
Record an acknowledgment.

#### GET /:id/acknowledgments/check?name={name}
Check if a person has acknowledged a policy.

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message"
}
```

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no body
- `400 Bad Request` - Invalid request
- `403 Forbidden` - Tenant is not a township
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `501 Not Implemented` - Service not configured

---

## Demo Tenants

For development, use these tenant IDs in the `x-tenant-id` header:

| Tenant ID | Name | Type |
|-----------|------|------|
| `fall-creek-twp` | Fall Creek Township | TOWNSHIP |
| `stony-creek-twp` | Stony Creek Township | TOWNSHIP |
| `lapel-in` | Town of Lapel | TOWN (403 on township endpoints) |
| `anderson-in` | City of Anderson | CITY (403 on township endpoints) |

## Example Requests

### Create an Assistance Application

```bash
curl -X POST http://localhost:3000/api/township/assistance/applications \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: fall-creek-twp" \
  -d '{
    "applicantName": "John Doe",
    "applicantPhone": "765-555-1234",
    "addressLine1": "123 Main St",
    "city": "Pendleton",
    "state": "IN",
    "postalCode": "46064",
    "household": [
      {"name": "John Doe", "age": 45, "relationship": "applicant"},
      {"name": "Jane Doe", "age": 42, "relationship": "spouse"}
    ],
    "monthlyIncomeCents": 200000,
    "requestedBenefitTypes": ["rent", "utilities"],
    "requestedAmountCents": 50000
  }'
```

### Create a Fence Viewer Case

```bash
curl -X POST http://localhost:3000/api/township/fence-viewer/cases \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: fall-creek-twp" \
  -d '{
    "disputeType": "boundary",
    "fenceLocationDescription": "Between parcels 48-11-01-100-001 and 48-11-01-100-002"
  }'
```

### Create an Official Bond

```bash
curl -X POST http://localhost:3000/api/township/insurance/bonds \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: fall-creek-twp" \
  -d '{
    "bondType": "trustee",
    "officialName": "James Smith",
    "officialTitle": "Township Trustee",
    "bondAmountCents": 1500000,
    "effectiveDate": "2025-01-01",
    "expirationDate": "2028-12-31"
  }'
```
