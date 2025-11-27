// src/states/in/index.ts
// Indiana state module - top-level exports

import { StateMetadata, stateRegistry } from '../../core/state';

/**
 * Indiana state metadata.
 */
export const IN_STATE_METADATA: StateMetadata = {
  code: 'IN',
  name: 'Indiana',
  timezone: 'America/Indiana/Indianapolis',
  fiscalYearStart: { month: 1, day: 1 }, // Calendar year

  oversightAgencies: [
    {
      code: 'SBOA',
      name: 'State Board of Accounts',
      url: 'https://www.in.gov/sboa/',
    },
    {
      code: 'DLGF',
      name: 'Department of Local Government Finance',
      url: 'https://www.in.gov/dlgf/',
    },
    {
      code: 'PAC',
      name: 'Public Access Counselor',
      url: 'https://www.in.gov/pac/',
    },
  ],

  supportedGovKinds: [
    {
      kind: 'town',
      formId: 'IN_TOWN',
      displayName: 'Indiana Town',
      description: 'Incorporated town governed by town council and clerk-treasurer.',
    },
    {
      kind: 'city',
      formId: 'IN_CITY',
      displayName: 'Indiana City',
      description: 'Incorporated city governed by common council and mayor.',
    },
    {
      kind: 'township',
      formId: 'IN_TOWNSHIP',
      displayName: 'Indiana Township',
      description: 'Civil township governed by trustee and township board.',
    },
    {
      kind: 'county',
      formId: 'IN_COUNTY',
      displayName: 'Indiana County',
      description: 'County government with commissioners/council structure.',
    },
  ],
};

// Register Indiana with the state registry
stateRegistry.registerState(IN_STATE_METADATA);

// Re-export legal engine
export { INLegalEngine } from './legal/in-legal-engine';

// Re-export finance (will be updated after move)
export { INFinancialRulesEngine } from './finance/in-financial-rules.engine';

// Domain packs (will be populated as we add them)
export * from './finance/in-finance.pack';
export * from './meetings/in-meetings.pack';
export * from './records/in-records.pack';
export * from './planning/in-planning.pack';
export * from './apra/in-apra.pack';
export * from './utilities/in-utilities.pack';
export * from './township/in-township.pack';

// Import township pack to trigger registration with the state registry
import './township';
