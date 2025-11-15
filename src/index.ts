import { INLegalEngine } from './states/in/legal/in-legal-engine';
import { JurisdictionProfile } from './core/tenancy/types';

const legal = new INLegalEngine();

const sampleJurisdiction: JurisdictionProfile = {
  tenantId: 'lapel-in',
  state: 'IN',
  kind: 'town',
  name: 'Town of Lapel',
  authorityTags: ['zoningAuthority', 'utilityOperator'],
};

console.log('APRA rules for', sampleJurisdiction.name);
console.log(legal.getApraRules(sampleJurisdiction));
