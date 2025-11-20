import { INLegalEngine } from './states/in/legal/in-legal-engine';
import {
  JurisdictionProfile,
  TenantContext,
} from './core/tenancy/types';
import { InMemoryApraService } from './engines/records/in-memory-apra.service';
import { ApraService } from './engines/records/apra.service';

async function main() {
  // Set up jurisdiction + tenant context for Town of Lapel
  const jurisdiction: JurisdictionProfile = {
    tenantId: 'lapel-in',
    state: 'IN',
    kind: 'town',
    name: 'Town of Lapel',
    authorityTags: ['zoningAuthority', 'utilityOperator'],
  };

  const ctx: TenantContext = {
    tenantId: 'lapel-in',
    jurisdiction,
  };

  const legal = new INLegalEngine();
  const apraService: ApraService = new InMemoryApraService();

  console.log('APRA rules for', jurisdiction.name);
  console.log(legal.getApraRules(jurisdiction));

  // Create a sample APRA request
  const created = await apraService.createRequest(ctx, {
    requesterName: 'Jane Doe',
    requesterEmail: 'jane@example.com',
    requestText: 'All ordinances passed in 2024.',
  });

  console.log('Created APRA request:', created);

  // List all APRA requests for this tenant
  const list = await apraService.listRequests(ctx, {});
  console.log('All APRA requests for tenant:', list);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});