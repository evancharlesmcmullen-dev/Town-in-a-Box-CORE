// src/engines/township-assistance/in-memory-assistance.reporting.service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAssistanceService } from './in-memory-assistance.service';
import { InMemoryAssistanceReportingService } from './in-memory-assistance.reporting.service';
import {
  AssistanceApplication,
  AssistanceCase,
  AssistanceBenefit,
} from './assistance.types';
import { TenantContext } from '../../core/tenancy/tenancy.types';

// Test fixture for TenantContext
const createTestContext = (): TenantContext => ({
  tenantId: 'test-tenant',
  userId: 'test-user',
  jurisdiction: {
    tenantId: 'test-tenant',
    state: 'IN',
    kind: 'township',
    name: 'Test Township',
    authorityTags: ['trusteeAuthority'],
  },
});

describe('InMemoryAssistanceReportingService', () => {
  let assistanceService: InMemoryAssistanceService;
  let reportingService: InMemoryAssistanceReportingService;
  let ctx: TenantContext;

  // Test data covering various household sizes and statuses
  const applications: AssistanceApplication[] = [
    {
      id: 'app-1',
      tenantId: 'test-tenant',
      applicantName: 'John Doe',
      household: [{ name: 'John Doe', relationship: 'applicant' }], // size 1
      requestedBenefitTypes: ['rent'],
      createdAt: new Date('2025-01-05'),
    },
    {
      id: 'app-2',
      tenantId: 'test-tenant',
      applicantName: 'Jane Smith',
      household: [
        { name: 'Jane Smith', relationship: 'applicant' },
        { name: 'Child Smith', relationship: 'child' },
      ], // size 2
      requestedBenefitTypes: ['utilities'],
      createdAt: new Date('2025-01-10'),
    },
    {
      id: 'app-3',
      tenantId: 'test-tenant',
      applicantName: 'Bob Johnson',
      household: [
        { name: 'Bob Johnson', relationship: 'applicant' },
        { name: 'Wife Johnson', relationship: 'spouse' },
        { name: 'Kid 1', relationship: 'child' },
      ], // size 3
      requestedBenefitTypes: ['rent', 'utilities'],
      createdAt: new Date('2025-01-12'),
    },
    {
      id: 'app-4',
      tenantId: 'test-tenant',
      applicantName: 'Alice Brown',
      household: [
        { name: 'Alice Brown', relationship: 'applicant' },
        { name: 'Spouse Brown', relationship: 'spouse' },
        { name: 'Kid 1', relationship: 'child' },
        { name: 'Kid 2', relationship: 'child' },
        { name: 'Kid 3', relationship: 'child' },
      ], // size 5
      requestedBenefitTypes: ['food'],
      createdAt: new Date('2025-01-15'),
    },
    {
      id: 'app-5',
      tenantId: 'test-tenant',
      applicantName: 'Large Family',
      household: [
        { name: 'Parent 1', relationship: 'applicant' },
        { name: 'Parent 2', relationship: 'spouse' },
        { name: 'Kid 1', relationship: 'child' },
        { name: 'Kid 2', relationship: 'child' },
        { name: 'Kid 3', relationship: 'child' },
        { name: 'Kid 4', relationship: 'child' },
        { name: 'Grandparent', relationship: 'other' },
      ], // size 7 (6+ bucket)
      requestedBenefitTypes: ['rent'],
      createdAt: new Date('2025-01-18'),
    },
  ];

  const cases: AssistanceCase[] = [
    {
      id: 'case-1',
      tenantId: 'test-tenant',
      applicationId: 'app-1',
      status: 'approved',
      openedAt: new Date('2025-01-06'),
    },
    {
      id: 'case-2',
      tenantId: 'test-tenant',
      applicationId: 'app-2',
      status: 'denied',
      openedAt: new Date('2025-01-11'),
    },
    {
      id: 'case-3',
      tenantId: 'test-tenant',
      applicationId: 'app-3',
      status: 'paid',
      openedAt: new Date('2025-01-13'),
    },
    {
      id: 'case-4',
      tenantId: 'test-tenant',
      applicationId: 'app-4',
      status: 'open',
      openedAt: new Date('2025-01-16'),
    },
    {
      id: 'case-5',
      tenantId: 'test-tenant',
      applicationId: 'app-5',
      status: 'approved',
      openedAt: new Date('2025-01-19'),
    },
  ];

  const benefits: AssistanceBenefit[] = [
    {
      id: 'ben-1',
      tenantId: 'test-tenant',
      caseId: 'case-1',
      type: 'rent',
      amountCents: 50000,
      payeeName: 'Landlord A',
      approvedAt: new Date('2025-01-07'),
    },
    {
      id: 'ben-2',
      tenantId: 'test-tenant',
      caseId: 'case-3',
      type: 'rent',
      amountCents: 75000,
      payeeName: 'Landlord B',
      approvedAt: new Date('2025-01-14'),
    },
    {
      id: 'ben-3',
      tenantId: 'test-tenant',
      caseId: 'case-3',
      type: 'utilities',
      amountCents: 15000,
      payeeName: 'Electric Co',
      approvedAt: new Date('2025-01-14'),
    },
  ];

  beforeEach(() => {
    assistanceService = new InMemoryAssistanceService({
      applications,
      cases,
      benefits,
    });
    reportingService = new InMemoryAssistanceReportingService(assistanceService);
    ctx = createTestContext();
  });

  describe('getStatsForRange', () => {
    it('should return summary where bucket totals equal totalCases', async () => {
      const summary = await reportingService.getStatsForRange(ctx, {
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
      });

      // Calculate bucket total
      const bucketTotal = summary.householdBuckets.reduce(
        (acc, b) => acc + b.caseCount,
        0
      );

      // This is the key invariant
      expect(bucketTotal).toBe(summary.caseStats.totalCases);
    });

    it('should not throw for valid data (invariant guard passes)', async () => {
      // This should complete without throwing
      await expect(
        reportingService.getStatsForRange(ctx, {
          fromDate: new Date('2025-01-01'),
          toDate: new Date('2025-01-31'),
        })
      ).resolves.toBeDefined();
    });

    it('should correctly bucket cases by household size', async () => {
      const summary = await reportingService.getStatsForRange(ctx, {
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
      });

      // Our test data:
      // - app-1: size 1 → bucket "1"
      // - app-2: size 2 → bucket "2-3"
      // - app-3: size 3 → bucket "2-3"
      // - app-4: size 5 → bucket "4-5"
      // - app-5: size 7 → bucket "6+"

      const bucket1 = summary.householdBuckets.find((b) => b.bucketLabel === '1');
      const bucket23 = summary.householdBuckets.find((b) => b.bucketLabel === '2-3');
      const bucket45 = summary.householdBuckets.find((b) => b.bucketLabel === '4-5');
      const bucket6plus = summary.householdBuckets.find((b) => b.bucketLabel === '6+');

      expect(bucket1?.caseCount).toBe(1);
      expect(bucket23?.caseCount).toBe(2);
      expect(bucket45?.caseCount).toBe(1);
      expect(bucket6plus?.caseCount).toBe(1);
    });

    it('should track approved and denied counts per bucket', async () => {
      const summary = await reportingService.getStatsForRange(ctx, {
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
      });

      // bucket "1": case-1 is approved
      const bucket1 = summary.householdBuckets.find((b) => b.bucketLabel === '1');
      expect(bucket1?.approvedCount).toBe(1);
      expect(bucket1?.deniedCount).toBe(0);

      // bucket "2-3": case-2 is denied, case-3 is paid (counts as approved)
      const bucket23 = summary.householdBuckets.find((b) => b.bucketLabel === '2-3');
      expect(bucket23?.approvedCount).toBe(1); // paid counts as approved
      expect(bucket23?.deniedCount).toBe(1);
    });

    it('should calculate correct case stats', async () => {
      const summary = await reportingService.getStatsForRange(ctx, {
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
      });

      expect(summary.caseStats.totalCases).toBe(5);
      expect(summary.caseStats.openCases).toBe(1); // case-4
      expect(summary.caseStats.approvedCases).toBe(2); // case-1, case-5
      expect(summary.caseStats.deniedCases).toBe(1); // case-2
      expect(summary.caseStats.paidCases).toBe(1); // case-3
    });

    it('should calculate total benefits correctly', async () => {
      const summary = await reportingService.getStatsForRange(ctx, {
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
      });

      // 50000 + 75000 + 15000 = 140000 cents = $1,400
      expect(summary.totalBenefitsCents).toBe(140000);
    });

    it('should return empty stats for date range with no cases', async () => {
      const summary = await reportingService.getStatsForRange(ctx, {
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-12-31'),
      });

      expect(summary.caseStats.totalCases).toBe(0);
      expect(summary.totalBenefitsCents).toBe(0);

      // Bucket totals should still equal totalCases (both 0)
      const bucketTotal = summary.householdBuckets.reduce(
        (acc, b) => acc + b.caseCount,
        0
      );
      expect(bucketTotal).toBe(0);
    });
  });
});
