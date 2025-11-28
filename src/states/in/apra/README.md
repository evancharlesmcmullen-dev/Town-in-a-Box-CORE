# Indiana APRA (Access to Public Records Act) Module

This module implements the Indiana Access to Public Records Act (IC 5-14-3) configuration
and utilities for the Town-in-a-Box platform.

## Overview

The Indiana APRA module provides:

- **Configuration types** (`INApraConfig`) for APRA compliance settings
- **StateDomainPack** (`InApraPack`) that computes defaults based on tenant identity
- **Deadline calculators** for statutory response deadlines
- **Fee estimation** helpers
- **Exemption management** utilities
- **Entity-class based** record type and custodian helpers

## Key Statutory Requirements

Per IC 5-14-3:

| Requirement | Citation | Default |
|-------------|----------|---------|
| Response deadline | IC 5-14-3-9(a) | 7 business days |
| Extended response | IC 5-14-3-9 | 14 business days |
| Copy fees | IC 5-14-3-8 | $0.10/page B&W |
| Reasonable particularity | IC 5-14-3-3(a) | Required |
| Exemptions | IC 5-14-3-4 | See config |

## Usage

### Getting APRA Configuration

```typescript
import { getApraConfig } from '../../../core/tenancy/domain-config.service';
import { StateTenantConfig, TenantIdentity } from '../../../core/state';

// Define tenant identity
const townIdentity: TenantIdentity = {
  tenantId: 'example-town',
  displayName: 'Example Town',
  state: 'IN',
  entityClass: 'TOWN',
  population: 5000,
  countyName: 'Example County',
};

// Define tenant config with APRA module enabled
const tenantConfig: StateTenantConfig = {
  tenantId: 'example-town',
  name: 'Example Town',
  state: 'IN',
  jurisdiction: { /* ... */ },
  dataStore: { vendor: 'memory', databaseName: 'example_town' },
  enabledModules: [
    { moduleId: 'apra', enabled: true },
  ],
};

// Get resolved APRA config
const apraConfig = getApraConfig(tenantConfig, townIdentity);

if (apraConfig) {
  console.log('Response deadline:', apraConfig.standardResponseDays, 'business days');
  console.log('Delivery methods:', apraConfig.allowedDeliveryMethods);
  console.log('Copy fee:', apraConfig.defaultPerPageFee);
}
```

### Calculating Deadlines

```typescript
import { calculateApraDeadline, checkApraTimeliness } from './in-apra.pack';

// Calculate deadline for a new request
const requestReceived = new Date('2025-01-06T09:00:00');
const deadline = calculateApraDeadline(requestReceived);

console.log(deadline.deadlineIso);  // "2025-01-15T09:00:00.000Z"
console.log(deadline.explanation);  // "Response due by Wednesday, January 15, 2025..."

// With extension
const extendedDeadline = calculateApraDeadline(requestReceived, { useExtension: true });
console.log(extendedDeadline.businessDays);  // 14

// Check if a response is timely
const responseDate = new Date('2025-01-14');
const timeliness = checkApraTimeliness(requestReceived, responseDate);
console.log(timeliness.isTimely);  // true
```

### Estimating Fees

```typescript
import { estimateApraFees } from './in-apra.pack';

const estimate = estimateApraFees(townIdentity, {
  pages: 100,
  isColor: false,
  certifications: 2,
  requiresMailing: true,
});

console.log(estimate.formattedTotal);  // "$25.00"
console.log(estimate.breakdown);
// [
//   { item: "100 B&W pages @ $0.10", amount: 10 },
//   { item: "2 certification(s) @ $5.00", amount: 10 },
//   { item: "Mailing/postage (estimated)", amount: 5 }
// ]
```

### Working with Exemptions

```typescript
import {
  getExemptionsForRecordType,
  generateDenialTemplate,
  DEFAULT_APRA_EXEMPTIONS,
} from './in-apra.pack';

// Get exemptions that might apply to personnel files
const exemptions = getExemptionsForRecordType('personnel_files');
// Returns: [PERSONNEL_FILE, SOCIAL_SECURITY exemptions]

// Generate a denial letter template
const personnelExemption = DEFAULT_APRA_EXEMPTIONS.find(e => e.code === 'PERSONNEL_FILE');
if (personnelExemption) {
  const letter = generateDenialTemplate(personnelExemption, 'Town of Example');
  console.log(letter);
}
```

### Entity-Class Based Helpers

```typescript
import { getCommonRecordTypes, getRecordsCustodianTitle } from './in-apra.pack';

// Get typical record types for a town
const recordTypes = getCommonRecordTypes('TOWN');
// ['meeting_minutes', 'ordinances', 'resolutions', 'contracts', 'emails',
//  'personnel_files', 'financial_records', 'permits', 'zoning_records', 'utility_records']

// Get the custodian title
const custodian = getRecordsCustodianTitle('TOWN');
// 'Clerk-Treasurer'
```

## Configuration Fields

### Deadlines / Timing

| Field | Type | Description |
|-------|------|-------------|
| `standardResponseDays` | `number` | Standard response deadline (default: 7) |
| `extensionResponseDays` | `number` | Extended deadline if granted (default: 14) |
| `businessDaysOnly` | `boolean` | Count only business days (default: true) |

### Fee Schedule

| Field | Type | Description |
|-------|------|-------------|
| `allowCopyFees` | `boolean` | Whether copy fees are permitted |
| `defaultPerPageFee` | `number` | Per-page fee in dollars (default: $0.10) |
| `certificationFee` | `number` | Fee per certified copy (default: $5.00) |
| `allowElectronicCopyFees` | `boolean` | Charge for electronic copies |
| `maxSearchTimeWithoutChargeMinutes` | `number` | Free search time (default: 30) |

### Delivery Methods

| Field | Type | Description |
|-------|------|-------------|
| `allowedDeliveryMethods` | `string[]` | Available delivery options |
| `allowInspectionOnlyRequests` | `boolean` | Allow inspection without copying |

### Exemptions / Redaction

| Field | Type | Description |
|-------|------|-------------|
| `requiresRedactionLog` | `boolean` | Log all redactions |
| `maskSensitiveFieldsByDefault` | `boolean` | Auto-mask SSN, etc. |
| `requiresReasonableParticularity` | `boolean` | Enforce IC 5-14-3-3(a) |
| `exemptions` | `ApraExemption[]` | Available exemptions |
| `denialReasons` | `DenialReason[]` | Standard denial reasons |

### Logging / Retention

| Field | Type | Description |
|-------|------|-------------|
| `logRequests` | `boolean` | Log all APRA requests |
| `requestLogRetentionYears` | `number` | How long to keep logs |

## Architecture

```
src/states/in/apra/
├── index.ts           # Pack registration and exports
├── in-apra.config.ts  # INApraConfig type and defaults
├── in-apra.pack.ts    # StateDomainPack + helper functions
└── README.md          # This file

src/engines/records/
├── apra.service.ts    # Service interface
├── apra.types.ts      # Domain types
├── apra-fee.calculator.ts  # Fee calculation engine
├── apra-notification.service.ts  # Notifications
├── ai-apra.service.ts # AI-enhanced features
├── in-memory-apra.service.ts  # In-memory implementation
└── postgres-apra.service.ts   # Postgres implementation

src/http/routes/
└── records.routes.ts  # HTTP API endpoints
```

## Integration with HTTP API

The APRA HTTP API is available at `/api/apra/*` and uses the configuration
resolved through `getApraConfig()`. See `src/http/routes/records.routes.ts`
for endpoint details.

## Public Access Counselor

For APRA questions or complaints, contact the Indiana Public Access Counselor:

- Website: https://www.in.gov/pac/
- Email: pac@oag.in.gov

## Related Documentation

- [IC 5-14-3 (APRA)](https://iga.in.gov/laws/2024/ic/titles/5#5-14-3)
- [25 IAC 1-1-1 (Fee Schedule)](https://www.in.gov/pac/)
- [Indiana Finance Module](../finance/README.md)
- [Indiana Meetings Module](../meetings/README.md)
