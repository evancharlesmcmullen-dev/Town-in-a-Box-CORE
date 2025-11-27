# Example Township Tenant Configuration

This document describes how to configure an Indiana Township tenant in Town-in-a-Box.

## Tenant Identity

Every tenant starts with a **TenantIdentity** that describes the local government unit:

```json
{
  "tenantId": "fall-creek-twp",
  "displayName": "Fall Creek Township",
  "state": "IN",
  "entityClass": "TOWNSHIP",
  "population": 8500,
  "countyName": "Madison"
}
```

### Identity Fields

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | string | Unique identifier (e.g., `fall-creek-twp`, `stony-creek-twp`) |
| `displayName` | string | Human-readable name for UI display |
| `state` | USStateCode | Two-letter state code (currently `IN` for Indiana) |
| `entityClass` | EntityClass | Unit type: `TOWNSHIP`, `TOWN`, `CITY`, `COUNTY`, `SPECIAL_DISTRICT` |
| `population` | number? | Population count (optional, used for some thresholds) |
| `countyName` | string? | County where the unit is located |

## Unit Types

The `entityClass` field determines which packs and modules are available:

| Entity Class | Description | Example Modules |
|--------------|-------------|-----------------|
| `TOWNSHIP` | Indiana Civil Township | Township Assistance, Fence Viewer, Weed Control |
| `TOWN` | Incorporated Town | Planning, Utilities, Permits, Code Enforcement |
| `CITY` | Incorporated City | All Town modules + Legislation |
| `COUNTY` | County Government | Coming soon |
| `SPECIAL_DISTRICT` | Fire Territory, Library District, etc. | Domain-specific |

## Township Configuration

Townships use the **INTownshipConfig** interface. The pack derives sensible defaults from the tenant identity, but you can override any setting.

### Full Configuration Example

```json
{
  "domain": "township",
  "enabled": true,

  "assistanceEnabled": true,
  "assistanceInvestigationDays": 3,
  "assistanceCasesConfidential": true,

  "fireModel": "TERRITORY",
  "fireTerritoryId": "fall-creek-fire-territory",

  "cemeteryEnabled": true,
  "cemeteryCount": 2,

  "fenceViewerEnabled": true,
  "fenceViewerAppealDays": 10,

  "weedControlEnabled": true,
  "weedControlNoticeDays": 10,

  "insuranceBondsEnabled": true,
  "trusteeBondRequired": true,
  "clerkBondRequired": true,

  "policiesEnabled": true,

  "trusteeIsFiscalOfficer": true,
  "boardApprovesClaims": true,
  "boardMemberCount": 3,

  "enabledModules": [
    "township-assistance",
    "fire-contracts",
    "cemeteries",
    "insurance-bonds",
    "fence-viewer",
    "weed-control",
    "policies"
  ]
}
```

### Configuration Keys Explained

#### Township Assistance (Poor Relief)

| Key | Default | Description |
|-----|---------|-------------|
| `assistanceEnabled` | `true` | Township assistance is a **statutory duty** per IC 12-20 |
| `assistanceInvestigationDays` | `3` | 72-hour investigation deadline per IC 12-20-6-8.5 |
| `assistanceCasesConfidential` | `true` | Case files are APRA-exempt (confidential) |

#### Fire Service

| Key | Default | Description |
|-----|---------|-------------|
| `fireModel` | `"CONTRACT"` | How fire service is delivered |
| `fireTerritoryId` | - | Territory ID if using `TERRITORY` model |
| `fireContractProvider` | - | Provider name if using `CONTRACT` model |

**Fire Model Options:**
- `CONTRACT` - Township contracts with an external fire department
- `TERRITORY` - Township is part of a Fire Protection Territory (IC 36-8-19)
- `DEPARTMENT` - Township operates its own fire department (rare)
- `MUTUAL_AID` - Mutual aid agreements only (no formal structure)

#### Cemetery Management

| Key | Default | Description |
|-----|---------|-------------|
| `cemeteryEnabled` | `true` | Whether cemetery engine is active |
| `cemeteryCount` | - | Number of cemeteries managed (optional metadata) |

#### Fence Viewer

| Key | Default | Description |
|-----|---------|-------------|
| `fenceViewerEnabled` | `true` | **Statutory duty** per IC 32-26 |
| `fenceViewerAppealDays` | `10` | Appeal deadline per IC 32-26-9-7 |

#### Weed Control

| Key | Default | Description |
|-----|---------|-------------|
| `weedControlEnabled` | `true` | Weed enforcement per IC 15-16-8 |
| `weedControlNoticeDays` | `10` | Default compliance notice period |

#### Insurance & Bonds

| Key | Default | Description |
|-----|---------|-------------|
| `insuranceBondsEnabled` | `true` | Track insurance policies and official bonds |
| `trusteeBondRequired` | `true` | **Statutory requirement** per IC 5-4-1 |
| `clerkBondRequired` | `true` | **Statutory requirement** per IC 5-4-1 |

#### Policies & Resolutions

| Key | Default | Description |
|-----|---------|-------------|
| `policiesEnabled` | `true` | Track adopted policies and resolutions |

#### Governance

| Key | Default | Description |
|-----|---------|-------------|
| `trusteeIsFiscalOfficer` | `true` | Trustee serves as fiscal officer (statutory) |
| `boardApprovesClaims` | `true` | Board approves claims at meetings |
| `boardMemberCount` | `3` | Number of township board members |

#### Enabled Modules

The `enabledModules` array controls which engines are active for this tenant:

| Module ID | Description |
|-----------|-------------|
| `township-assistance` | Poor relief / township assistance program |
| `fire-contracts` | Fire service contract and territory tracking |
| `cemeteries` | Cemetery lot sales, burials, maintenance |
| `insurance-bonds` | Insurance policies and official bonds |
| `fence-viewer` | Fence dispute resolution service |
| `weed-control` | Noxious weed enforcement |
| `policies` | Policy and resolution registry |

## Using the Pack

The Township Pack automatically derives defaults from the tenant identity:

```typescript
import { buildTownshipConfig, isTownship } from '../states/in/township';

const identity = {
  tenantId: 'fall-creek-twp',
  displayName: 'Fall Creek Township',
  state: 'IN',
  entityClass: 'TOWNSHIP',
};

if (isTownship(identity)) {
  const config = buildTownshipConfig(identity, {
    // Override specific settings
    fireModel: 'TERRITORY',
    fireTerritoryId: 'fall-creek-fire-territory',
  });

  // config.assistanceEnabled === true (statutory default)
  // config.fenceViewerEnabled === true (statutory duty)
  // config.fireModel === 'TERRITORY' (overridden)
}
```

## Demo Tenants

For development and testing, the following demo township tenants are pre-configured:

| Tenant ID | Name | Unit Type | County |
|-----------|------|-----------|--------|
| `fall-creek-twp` | Fall Creek Township | TOWNSHIP | Madison |
| `stony-creek-twp` | Stony Creek Township | TOWNSHIP | Madison |

Use the `x-tenant-id` header to switch between tenants in API calls:

```bash
curl -H "x-tenant-id: fall-creek-twp" http://localhost:3000/api/township/assistance/stats
```

## Statutory Duties

Indiana townships have the following statutory duties (automatically reflected in defaults):

1. **Township Assistance (Poor Relief)** - IC 12-20
2. **Fence Viewer Services** - IC 32-26
3. **Weed Control** - IC 15-16-8
4. **Cemetery Maintenance** - IC 23-14-68
5. **Fire Protection** - IC 36-8
6. **Official Bonds** - IC 5-4-1
7. **Open Door Law Compliance** - IC 5-14-1.5
8. **APRA Compliance** - IC 5-14-3
9. **SBOA Financial Reporting** - IC 5-11

## See Also

- [Indiana Township Pack](../architecture/in-township-pack.md)
- [Township API Contract](../http/in-township-api-contract.md)
- [Unit Type Handling](../../src/core/state/unit-type.ts)
