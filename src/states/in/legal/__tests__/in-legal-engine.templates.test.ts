// src/states/in/legal/__tests__/in-legal-engine.templates.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { INLegalEngine } from '../in-legal-engine';
import {
  ApraTemplateContext,
  MeetingNoticeTemplateContext,
  BzaUseVarianceTemplateContext,
  RenderedLegalDocument,
} from '../../../../core/legal/types';
import { JurisdictionProfile } from '../../../../core/tenancy/tenancy.types';

describe('INLegalEngine Template Integration', () => {
  let engine: INLegalEngine;
  let testJurisdiction: JurisdictionProfile;

  beforeEach(() => {
    engine = new INLegalEngine();
    testJurisdiction = {
      tenantId: 'test-tenant',
      state: 'IN',
      kind: 'town',
      name: 'Town of Lapel',
      authorityTags: ['APRA', 'MEETINGS', 'PLANNING'],
    };
  });

  // ===========================================================================
  // APRA TEMPLATE INTEGRATION
  // ===========================================================================

  describe('APRA template integration', () => {
    it('should render an APRA fulfillment letter through INLegalEngine', async () => {
      const context: ApraTemplateContext = {
        requestId: 'APRA-2025-001',
        requesterName: 'John Doe',
        description: 'All town council meeting minutes from 2024',
        receivedAt: '2025-01-15T10:00:00Z',
        statutoryDeadlineAt: '2025-01-24T17:00:00Z',
        totalFeesCents: 1500,
        formattedTotalFees: '$15.00',
        jurisdictionName: testJurisdiction.name,
      };

      const doc = await engine.renderTemplate('APRA_FULFILLMENT_STANDARD', context);

      assertValidRenderedDocument(doc);
      expect(doc.kind).toBe('APRA_FULFILLMENT_STANDARD');
      expect(doc.body).toContain('John Doe');
      expect(doc.body).toContain('Town of Lapel');
      expect(doc.body).toContain('$15.00');
      expect(doc.body).toContain('IC 5-14-3');
    });

    it('should render an APRA denial letter through INLegalEngine', async () => {
      const context: ApraTemplateContext = {
        requestId: 'APRA-2025-002',
        requesterName: 'Jane Smith',
        description: 'Personnel records for the town manager',
        receivedAt: '2025-01-20T09:00:00Z',
        exemptions: [
          {
            citation: 'IC 5-14-3-4(b)(8)',
            description: 'Personnel files of public employees',
          },
          {
            citation: 'IC 5-14-3-4(b)(1)',
            description: 'Records declared confidential by federal law',
          },
        ],
        jurisdictionName: testJurisdiction.name,
      };

      const doc = await engine.renderTemplate('APRA_DENIAL_STANDARD', context);

      assertValidRenderedDocument(doc);
      expect(doc.kind).toBe('APRA_DENIAL_STANDARD');
      expect(doc.body).toContain('deny');
      expect(doc.body).toContain('IC 5-14-3-4(b)(8)');
      expect(doc.body).toContain('IC 5-14-3-4(b)(1)');
      expect(doc.body).toContain('Public Access Counselor');
    });
  });

  // ===========================================================================
  // MEETING NOTICE TEMPLATE INTEGRATION
  // ===========================================================================

  describe('Meeting notice template integration', () => {
    it('should render a regular meeting notice through INLegalEngine', async () => {
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
        jurisdictionName: testJurisdiction.name,
      };

      const doc = await engine.renderTemplate('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', context);

      assertValidRenderedDocument(doc);
      expect(doc.kind).toBe('MEETING_NOTICE_TOWN_COUNCIL_REGULAR');
      expect(doc.body).toContain('Town Council');
      expect(doc.body).toContain('7:00 PM');
      expect(doc.body).toContain('Lapel Town Hall');
      expect(doc.body).toContain('IC 5-14-1.5-5');
      expect(doc.body).toContain('Call to Order');
    });

    it('should render a special meeting notice through INLegalEngine', async () => {
      const context: MeetingNoticeTemplateContext = {
        meetingId: 'MTG-2025-002',
        governingBodyName: 'Town Council',
        meetingDate: '2025-02-10T18:00:00Z',
        meetingTime: '6:00 PM',
        locationName: 'Lapel Town Hall',
        meetingType: 'special',
        agendaSummary: 'Emergency discussion regarding water main break on Main Street.',
        jurisdictionName: testJurisdiction.name,
      };

      const doc = await engine.renderTemplate('MEETING_NOTICE_TOWN_COUNCIL_SPECIAL', context);

      assertValidRenderedDocument(doc);
      expect(doc.kind).toBe('MEETING_NOTICE_TOWN_COUNCIL_SPECIAL');
      expect(doc.body).toContain('special meeting');
      expect(doc.body).toContain('water main break');
      expect(doc.suggestedFileName).toContain('special');
    });
  });

  // ===========================================================================
  // BZA TEMPLATE INTEGRATION
  // ===========================================================================

  describe('BZA template integration', () => {
    it('should render BZA use variance findings through INLegalEngine', async () => {
      const context: BzaUseVarianceTemplateContext = {
        caseNumber: 'BZA-2025-001',
        applicantName: 'Smith Construction LLC',
        propertyAddress: '789 Commerce Road, Lapel, IN 46051',
        legalDescription: 'Lot 12, Block 3, Commerce Park Addition',
        dateOfHearing: '2025-02-20T19:00:00Z',
        boardName: 'Town of Lapel Board of Zoning Appeals',
        findings: {
          unnecessaryHardship:
            'The Board finds that the property has unique characteristics ' +
            'that prevent reasonable use under current zoning.',
          publicWelfare:
            'The Board finds that the proposed use will not adversely affect ' +
            'neighboring properties or the general public.',
          comprehensivePlan:
            'The Board finds that the proposed use is compatible with the ' +
            'intent of the Comprehensive Plan.',
        },
        decision: 'APPROVED',
        conditions: [
          'All signage shall comply with the Town sign ordinance.',
          'Hours of operation shall be limited to 7 AM - 9 PM.',
        ],
        statutesCited: ['IC 36-7-4-918.4'],
        jurisdictionName: testJurisdiction.name,
      };

      const doc = await engine.renderTemplate('BZA_FINDINGS_USE_VARIANCE', context);

      assertValidRenderedDocument(doc);
      expect(doc.kind).toBe('BZA_FINDINGS_USE_VARIANCE');
      expect(doc.body).toContain('Smith Construction LLC');
      expect(doc.body).toContain('BZA-2025-001');
      expect(doc.body).toContain('Unnecessary Hardship');
      expect(doc.body).toContain('Public Welfare');
      expect(doc.body).toContain('Comprehensive Plan');
      expect(doc.body).toContain('APPROVED');
      expect(doc.body).toContain('IC 36-7-4-918.4');
      expect(doc.body).toContain('Conditions of Approval');
    });

    it('should handle denied variance through INLegalEngine', async () => {
      const context: BzaUseVarianceTemplateContext = {
        caseNumber: 'BZA-2025-002',
        applicantName: 'Jones Properties',
        propertyAddress: '101 Residential Lane, Lapel, IN 46051',
        dateOfHearing: '2025-03-01T19:00:00Z',
        boardName: 'Town of Lapel Board of Zoning Appeals',
        findings: {
          unnecessaryHardship:
            'The Board finds that the applicant has not demonstrated an ' +
            'unnecessary hardship that is unique to this property.',
          publicWelfare:
            'The Board finds that the proposed use would be detrimental to ' +
            'the surrounding residential neighborhood.',
          comprehensivePlan:
            'The Board finds that the proposed use is inconsistent with the ' +
            'Comprehensive Plan designation for this area.',
        },
        decision: 'DENIED',
        jurisdictionName: testJurisdiction.name,
      };

      const doc = await engine.renderTemplate('BZA_FINDINGS_USE_VARIANCE', context);

      assertValidRenderedDocument(doc);
      expect(doc.body).toContain('DENIED');
      expect(doc.body).not.toContain('Conditions of Approval');
    });
  });

  // ===========================================================================
  // DOCUMENT STRUCTURE VALIDATION
  // ===========================================================================

  describe('document structure validation', () => {
    it('should produce documents with consistent structure', async () => {
      const apraContext: ApraTemplateContext = {
        requestId: 'APRA-TEST',
        requesterName: 'Test User',
        description: 'Test request',
        receivedAt: '2025-01-01T00:00:00Z',
        jurisdictionName: 'Test Town',
      };

      const meetingContext: MeetingNoticeTemplateContext = {
        meetingId: 'MTG-TEST',
        governingBodyName: 'Test Board',
        meetingDate: '2025-01-01T00:00:00Z',
        meetingTime: '7:00 PM',
        locationName: 'Test Location',
        meetingType: 'regular',
        jurisdictionName: 'Test Town',
      };

      const bzaContext: BzaUseVarianceTemplateContext = {
        caseNumber: 'BZA-TEST',
        applicantName: 'Test Applicant',
        propertyAddress: '123 Test St',
        dateOfHearing: '2025-01-01T00:00:00Z',
        boardName: 'Test BZA',
        findings: {
          unnecessaryHardship: 'Test finding 1',
          publicWelfare: 'Test finding 2',
          comprehensivePlan: 'Test finding 3',
        },
        decision: 'APPROVED',
        jurisdictionName: 'Test Town',
      };

      const apraDoc = await engine.renderTemplate('APRA_FULFILLMENT_STANDARD', apraContext);
      const meetingDoc = await engine.renderTemplate('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', meetingContext);
      const bzaDoc = await engine.renderTemplate('BZA_FINDINGS_USE_VARIANCE', bzaContext);

      // All documents should have the required fields
      for (const doc of [apraDoc, meetingDoc, bzaDoc]) {
        assertValidRenderedDocument(doc);
      }

      // Filenames should be date-prefixed
      expect(apraDoc.suggestedFileName).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(meetingDoc.suggestedFileName).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(bzaDoc.suggestedFileName).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
  });

  // ===========================================================================
  // LEGACY METHOD
  // ===========================================================================

  describe('legacy renderTemplateLegacy method', () => {
    it('should still work for backwards compatibility', () => {
      const result = engine.renderTemplateLegacy('OLD_TEMPLATE', { foo: 'bar' });

      expect(result).toContain('not implemented');
      expect(result).toContain('Use renderTemplate() with LegalTemplateKind instead');
    });
  });
});

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Assert that a rendered document has all required fields with valid values.
 */
function assertValidRenderedDocument(doc: RenderedLegalDocument): void {
  // Title should be non-empty
  expect(doc.title).toBeTruthy();
  expect(doc.title.length).toBeGreaterThan(0);

  // Body should be non-empty
  expect(doc.body).toBeTruthy();
  expect(doc.body.length).toBeGreaterThan(0);

  // Suggested filename should be reasonable
  expect(doc.suggestedFileName).toBeTruthy();
  expect(doc.suggestedFileName).toMatch(/\.(md|docx|pdf)$/);
  expect(doc.suggestedFileName).not.toContain(' ');

  // Kind should be set
  expect(doc.kind).toBeTruthy();
}
