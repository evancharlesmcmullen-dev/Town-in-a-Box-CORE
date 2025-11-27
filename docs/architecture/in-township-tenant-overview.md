# Indiana Township Tenant Overview

This document explains how Township tenants are configured, how the Township pack is registered, and how we distinguish Towns vs Townships vs Cities in tenant configuration.

## What Modules Does a Township Tenant Have?

When a tenant is configured as an Indiana Township (`entityClass: 'TOWNSHIP'`), it automatically has access to the following modules:

### Shared Modules (Used by All Indiana Local Government Types)

| Module | Engine | Purpose |
|--------|--------|---------|
| **Finance** | `src/engines/finance/` | SBOA-compliant fund accounting, claims, appropriations |
| **Meetings** | `src/engines/meetings/` | Open Door Law compliance, notices, agendas, minutes |
| **APRA/Records** | `src/engines/records/` | Public records requests per IC 5-14-3 |

### Township-Specific Modules

| Module | Engine | Purpose |
|--------|--------|---------|
| **Township Assistance** | `src/engines/township-assistance/` | Poor relief per IC 12-20 |
| **Fire Contracts** | `src/engines/fire/` | Fire protection contracts and territories |
| **Cemetery** | `src/engines/cemeteries/` | Cemetery management per IC 23-14-68 |
| **Insurance & Bonds** | `src/engines/insurance-bonds/` | Policy tracking and official bonds per IC 5-4-1 |
| **Fence Viewer** | `src/engines/fence-viewer/` | Division fence disputes per IC 32-26 |
| **Weed Control** | `src/engines/weed-control/` | Noxious weed enforcement per IC 15-16-8 |
| **Policies** | `src/engines/policies/` | Policy/resolution registry |

## How is the Township Pack Registered?

The Indiana Township Pack follows the `StateDomainPack` pattern introduced for "thinking" packs.

### Registration Flow

1. **Pack Definition** (`src/states/in/township/in-township.pack.ts`):
   ```typescript
   export const InTownshipPack: StateDomainPack<Partial<INTownshipConfig>> = {
     state: 'IN',
     domain: 'township',
     getDefaultConfig(identity: TenantIdentity): Partial<INTownshipConfig> {
       // Return township-specific defaults
     },
   };
   ```

2. **Pack Registration** (`src/states/in/township/index.ts`):
   ```typescript
   import { registerDomainPack } from '../../../core/state/state-registry';
   import { InTownshipPack } from './in-township.pack';

   registerDomainPack(InTownshipPack);
   ```

3. **State Index Import** (`src/states/in/index.ts`):
   ```typescript
   export * from './township/in-township.pack';
   import './township';  // Triggers registration
   ```

4. **Global Registry** (`src/core/state/state-registry.ts`):
   - The `registerDomainPack()` function adds the pack to the global `stateRegistry`
   - Packs are keyed by `${state}:${domain}` (e.g., `IN:township`)

### Usage

```typescript
import { getDomainPack } from '../core/state/state-registry';
import { INTownshipConfig } from '../states/in/township';

const pack = getDomainPack<INTownshipConfig>('IN', 'township');
const config = pack?.getDefaultConfig(tenantIdentity);
```

## How Do We Distinguish Town vs Township vs City?

The system uses a combination of `TenantIdentity.entityClass` and state pack configuration.

### Entity Class Enum

```typescript
// From src/core/state/state.types.ts
interface TenantIdentity {
  tenantId: string;
  displayName: string;
  state: USStateCode;
  entityClass: 'TOWN' | 'CITY' | 'TOWNSHIP' | 'COUNTY' | 'SPECIAL_DISTRICT';
  population?: number;
  countyName?: string;
}
```

### How Packs Use Entity Class

Each domain pack checks `identity.entityClass` to determine applicable configuration:

```typescript
// Township Pack
getDefaultConfig(identity: TenantIdentity): Partial<INTownshipConfig> {
  if (identity.entityClass !== 'TOWNSHIP') {
    return { enabled: false, enabledModules: [] };
  }
  // Return township-specific config...
}

// Meetings Pack
function getDefaultGoverningBodies(entityClass: TenantIdentity['entityClass']): GoverningBodyType[] {
  switch (entityClass) {
    case 'TOWN':      return ['COUNCIL', 'BOARD', 'PLAN_COMMISSION'];
    case 'CITY':      return ['COUNCIL', 'BOARD', 'BZA', 'PLAN_COMMISSION', 'REDEVELOPMENT'];
    case 'TOWNSHIP':  return ['BOARD'];
    case 'COUNTY':    return ['COUNCIL', 'BOARD', 'COMMISSION', 'PLAN_COMMISSION', 'BZA'];
  }
}
```

### Tenant Configuration Example

**Township Tenant:**
```typescript
export const fallCreekTwpIdentity: TenantIdentity = {
  tenantId: 'fall-creek-twp',
  displayName: 'Fall Creek Township',
  state: 'IN',
  entityClass: 'TOWNSHIP',  // <-- Key distinction
  population: 8500,
  countyName: 'Madison',
};

export const fallCreekTwpConfig: StateTenantConfig = {
  tenantId: 'fall-creek-twp',
  name: 'Fall Creek Township',
  state: 'IN',
  jurisdiction: {
    tenantId: 'fall-creek-twp',
    state: 'IN',
    kind: 'township',
    name: 'Fall Creek Township',
    authorityTags: ['fenceViewer', 'weedControl', 'poorRelief'],
  },
  dataStore: { type: 'in-memory' },
  enabledModules: [
    { moduleId: 'finance', enabled: true },
    { moduleId: 'meetings', enabled: true },
    { moduleId: 'apra', enabled: true },
    { moduleId: 'township', enabled: true },  // <-- Township pack
  ],
};
```

**Town Tenant (for comparison):**
```typescript
export const lapelIdentity: TenantIdentity = {
  tenantId: 'lapel-in',
  displayName: 'Town of Lapel',
  state: 'IN',
  entityClass: 'TOWN',  // <-- Different entity class
  population: 2350,
  countyName: 'Madison',
};
```

### Helper Function

```typescript
import { isTownship } from '../states/in/township';

if (isTownship(tenantIdentity)) {
  // Initialize township-specific engines
  const assistanceService = new InMemoryTownshipAssistanceService();
  const fenceViewerService = new InMemoryFenceViewerService();
  // ...
}
```

## Key Differences Between Government Types

| Aspect | Town | Township | City |
|--------|------|----------|------|
| **Fiscal Officer** | Clerk-Treasurer | Trustee | Controller |
| **Governing Body** | Town Council | Township Board | Common Council |
| **Fire Service** | Usually own dept | Usually contracts | Usually own dept |
| **Poor Relief** | No | Yes (IC 12-20) | No |
| **Fence Viewer** | No | Yes (IC 32-26) | No |
| **Weed Control** | Yes (if adopted) | Yes (IC 15-16-8) | Yes (if adopted) |
| **Planning/Zoning** | Yes (if adopted) | Limited | Yes |
| **LIT Authority** | Pop ≥ 3,501 | No | Pop ≥ 3,501 |

## Configuration Resolution Flow

```
1. Tenant Created with entityClass: 'TOWNSHIP'
                    ↓
2. Application loads enabled modules from StateTenantConfig
                    ↓
3. For 'township' module, lookup pack: getDomainPack('IN', 'township')
                    ↓
4. Pack.getDefaultConfig(identity) returns statutory defaults
                    ↓
5. Merge with any tenant-specific overrides
                    ↓
6. Final config determines which engines to initialize
```

## Adding Support for a New Government Type

To add support for a new government type (e.g., School District):

1. **Add to entity class type** (`src/core/state/state.types.ts`):
   ```typescript
   entityClass: 'TOWN' | 'CITY' | 'TOWNSHIP' | 'COUNTY' | 'SPECIAL_DISTRICT' | 'SCHOOL_DISTRICT';
   ```

2. **Add to state metadata** (`src/states/in/index.ts`):
   ```typescript
   supportedGovKinds: [
     // ... existing ...
     { kind: 'school-district', formId: 'IN_SCHOOL', displayName: 'Indiana School Corporation' },
   ],
   ```

3. **Create domain pack** (if needed):
   ```
   src/states/in/school/
   ├── in-school.config.ts
   ├── in-school.pack.ts
   └── index.ts
   ```

4. **Update shared packs** to handle new entity class in their `getDefaultConfig()`.

## See Also

- [Indiana Township Module Map](./in-township-module-map.md) - Detailed module descriptions
- `src/states/in/township/in-township.pack.ts` - Pack implementation
- `src/core/state/state-registry.ts` - Global registry
- `src/core/state/state.types.ts` - Core type definitions
