// src/examples/seed-compliance-tasks.ts

import { INLegalEngine } from '../states/in/legal/in-legal-engine';
import {
  TenantContext,
  JurisdictionProfile,
} from '../core/tenancy/tenancy.types';
import { InMemoryComplianceService } from '../core/compliance/in-memory-compliance.service';
import { seedComplianceTasksFromLegal } from '../core/compliance/compliance.seed';

async function main() {
  const jurisdiction: JurisdictionProfile = {
    tenantId: 'sample-township',
    state: 'IN',
    kind: 'township',
    name: 'Sample Township',
    authorityTags: ['townshipTrustee'],
  };

  const ctx: TenantContext = {
    tenantId: jurisdiction.tenantId,
    jurisdiction,
    userId: 'demo-user',
  };

  const legal = new INLegalEngine();
  const compliance = new InMemoryComplianceService();

  await seedComplianceTasksFromLegal(ctx, legal, compliance);

  const defs = await compliance.listTaskDefinitions(ctx);
  console.log('Seeded compliance task definitions:', defs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
