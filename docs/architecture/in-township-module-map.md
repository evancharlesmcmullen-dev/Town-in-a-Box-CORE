# Indiana Township Module Map

This document describes the nine core modules (plus shared Policies library) that comprise the complete Township product within Town-in-a-Box. These modules map to the statutory duties and operational needs of Indiana townships.

## Module Overview

| Module | Engine | Directory | Status |
|--------|--------|-----------|--------|
| Open Door & Meetings | Existing `meetings` | `src/engines/meetings/` | Existing |
| APRA & Records | Existing `records` | `src/engines/records/` | Existing |
| Finance & SBOA/DLGF | Existing `finance` | `src/engines/finance/` | Existing |
| Township Assistance | Existing `township-assistance` | `src/engines/township-assistance/` | Existing |
| Fire/EMS Contracts | Existing `fire` | `src/engines/fire/` | Existing |
| Cemetery Management | Existing `cemeteries` | `src/engines/cemeteries/` | Existing |
| Insurance & Bonds | New `insurance-bonds` | `src/engines/insurance-bonds/` | New |
| Fence Viewer | New `fence-viewer` | `src/engines/fence-viewer/` | New |
| Weed Control | New `weed-control` | `src/engines/weed-control/` | New |
| Policies & Resolutions | New `policies` | `src/engines/policies/` | New (Shared) |

---

## 1. Open Door & Meetings

**Engine**: Existing `meetings` engine
**Directory**: `src/engines/meetings/`

Township board meetings and any sub-body meetings must comply with Indiana Open Door Law (IC 5-14-1.5).

### Key Entities
- `Meeting` - Scheduled meetings with notice requirements
- `GoverningBody` - Township board (trustees use `BOARD` type)
- `Minutes` - Official meeting minutes with vote records
- `VoteRecord` - Individual votes on motions

### Key Workflows
- Schedule board meetings with 48-hour notice
- Post agenda and meeting notice per IC 5-14-1.5-5
- Record minutes, attendance, and votes
- Handle executive sessions (personnel, litigation)

---

## 2. APRA & Records

**Engine**: Existing `records` (APRA) engine
**Directory**: `src/engines/records/`

Township is a public agency subject to Access to Public Records Act (IC 5-14-3).

### Key Entities
- `ApraRequest` - Public records request with 7-day deadline
- `ApraRequestScope` - Specific records requested
- `ApraExemption` - Exemption applied (confidential records, etc.)
- `ApraFulfillment` - Delivered records and fees

### Key Workflows
- Receive and acknowledge requests
- Calculate 7-business-day deadline per IC 5-14-3-9
- Apply exemptions for confidential records (assistance cases, personnel)
- Track correspondence and delivered records

---

## 3. Finance & SBOA/DLGF

**Engine**: Existing `finance` engine
**Directory**: `src/engines/finance/`

Township finance follows SBOA Chart of Accounts and DLGF budget process.

### Key Entities
- `Fund` - Township General, Fire, Cemetery, Poor Relief, etc.
- `Claim` - Payment requests requiring board approval
- `Appropriation` - Budget line items
- `Receipt` - Property tax, LIT distributions, fees

### Key Workflows
- Maintain SBOA-compliant fund structure
- Process claims through trustee and board approval
- Track encumbrances before expenditure
- Prepare for Gateway/DLGF budget submission (export later)

### Township-Specific Considerations
- Trustee is fiscal officer (not clerk-treasurer)
- Township board approves claims at meetings
- Fire fund may be separate or levied

---

## 4. Township Assistance (Poor Relief)

**Engine**: Existing `township-assistance` engine
**Directory**: `src/engines/township-assistance/`

Indiana townships provide poor relief assistance per IC 12-20 and IC 12-21.

### Key Entities
- `AssistanceApplication` - Initial request with household info
- `AssistanceCase` - Derived case under investigation
- `AssistanceBenefit` - Approved assistance (rent, utilities, medical, etc.)
- `AssistanceProgramPolicy` - Eligibility standards and limits
- `HouseholdMember` - Applicant household composition

### Key Workflows
- Accept applications with 72-hour investigation requirement
- Evaluate eligibility against township standards
- Approve/deny with statutory reasons and citations
- Issue benefits to vendors (landlords, utilities)
- Maintain confidential case files (APRA exempt)

### Statutory Requirements
- 72-hour investigation deadline per IC 12-20-6-8.5
- Eligibility standards adopted by township board
- Annual reporting to state

---

## 5. Fire/EMS Contracts & Territories

**Engine**: Existing `fire` engine
**Directory**: `src/engines/fire/`

Townships provide fire protection through contracts, territories, or owned departments.

### Key Entities
- `FireServiceContract` - Agreement with provider (VFD, city, territory)
- `FirePerformanceSnapshot` - Run counts, response times

### Key Workflows
- Manage contracts with renewal tracking
- Record performance metrics from providers
- Track fund linkage for budget planning
- Handle fire protection territory participation

### Township-Specific Considerations
- Many townships contract rather than operate departments
- Fire protection territories (IC 36-8-19) common
- Trustee negotiates; board approves contracts

---

## 6. Cemetery Management

**Engine**: Existing `cemeteries` engine
**Directory**: `src/engines/cemeteries/`

Townships maintain cemeteries per IC 23-14-68 (township cemetery duties).

### Key Entities
- `Cemetery` - Cemetery with status (active, pioneer, abandoned)
- `CemeteryPlot` - Section/lot/grave structure
- `BurialRecord` - Interment records with decedent info
- `CemeteryMaintenanceLog` - Mowing, repairs, tree work

### Key Workflows
- Maintain cemetery inventory and status
- Record burials and plot ownership
- Log maintenance activities for compliance
- Search burial records for genealogists/families

---

## 7. Insurance & Bonds

**Engine**: New `insurance-bonds` engine
**Directory**: `src/engines/insurance-bonds/`

Townships must maintain insurance and official bonds.

### Key Entities
- `InsurancePolicy` - Liability, property, auto, fire coverage
- `PolicyCoverage` - Specific coverage limits and deductibles
- `OfficialBond` - Trustee, clerk, board member bonds
- `InsuranceCarrier` - Carrier information

### Key Workflows
- Track policies with effective/expiration dates
- Monitor coverage limits and deductibles
- Track official bonds and renewal dates
- Generate renewal reminders

### Township-Specific Considerations
- Trustee and clerk must be bonded
- Liability coverage for board and employees
- May participate in IACT pools

---

## 8. Fence Viewer

**Engine**: New `fence-viewer` engine
**Directory**: `src/engines/fence-viewer/`

Township trustees serve as fence viewers under IC 32-26 (division fences).

### Key Entities
- `FenceViewerCase` - Petition from adjoining landowner
- `FenceViewerParty` - Property owners involved
- `FenceInspection` - Site visit records
- `FenceViewerDecision` - Cost allocation determination

### Key Workflows
- Receive petition from landowner
- Schedule and conduct inspection
- Document findings and measurements
- Issue decision with cost allocation
- Record in township records

### Future Integration
- GIS integration for parcel geometry
- Photo attachment for inspection evidence

---

## 9. Weed Control / Noxious Weeds

**Engine**: New `weed-control` engine
**Directory**: `src/engines/weed-control/`

Townships enforce weed control per IC 15-16-8 (detrimental plants).

### Key Entities
- `WeedComplaint` - Initial complaint with location
- `WeedNotice` - Notice to property owner
- `WeedInspection` - Follow-up inspection results
- `WeedAbatement` - Township abatement and cost recovery

### Key Workflows
- Receive complaint (citizen or trustee-initiated)
- Issue notice to property owner with deadline
- Conduct follow-up inspection
- Abate if owner non-compliant
- Certify costs to county auditor for tax lien

### Statutory Requirements
- Notice requirements per IC 15-16-8
- Abatement authority and cost recovery
- Annual reporting on enforcement

---

## 10. Policies & Resolutions Library (Shared)

**Engine**: New `policies` engine
**Directory**: `src/engines/policies/`

Shared module for storing governing documents across all municipality types.

### Key Entities
- `PolicyDocument` - Policy, resolution, or standard
- `PolicyVersion` - Version history with effective dates
- `PolicyCategory` - Categorization (financial, personnel, assistance, etc.)

### Key Workflows
- Store adopted policies and resolutions
- Track version history and supersession
- Link policies to relevant domains (assistance standards, internal controls)
- Search and retrieve current policies

### Township Usage
- Township assistance eligibility standards
- Internal control policies (SBOA requirement)
- Nepotism/conflict-of-interest certifications
- Board resolutions (salary ordinances, contracts)

---

## State Pack Integration

All modules are registered through the Indiana Township Pack (`src/states/in/township/in-township.pack.ts`), which:

1. Extends base Indiana state rules (Open Door, APRA, SBOA)
2. Enables township-specific engines
3. Configures township identity (`entityClass: 'TOWNSHIP'`)
4. Provides township-specific defaults and legal opinions

See `docs/architecture/in-township-tenant-overview.md` for tenant configuration details.

---

## Module Dependencies

```
Policies & Resolutions
    └── Referenced by: Township Assistance (eligibility standards)
                       Finance (internal controls)

Township Assistance
    └── Depends on: Finance (benefit payments)
                    Records (confidential case files)
                    Policies (eligibility standards)

Fire Contracts
    └── Depends on: Finance (fund linkage)
                    Meetings (contract approvals)

Cemetery
    └── Depends on: Records (deed maps, burial searches)
                    Finance (plot sales, maintenance funds)

Insurance & Bonds
    └── Depends on: Finance (premium payments)
                    Policies (coverage requirements)

Fence Viewer
    └── Depends on: Records (case documentation)
                    (Future: GIS for parcels)

Weed Control
    └── Depends on: Records (case documentation)
                    Finance (abatement costs, liens)
                    (Future: GIS for parcels)
```
