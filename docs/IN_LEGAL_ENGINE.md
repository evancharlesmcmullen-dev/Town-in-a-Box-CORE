# Indiana Legal Engine

The Indiana Legal Engine (`INLegalEngine`) provides state-specific legal rules and document templates for Indiana municipalities. This document covers the **Template Engine** component.

## Overview

The template engine produces structured, typed, reusable legal documents for:

- **APRA (Access to Public Records Act)** - Response letters for fulfillment and denial
- **Meetings (Open Door Law)** - Public meeting notices
- **BZA (Board of Zoning Appeals)** - Findings of fact for use variances

All templates reference Indiana statutes and produce documents suitable for official use after human review.

## Template Kinds

The `LegalTemplateKind` type defines the available templates:

```typescript
type LegalTemplateKind =
  | 'APRA_FULFILLMENT_STANDARD'      // Standard fulfillment letter
  | 'APRA_DENIAL_STANDARD'           // Denial letter with exemptions
  | 'MEETING_NOTICE_TOWN_COUNCIL_REGULAR'  // Regular meeting notice
  | 'MEETING_NOTICE_TOWN_COUNCIL_SPECIAL'  // Special meeting notice
  | 'BZA_FINDINGS_USE_VARIANCE';     // Use variance findings
```

## Usage

### Basic Usage

```typescript
import { INLegalEngine, ApraTemplateContext } from 'town-in-a-box-core';

const engine = new INLegalEngine();

// Render an APRA denial letter
const context: ApraTemplateContext = {
  requestId: 'APRA-2025-001',
  requesterName: 'John Doe',
  description: 'All emails from January 2025',
  receivedAt: '2025-01-15T10:00:00Z',
  exemptions: [
    {
      citation: 'IC 5-14-3-4(b)(6)',
      description: 'Deliberative material',
    },
  ],
  jurisdictionName: 'Town of Lapel',
};

const doc = await engine.renderTemplate('APRA_DENIAL_STANDARD', context);

console.log(doc.title);           // "APRA Denial Letter - APRA-2025-001"
console.log(doc.suggestedFileName); // "2025-01-15-apra-denial-apra-2025-001.md"
console.log(doc.body);            // Full document text in markdown
```

### Rendered Document Structure

Every rendered document includes:

```typescript
interface RenderedLegalDocument {
  kind: LegalTemplateKind;       // Template type used
  title: string;                 // Document title
  body: string;                  // Full document body (markdown)
  suggestedFileName: string;     // Recommended filename for export
  metadata?: Record<string, unknown>; // Additional context data
}
```

## Template Examples

### APRA Fulfillment Letter

```typescript
import { INLegalEngine, ApraTemplateContext } from 'town-in-a-box-core';

const engine = new INLegalEngine();

const context: ApraTemplateContext = {
  requestId: 'APRA-2025-001',
  requesterName: 'Jane Smith',
  requesterEmail: 'jane@example.com',
  description: 'Town council meeting minutes from 2024',
  receivedAt: '2025-01-10T09:00:00Z',
  statutoryDeadlineAt: '2025-01-21T17:00:00Z',
  totalFeesCents: 2500,
  formattedTotalFees: '$25.00',
  jurisdictionName: 'Town of Lapel',
};

const doc = await engine.renderTemplate('APRA_FULFILLMENT_STANDARD', context);
```

The generated document includes:
- Date of request and response
- Description of records requested
- Statutory deadline reference
- Fee information (if applicable)
- Citation to IC 5-14-3

### APRA Denial Letter

```typescript
const context: ApraTemplateContext = {
  requestId: 'APRA-2025-002',
  requesterName: 'John Doe',
  description: 'Personnel files for all employees',
  receivedAt: '2025-01-15T10:00:00Z',
  exemptions: [
    {
      citation: 'IC 5-14-3-4(b)(8)',
      description: 'Personnel files of public employees',
    },
    {
      citation: 'IC 5-14-3-4(a)(1)',
      description: 'Records declared confidential by federal law',
    },
  ],
  jurisdictionName: 'Town of Lapel',
};

const doc = await engine.renderTemplate('APRA_DENIAL_STANDARD', context);
```

The generated document includes:
- Clear statement of denial
- List of exemptions with citations
- Appeal rights and Public Access Counselor contact information
- Reference to IC 5-14-3-9

### Meeting Notice (Town Council)

```typescript
import { INLegalEngine, MeetingNoticeTemplateContext } from 'town-in-a-box-core';

const engine = new INLegalEngine();

const context: MeetingNoticeTemplateContext = {
  meetingId: 'MTG-2025-001',
  governingBodyName: 'Town Council',
  meetingDate: '2025-02-03T19:00:00Z',
  meetingTime: '7:00 PM',
  locationName: 'Lapel Town Hall',
  locationAddress: '123 Main Street, Lapel, IN 46051',
  meetingType: 'regular',
  agendaItems: [
    'Call to Order',
    'Approval of Minutes',
    'Public Comment',
    'Old Business',
    'New Business',
    'Adjournment',
  ],
  jurisdictionName: 'Town of Lapel',
};

const doc = await engine.renderTemplate('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', context);
```

The generated notice includes:
- Governing body name, date, time, and location
- Agenda items (if provided)
- Citation to IC 5-14-1.5-5 (Open Door Law)
- Statement that meeting is open to the public

For special meetings, use `MEETING_NOTICE_TOWN_COUNCIL_SPECIAL` - it includes a note that only listed items will be considered.

### BZA Use Variance Findings

```typescript
import { INLegalEngine, BzaUseVarianceTemplateContext } from 'town-in-a-box-core';

const engine = new INLegalEngine();

const context: BzaUseVarianceTemplateContext = {
  caseNumber: 'BZA-2025-001',
  applicantName: 'ABC Development LLC',
  propertyAddress: '456 Industrial Drive, Lapel, IN 46051',
  legalDescription: 'Lot 5, Block 2, Industrial Park Subdivision',
  dateOfHearing: '2025-02-15T19:00:00Z',
  boardName: 'Town of Lapel Board of Zoning Appeals',
  findings: {
    unnecessaryHardship:
      'The Board finds that the strict application of the zoning ordinance ' +
      'would deprive the applicant of reasonable use due to the property\'s ' +
      'unique triangular shape and limited street frontage.',
    publicWelfare:
      'The Board finds that the proposed use will not be injurious to the ' +
      'public health, safety, morals, or general welfare.',
    comprehensivePlan:
      'The Board finds that the proposed use is consistent with the ' +
      'Comprehensive Plan designation for this area.',
  },
  decision: 'APPROVED',
  conditions: [
    'Install a 6-foot privacy fence along the north property line.',
    'All outdoor storage shall be screened from public view.',
    'The variance shall expire if not utilized within 12 months.',
  ],
  statutesCited: ['IC 36-7-4-918.4'],
  jurisdictionName: 'Town of Lapel',
};

const doc = await engine.renderTemplate('BZA_FINDINGS_USE_VARIANCE', context);
```

The generated findings include:
- Case information (number, applicant, property)
- Findings of Fact for each statutory criterion
- Decision (APPROVED or DENIED)
- Conditions of approval (if any)
- Citation to IC 36-7-4-918.4
- Signature lines

## Context Types

### ApraTemplateContext

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | Unique request identifier |
| `requesterName` | string | Yes | Name of requester |
| `requesterEmail` | string | No | Email of requester |
| `description` | string | Yes | Description of records requested |
| `receivedAt` | string | Yes | ISO date when request was received |
| `statutoryDeadlineAt` | string | No | ISO date of statutory deadline |
| `exemptions` | array | No | Array of {citation, description} |
| `totalFeesCents` | number | No | Total fees in cents |
| `formattedTotalFees` | string | No | Pre-formatted fee string |
| `jurisdictionName` | string | Yes | Name of the jurisdiction |

### MeetingNoticeTemplateContext

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meetingId` | string | Yes | Unique meeting identifier |
| `governingBodyName` | string | Yes | Name of governing body |
| `meetingDate` | string | Yes | ISO date of meeting |
| `meetingTime` | string | Yes | Local time string (e.g., "7:00 PM") |
| `locationName` | string | Yes | Name of meeting location |
| `locationAddress` | string | No | Full address of location |
| `meetingType` | string | Yes | 'regular' \| 'special' \| 'emergency' \| 'executiveSession' |
| `agendaSummary` | string | No | Summary of meeting purpose |
| `agendaItems` | string[] | No | List of agenda item titles |
| `statutesCited` | string[] | No | Statutes to cite (defaults to IC 5-14-1.5-5) |
| `jurisdictionName` | string | Yes | Name of the jurisdiction |

### BzaUseVarianceTemplateContext

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `caseNumber` | string | Yes | Case number |
| `applicantName` | string | Yes | Name of applicant |
| `propertyAddress` | string | Yes | Property street address |
| `legalDescription` | string | No | Legal description of property |
| `dateOfHearing` | string | Yes | ISO date of hearing |
| `boardName` | string | Yes | Full name of the board |
| `findings.unnecessaryHardship` | string | Yes | Finding for hardship criterion |
| `findings.publicWelfare` | string | Yes | Finding for public welfare criterion |
| `findings.comprehensivePlan` | string | Yes | Finding for comp plan criterion |
| `decision` | string | Yes | 'APPROVED' \| 'DENIED' |
| `conditions` | string[] | No | Conditions of approval |
| `statutesCited` | string[] | No | Statutes to cite (defaults to IC 36-7-4-918.4) |
| `jurisdictionName` | string | Yes | Name of the jurisdiction |

## Statutory References

The template engine references the following Indiana statutes:

### APRA (Access to Public Records Act)
- **IC 5-14-3** - Access to Public Records Act (general)
- **IC 5-14-3-4** - Exemptions from disclosure
- **IC 5-14-3-8** - Fees for copies
- **IC 5-14-3-9** - Denial of access; appeal rights

### Open Door Law (Meetings)
- **IC 5-14-1.5-5** - Notice requirements for public meetings

### BZA / Zoning
- **IC 36-7-4-918.4** - Use variance criteria

## Known Limitations

1. **Templates are deterministic** - No AI-assisted polishing in this version. Future versions may integrate with AI services for enhanced drafting.

2. **Limited template kinds** - Currently supports 5 template kinds. Additional templates (development variances, special exceptions, plan commission findings) will be added in future releases.

3. **Indiana-specific** - Templates are designed for Indiana law. Other states will require separate implementations.

4. **Human review required** - All generated documents should be reviewed by appropriate staff before official use.

## Future Enhancements

- Additional template kinds for other variance types
- Plan Commission recommendation templates
- Executive session notice templates
- AI-assisted template polishing
- Support for additional output formats (DOCX, PDF)
