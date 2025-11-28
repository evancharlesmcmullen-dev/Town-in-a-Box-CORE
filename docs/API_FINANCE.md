# Finance Ledger API

HTTP API for Indiana-style municipal fund accounting.

## Base URL

```
/api/finance
```

## Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `x-tenant-id` | Tenant identifier (default: `lapel-in`) | Yes |
| `x-request-id` | Request correlation ID for tracing | Recommended |

## Overview

The Finance Ledger API provides double-entry fund accounting operations designed for Indiana municipal governments. It supports:

- **Funds**: Self-balancing sets of accounts (General, MVH, Utilities, etc.)
- **Accounts**: Chart of accounts entries (Revenue, Expenditure, Cash, etc.)
- **Transactions**: Double-entry ledger entries with balanced debits/credits
- **Appropriations**: Budget authority tracking with usage summaries

All transactions are validated to ensure debits equal credits (balanced transactions).

---

## Funds

### Create Fund

```http
POST /api/finance/funds
```

Create a new fund.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Fund code (e.g., "0101") |
| `name` | string | Yes | Display name |
| `type` | FundType | Yes | Fund type classification |
| `isActive` | boolean | No | Active status (default: true) |
| `sboaCode` | string | No | SBOA classification code |
| `dlgfFundNumber` | string | No | DLGF fund number |
| `isMajorFund` | boolean | No | GASB 34 major fund flag |
| `description` | string | No | Fund purpose description |

**Fund Types:**
`GENERAL`, `MVH`, `LOCAL_ROAD_AND_STREET`, `CUMULATIVE_CAPITAL_DEVELOPMENT`, `DEBT_SERVICE`, `RAINY_DAY`, `UTILITY_OPERATING`, `UTILITY_DEBT`, `GRANT`, `FIRE`, `PARK`, `CEMETERY`, `TIF`, `OTHER`

**Example:**

```json
{
  "code": "0101",
  "name": "General Fund",
  "type": "GENERAL",
  "isMajorFund": true,
  "description": "Primary operating fund"
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "tenantId": "lapel-in",
  "code": "0101",
  "name": "General Fund",
  "type": "GENERAL",
  "isActive": true,
  "isMajorFund": true,
  "description": "Primary operating fund",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z"
}
```

### List Funds

```http
GET /api/finance/funds
```

List all funds for the tenant.

**Response:** `200 OK` - Array of Fund objects

### Get Fund

```http
GET /api/finance/funds/:id
```

Get a fund by ID.

**Response:** `200 OK` - Fund object, or `404 Not Found`

### Update Fund

```http
PATCH /api/finance/funds/:id
```

Update a fund.

**Request Body:** Any subset of: `name`, `type`, `isActive`, `sboaCode`, `dlgfFundNumber`, `isMajorFund`, `description`

**Response:** `200 OK` - Updated Fund object

### Get Fund Balance Summary

```http
GET /api/finance/funds/:id/summary?asOfDate=YYYY-MM-DD
```

Get fund cash balance as of a specific date.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `asOfDate` | Yes | Date in YYYY-MM-DD format |

**Response:** `200 OK`

```json
{
  "fundId": "uuid",
  "asOfDate": "2025-01-31",
  "cashBalanceCents": 1500000,
  "encumberedCents": 0,
  "availableCents": 1500000
}
```

---

## Accounts

### Create Account

```http
POST /api/finance/accounts
```

Create a new chart of accounts entry.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Account code (e.g., "101.000") |
| `name` | string | Yes | Display name |
| `category` | AccountCategory | Yes | Account category |
| `isActive` | boolean | No | Active status (default: true) |
| `sboaCode` | string | No | SBOA account code |
| `description` | string | No | Account description |

**Account Categories:**
`REVENUE`, `EXPENDITURE`, `CASH`, `RECEIVABLE`, `PAYABLE`, `FUND_BALANCE`, `OTHER`

**Example:**

```json
{
  "code": "101.000",
  "name": "Cash Account",
  "category": "CASH"
}
```

**Response:** `201 Created`

### List Accounts

```http
GET /api/finance/accounts
```

List accounts with optional filtering.

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `category` | Filter by account category |
| `isActive` | Filter by active status |

**Response:** `200 OK` - Array of Account objects

### Get Account

```http
GET /api/finance/accounts/:id
```

Get an account by ID.

**Response:** `200 OK` - Account object, or `404 Not Found`

---

## Transactions

### Create Transaction

```http
POST /api/finance/transactions
```

Create a new transaction. **Transaction must be balanced** (total debits = total credits).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | TransactionType | Yes | Transaction type |
| `transactionDate` | string | Yes | Transaction date (YYYY-MM-DD) |
| `reference` | string | No | Reference number (check #, receipt #) |
| `description` | string | Yes | Transaction description |
| `lines` | TransactionLine[] | Yes | Line items (must balance) |

**Transaction Types:**
`RECEIPT`, `DISBURSEMENT`, `JOURNAL_ENTRY`, `ADJUSTMENT`

**Transaction Line:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fundId` | string | Yes | Fund ID |
| `accountId` | string | Yes | Account ID |
| `amountCents` | number | Yes | Amount in cents (positive) |
| `isDebit` | boolean | Yes | True for debit, false for credit |
| `appropriationId` | string | No | Link to appropriation |
| `memo` | string | No | Line item memo |

**Example (Receipt):**

```json
{
  "type": "RECEIPT",
  "transactionDate": "2025-01-15",
  "reference": "REC-001",
  "description": "Property tax receipt",
  "lines": [
    {
      "fundId": "general-fund-id",
      "accountId": "cash-account-id",
      "amountCents": 10000,
      "isDebit": true
    },
    {
      "fundId": "general-fund-id",
      "accountId": "revenue-account-id",
      "amountCents": 10000,
      "isDebit": false
    }
  ]
}
```

**Response:** `201 Created`

**Error Response (Unbalanced):** `400 Bad Request`

```json
{
  "error": "Transaction is not balanced"
}
```

### List Transactions

```http
GET /api/finance/transactions
```

List transactions with optional filtering.

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `fundId` | Filter by fund ID |
| `accountId` | Filter by account ID |
| `fromDate` | Filter from date (YYYY-MM-DD) |
| `toDate` | Filter to date (YYYY-MM-DD) |
| `type` | Filter by transaction type |

**Response:** `200 OK` - Array of Transaction objects with lines

### Get Transaction

```http
GET /api/finance/transactions/:id
```

Get a transaction by ID.

**Response:** `200 OK` - Transaction object with lines, or `404 Not Found`

---

## Appropriations

### Create Appropriation

```http
POST /api/finance/appropriations
```

Create a new budget appropriation.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fundId` | string | Yes | Fund ID |
| `accountId` | string | Yes | Expenditure account ID |
| `budgetYear` | number | Yes | Budget year |
| `adoptedAmountCents` | number | Yes | Adopted amount in cents |
| `additionalAppropriationCents` | number | No | Additional appropriations |
| `reductionsCents` | number | No | Reductions |
| `ordinanceNumber` | string | No | Adopting ordinance number |
| `adoptedDate` | string | No | Adoption date |

**Example:**

```json
{
  "fundId": "general-fund-id",
  "accountId": "supplies-account-id",
  "budgetYear": 2025,
  "adoptedAmountCents": 500000,
  "ordinanceNumber": "2024-10"
}
```

**Response:** `201 Created`

### List Appropriations

```http
GET /api/finance/appropriations
```

List appropriations with optional filtering.

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `budgetYear` | Filter by budget year |
| `fundId` | Filter by fund ID |
| `accountId` | Filter by account ID |

**Response:** `200 OK` - Array of Appropriation objects

### Get Appropriation

```http
GET /api/finance/appropriations/:id
```

Get an appropriation by ID.

**Response:** `200 OK` - Appropriation object, or `404 Not Found`

### Get Appropriation Usage Summary

```http
GET /api/finance/appropriations/:id/usage
```

Get appropriation usage summary showing adopted, expended, and available amounts.

**Response:** `200 OK`

```json
{
  "appropriationId": "uuid",
  "budgetYear": 2025,
  "adoptedAmountCents": 500000,
  "additionalAppropriationCents": 0,
  "reductionsCents": 0,
  "expendedCents": 50000,
  "encumberedCents": 0,
  "availableCents": 450000
}
```

---

## Seeding (Development Only)

### Seed Default Indiana Town Funds

```http
POST /api/finance/seed/default-indiana-town-funds
```

**DEV/TEST ONLY** - Seeds the tenant with default Indiana town funds (General, MVH, Utility, etc.).

**Response:** `201 Created`

```json
{
  "message": "Seeded 10 funds",
  "fundsCreated": 10,
  "totalFunds": 10,
  "funds": [...]
}
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**

| Code | Description |
|------|-------------|
| `400` | Bad request (validation error, unbalanced transaction) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Multi-Tenancy

All operations are scoped to the tenant specified in the `x-tenant-id` header. Data created by one tenant is not visible to other tenants.

---

## Double-Entry Accounting Rules

For cash balance calculations:

- **CASH accounts:** Debits increase balance, credits decrease balance
- **REVENUE accounts:** Credits increase (normal entry)
- **EXPENDITURE accounts:** Debits increase (normal entry)

Standard transaction patterns:

- **Receipt:** Debit CASH, Credit REVENUE
- **Disbursement:** Debit EXPENDITURE, Credit CASH

All transactions must balance (total debits = total credits).
