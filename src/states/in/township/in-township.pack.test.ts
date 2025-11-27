// src/states/in/township/in-township.pack.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContext } from '../../../core/tenancy/tenancy.types';
import { TenantIdentity } from '../../../core/state/state.types';
import {
  InTownshipPack,
  buildTownshipConfig,
  isTownship,
  getTownshipDutiesSummary,
  getTownshipEnabledModules,
} from './in-township.pack';
import { InMemoryInsuranceBondsService } from '../../../engines/insurance-bonds/in-memory-insurance-bonds.service';
import { InMemoryFenceViewerService } from '../../../engines/fence-viewer/in-memory-fence-viewer.service';
import { InMemoryWeedControlService } from '../../../engines/weed-control/in-memory-weed-control.service';
import { InMemoryPolicyService } from '../../../engines/policies/in-memory-policy.service';

// Test fixtures
const createTownshipIdentity = (): TenantIdentity => ({
  tenantId: 'fall-creek-twp',
  displayName: 'Fall Creek Township',
  state: 'IN',
  entityClass: 'TOWNSHIP',
  population: 8500,
  countyName: 'Madison',
});

const createTownIdentity = (): TenantIdentity => ({
  tenantId: 'lapel-in',
  displayName: 'Town of Lapel',
  state: 'IN',
  entityClass: 'TOWN',
  population: 2350,
  countyName: 'Madison',
});

const createTownshipContext = (): TenantContext => ({
  tenantId: 'fall-creek-twp',
  userId: 'trustee-1',
  jurisdiction: {
    tenantId: 'fall-creek-twp',
    state: 'IN',
    kind: 'township',
    name: 'Fall Creek Township',
    authorityTags: ['fenceViewer', 'weedControl', 'poorRelief'],
  },
});

describe('InTownshipPack', () => {
  describe('getDefaultConfig', () => {
    it('should return enabled config for township entity', () => {
      const identity = createTownshipIdentity();
      const config = InTownshipPack.getDefaultConfig(identity);

      expect(config.enabled).toBe(true);
      expect(config.domain).toBe('township');
    });

    it('should return disabled config for non-township entity', () => {
      const identity = createTownIdentity();
      const config = InTownshipPack.getDefaultConfig(identity);

      expect(config.enabled).toBe(false);
      expect(config.enabledModules).toEqual([]);
    });

    it('should enable all township modules by default', () => {
      const identity = createTownshipIdentity();
      const config = InTownshipPack.getDefaultConfig(identity);

      expect(config.enabledModules).toContain('township-assistance');
      expect(config.enabledModules).toContain('fire-contracts');
      expect(config.enabledModules).toContain('cemeteries');
      expect(config.enabledModules).toContain('insurance-bonds');
      expect(config.enabledModules).toContain('fence-viewer');
      expect(config.enabledModules).toContain('weed-control');
      expect(config.enabledModules).toContain('policies');
    });

    it('should set statutory defaults correctly', () => {
      const identity = createTownshipIdentity();
      const config = InTownshipPack.getDefaultConfig(identity);

      // IC 12-20-6-8.5: 72-hour (3-day) investigation
      expect(config.assistanceInvestigationDays).toBe(3);

      // IC 32-26-9-7: 10-day appeal
      expect(config.fenceViewerAppealDays).toBe(10);

      // IC 5-4-1: Trustee and clerk bonds required
      expect(config.trusteeBondRequired).toBe(true);
      expect(config.clerkBondRequired).toBe(true);

      // Township governance
      expect(config.trusteeIsFiscalOfficer).toBe(true);
      expect(config.boardApprovesClaims).toBe(true);
      expect(config.boardMemberCount).toBe(3);
    });
  });

  describe('buildTownshipConfig', () => {
    it('should merge overrides with defaults', () => {
      const identity = createTownshipIdentity();
      const config = buildTownshipConfig(identity, {
        fireModel: 'TERRITORY',
        fireTerritoryId: 'fall-creek-fire-territory',
      });

      expect(config.fireModel).toBe('TERRITORY');
      expect(config.fireTerritoryId).toBe('fall-creek-fire-territory');
      // Defaults should still be present
      expect(config.assistanceEnabled).toBe(true);
    });
  });

  describe('isTownship', () => {
    it('should return true for township entity', () => {
      expect(isTownship(createTownshipIdentity())).toBe(true);
    });

    it('should return false for town entity', () => {
      expect(isTownship(createTownIdentity())).toBe(false);
    });
  });

  describe('getTownshipDutiesSummary', () => {
    it('should return statutory duties for township', () => {
      const summary = getTownshipDutiesSummary(createTownshipIdentity());

      expect(summary.isTownship).toBe(true);
      expect(summary.statutoryDuties.length).toBeGreaterThan(0);
      expect(summary.statutoryDuties).toContain(
        'Provide township assistance (poor relief) per IC 12-20'
      );
      expect(summary.statutoryDuties).toContain(
        'Serve as fence viewer per IC 32-26'
      );
    });

    it('should return empty duties for non-township', () => {
      const summary = getTownshipDutiesSummary(createTownIdentity());

      expect(summary.isTownship).toBe(false);
      expect(summary.statutoryDuties).toEqual([]);
    });
  });

  describe('getTownshipEnabledModules', () => {
    it('should return all modules for township', () => {
      const modules = getTownshipEnabledModules(createTownshipIdentity());

      expect(modules).toHaveLength(7);
      expect(modules).toContain('township-assistance');
      expect(modules).toContain('fence-viewer');
    });

    it('should filter out disabled modules', () => {
      const modules = getTownshipEnabledModules(createTownshipIdentity(), {
        disabledModules: ['weed-control', 'fence-viewer'],
      });

      expect(modules).not.toContain('weed-control');
      expect(modules).not.toContain('fence-viewer');
      expect(modules).toContain('township-assistance');
    });

    it('should return empty array for non-township', () => {
      const modules = getTownshipEnabledModules(createTownIdentity());

      expect(modules).toEqual([]);
    });
  });
});

describe('Township Engine Integration', () => {
  let ctx: TenantContext;

  beforeEach(() => {
    ctx = createTownshipContext();
  });

  describe('InsuranceBondsService', () => {
    let service: InMemoryInsuranceBondsService;

    beforeEach(() => {
      service = new InMemoryInsuranceBondsService();
    });

    it('should create and retrieve a trustee bond', async () => {
      const bond = await service.createBond(ctx, {
        bondType: 'trustee',
        officialName: 'John Smith',
        officialTitle: 'Township Trustee',
        bondAmountCents: 1500000, // $15,000
        effectiveDate: new Date('2025-01-01'),
        expirationDate: new Date('2026-01-01'),
      });

      expect(bond.id).toBeDefined();
      expect(bond.bondType).toBe('trustee');
      expect(bond.officialTitle).toBe('Township Trustee');

      const retrieved = await service.getBond(ctx, bond.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.officialName).toBe('John Smith');
    });

    it('should create an insurance policy', async () => {
      // First create a carrier
      const carrier = await service.createCarrier(ctx, {
        name: 'IACT Insurance Pool',
      });

      const policy = await service.createPolicy(ctx, {
        policyType: 'general_liability',
        policyNumber: 'GL-2025-001',
        carrierId: carrier.id,
        effectiveDate: new Date('2025-01-01'),
        expirationDate: new Date('2026-01-01'),
        premiumAmountCents: 250000, // $2,500
      });

      expect(policy.id).toBeDefined();
      expect(policy.policyType).toBe('general_liability');
      expect(policy.status).toBe('active');
    });

    it('should track upcoming renewals', async () => {
      const carrier = await service.createCarrier(ctx, {
        name: 'Test Insurance',
      });

      // Create a policy expiring in 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      await service.createPolicy(ctx, {
        policyType: 'property',
        policyNumber: 'PROP-001',
        carrierId: carrier.id,
        effectiveDate: new Date('2024-01-01'),
        expirationDate: thirtyDaysFromNow,
        premiumAmountCents: 100000,
      });

      const renewals = await service.getUpcomingRenewals(ctx, 60);
      expect(renewals.length).toBeGreaterThan(0);
      expect(renewals[0].type).toBe('policy');
    });
  });

  describe('FenceViewerService', () => {
    let service: InMemoryFenceViewerService;

    beforeEach(() => {
      service = new InMemoryFenceViewerService();
    });

    it('should create a fence viewer case', async () => {
      const fenceCase = await service.createCase(ctx, {
        disputeType: 'cost_allocation',
        fenceLocationDescription: 'Property line between parcels 48-10-01-001 and 48-10-01-002',
      });

      expect(fenceCase.id).toBeDefined();
      expect(fenceCase.caseNumber).toMatch(/^FV-\d{4}-\d{4}$/);
      expect(fenceCase.status).toBe('petition_received');
    });

    it('should add parties to a case', async () => {
      const fenceCase = await service.createCase(ctx, {
        disputeType: 'repair',
        fenceLocationDescription: 'North property line',
      });

      const petitioner = await service.addParty(ctx, {
        caseId: fenceCase.id,
        name: 'Jane Doe',
        role: 'petitioner',
        parcelNumber: '48-10-01-001',
      });

      const respondent = await service.addParty(ctx, {
        caseId: fenceCase.id,
        name: 'Bob Wilson',
        role: 'respondent',
        parcelNumber: '48-10-01-002',
      });

      const parties = await service.listPartiesForCase(ctx, fenceCase.id);
      expect(parties).toHaveLength(2);
      expect(parties.find((p) => p.role === 'petitioner')?.name).toBe('Jane Doe');
    });

    it('should record inspection and issue decision', async () => {
      const fenceCase = await service.createCase(ctx, {
        disputeType: 'new_construction',
        fenceLocationDescription: 'Shared boundary',
      });

      // Record inspection
      const inspection = await service.recordInspection(ctx, {
        caseId: fenceCase.id,
        inspectionDate: new Date(),
        inspectorName: 'John Smith, Township Trustee',
        locationDescription: 'Walked boundary line, measured 150 ft',
        findings: 'No existing fence. Both properties would benefit from new division fence.',
      });

      expect(inspection.id).toBeDefined();

      // Issue decision
      const decision = await service.issueDecision(ctx, {
        caseId: fenceCase.id,
        issuedByName: 'John Smith, Township Trustee',
        petitionerSharePercent: 50,
        respondentSharePercent: 50,
        estimatedTotalCostCents: 450000, // $4,500
        fenceTypeRequired: '4-ft woven wire',
        decisionNarrative: 'Both parties shall share equally in the cost of constructing a 4-foot woven wire fence.',
      });

      expect(decision.petitionerCostCents).toBe(225000);
      expect(decision.respondentCostCents).toBe(225000);
      expect(decision.appealDeadlineDate).toBeDefined();

      // Verify case status updated
      const updated = await service.getCase(ctx, fenceCase.id);
      expect(updated?.status).toBe('decision_issued');
    });
  });

  describe('WeedControlService', () => {
    let service: InMemoryWeedControlService;

    beforeEach(() => {
      service = new InMemoryWeedControlService();
    });

    it('should create a weed complaint', async () => {
      const complaint = await service.createComplaint(ctx, {
        violationType: 'noxious_weeds',
        violationDescription: 'Canada thistle growth along roadway',
        propertyOwnerName: 'Property Owner',
        siteAddressLine1: '123 Rural Road',
        parcelNumber: '48-10-02-100',
        isAnonymous: true,
      });

      expect(complaint.id).toBeDefined();
      expect(complaint.caseNumber).toMatch(/^WC-\d{4}-\d{4}$/);
      expect(complaint.status).toBe('complaint_received');
      expect(complaint.isAnonymous).toBe(true);
    });

    it('should send notice and track compliance deadline', async () => {
      const complaint = await service.createComplaint(ctx, {
        violationType: 'tall_grass',
        violationDescription: 'Grass exceeds 12 inches',
        propertyOwnerName: 'John Doe',
        siteAddressLine1: '456 Township Road',
      });

      const notice = await service.sendNotice(ctx, {
        complaintId: complaint.id,
        noticeType: 'initial',
        deliveryMethod: 'certified_mail',
        sentToName: 'John Doe',
        sentToAddress: '456 Township Road',
        complianceDeadlineDays: 10,
        statutoryCitation: 'IC 15-16-8',
      });

      expect(notice.noticeType).toBe('initial');
      expect(notice.complianceDeadlineAt).toBeDefined();

      // Verify complaint updated
      const updated = await service.getComplaint(ctx, complaint.id);
      expect(updated?.status).toBe('notice_sent');
      expect(updated?.abatementDeadlineAt).toEqual(notice.complianceDeadlineAt);
    });

    it('should record abatement and certify costs', async () => {
      const complaint = await service.createComplaint(ctx, {
        violationType: 'noxious_weeds',
        violationDescription: 'Noxious weeds not abated',
        propertyOwnerName: 'Jane Smith',
        siteAddressLine1: '789 County Road',
      });

      // Record township abatement
      const abatement = await service.recordAbatement(ctx, {
        complaintId: complaint.id,
        performedBy: 'ABC Mowing Services',
        workDescription: 'Mowed and sprayed 2 acres of noxious weeds',
        laborCostCents: 15000,
        equipmentCostCents: 5000,
        materialsCostCents: 2500,
        administrativeCostCents: 2500,
      });

      expect(abatement.totalCostCents).toBe(25000); // $250 total

      // Certify costs to county
      const certified = await service.certifyCostsToCounty(ctx, {
        abatementId: abatement.id,
        countyRecordingReference: 'CERT-2025-001',
      });

      expect(certified.certifiedToCountyAt).toBeDefined();
      expect(certified.countyRecordingReference).toBe('CERT-2025-001');

      // Verify complaint status
      const updated = await service.getComplaint(ctx, complaint.id);
      expect(updated?.status).toBe('cost_recovery_pending');
    });
  });

  describe('PolicyService', () => {
    let service: InMemoryPolicyService;

    beforeEach(() => {
      service = new InMemoryPolicyService();
    });

    it('should create a township assistance standard', async () => {
      const policy = await service.createDocument(ctx, {
        documentType: 'standard',
        category: 'assistance',
        title: 'Township Assistance Eligibility Standards',
        effectiveDate: new Date('2025-01-01'),
        adoptedAt: new Date('2024-12-15'),
        adoptedByBodyName: 'Township Board',
        summaryText: 'Standards for determining eligibility for township poor relief assistance.',
        statutoryCitations: ['IC 12-20-6', 'IC 12-20-7'],
      });

      expect(policy.id).toBeDefined();
      expect(policy.documentType).toBe('standard');
      expect(policy.category).toBe('assistance');
      expect(policy.status).toBe('active');
    });

    it('should create and version an internal control policy', async () => {
      // Create initial policy
      const v1 = await service.createDocument(ctx, {
        documentType: 'policy',
        category: 'financial',
        title: 'Internal Control Policy',
        documentNumber: 'FIN-001',
        effectiveDate: new Date('2024-01-01'),
        adoptedAt: new Date('2023-12-15'),
        summaryText: 'Internal controls for financial operations.',
      });

      expect(v1.version).toBe('1.0');

      // Create new version
      const v2 = await service.createNewVersion(ctx, {
        previousPolicyId: v1.id,
        effectiveDate: new Date('2025-01-01'),
        changeNotes: 'Updated segregation of duties requirements.',
      });

      expect(v2.version).toBe('1.1');
      expect(v2.previousVersionId).toBe(v1.id);

      // Verify old version superseded
      const oldVersion = await service.getDocument(ctx, v1.id);
      expect(oldVersion?.status).toBe('superseded');
    });

    it('should record policy acknowledgment (conflict of interest)', async () => {
      const policy = await service.createDocument(ctx, {
        documentType: 'certification',
        category: 'ethics',
        title: 'Conflict of Interest Certification',
        effectiveDate: new Date('2025-01-01'),
        statutoryCitations: ['IC 35-44.1-1-4'],
      });

      const ack = await service.recordAcknowledgment(ctx, {
        policyId: policy.id,
        acknowledgedByName: 'John Smith, Township Trustee',
        certificationText: 'I certify that I have no conflicts of interest.',
      });

      expect(ack.acknowledgedAt).toBeDefined();

      const hasAcked = await service.hasAcknowledged(
        ctx,
        policy.id,
        'John Smith, Township Trustee'
      );
      expect(hasAcked).toBe(true);
    });

    it('should retrieve active policies by category', async () => {
      // Create multiple policies
      await service.createDocument(ctx, {
        documentType: 'standard',
        category: 'assistance',
        title: 'Eligibility Standards',
        effectiveDate: new Date('2025-01-01'),
        adoptedAt: new Date('2024-12-01'),
      });

      await service.createDocument(ctx, {
        documentType: 'policy',
        category: 'assistance',
        title: 'Application Procedures',
        effectiveDate: new Date('2025-01-01'),
        adoptedAt: new Date('2024-12-01'),
      });

      await service.createDocument(ctx, {
        documentType: 'policy',
        category: 'financial',
        title: 'Procurement Policy',
        effectiveDate: new Date('2025-01-01'),
        adoptedAt: new Date('2024-12-01'),
      });

      const assistancePolicies = await service.getActivePoliciesInCategory(
        ctx,
        'assistance'
      );
      expect(assistancePolicies).toHaveLength(2);
    });
  });
});
