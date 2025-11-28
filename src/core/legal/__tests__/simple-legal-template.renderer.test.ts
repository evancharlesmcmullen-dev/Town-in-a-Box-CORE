// src/core/legal/__tests__/simple-legal-template.renderer.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleLegalTemplateRenderer } from '../templates/simple-legal-template.renderer';
import {
  ApraTemplateContext,
  MeetingNoticeTemplateContext,
  BzaUseVarianceTemplateContext,
  LegalTemplateKind,
} from '../types';

describe('SimpleLegalTemplateRenderer', () => {
  let renderer: SimpleLegalTemplateRenderer;

  beforeEach(() => {
    renderer = new SimpleLegalTemplateRenderer();
  });

  // ===========================================================================
  // APRA FULFILLMENT TEMPLATE
  // ===========================================================================

  describe('APRA_FULFILLMENT_STANDARD', () => {
    const baseContext: ApraTemplateContext = {
      requestId: 'APRA-2025-001',
      requesterName: 'John Doe',
      requesterEmail: 'john.doe@example.com',
      description: 'All meeting minutes from January 2025',
      receivedAt: '2025-01-15T10:00:00Z',
      statutoryDeadlineAt: '2025-01-24T17:00:00Z',
      jurisdictionName: 'Town of Lapel',
    };

    it('should render a fulfillment letter with required fields', async () => {
      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', baseContext);

      expect(doc.kind).toBe('APRA_FULFILLMENT_STANDARD');
      expect(doc.title).toContain('APRA Fulfillment Letter');
      expect(doc.title).toContain('APRA-2025-001');
      expect(doc.body).toContain('John Doe');
      expect(doc.body).toContain('Town of Lapel');
      expect(doc.body).toContain('All meeting minutes from January 2025');
      expect(doc.suggestedFileName).toMatch(/^\d{4}-\d{2}-\d{2}-apra-fulfillment/);
      expect(doc.suggestedFileName).toContain('.md');
    });

    it('should reference IC 5-14-3 statute', async () => {
      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', baseContext);

      expect(doc.body).toContain('IC 5-14-3');
      expect(doc.body).toContain('Access to Public Records Act');
    });

    it('should include fees when totalFeesCents is provided', async () => {
      const contextWithFees: ApraTemplateContext = {
        ...baseContext,
        totalFeesCents: 2500,
        formattedTotalFees: '$25.00',
      };

      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', contextWithFees);

      expect(doc.body).toContain('Fees');
      expect(doc.body).toContain('$25.00');
      expect(doc.body).toContain('IC 5-14-3-8');
    });

    it('should not include fee section when no fees', async () => {
      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', baseContext);

      expect(doc.body).not.toContain('## Fees');
    });

    it('should include statutory deadline when provided', async () => {
      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', baseContext);

      expect(doc.body).toContain('statutory deadline');
    });

    it('should include metadata in the result', async () => {
      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', baseContext);

      expect(doc.metadata).toBeDefined();
      expect(doc.metadata?.requestId).toBe('APRA-2025-001');
      expect(doc.metadata?.requesterName).toBe('John Doe');
    });
  });

  // ===========================================================================
  // APRA DENIAL TEMPLATE
  // ===========================================================================

  describe('APRA_DENIAL_STANDARD', () => {
    const baseContext: ApraTemplateContext = {
      requestId: 'APRA-2025-002',
      requesterName: 'Jane Smith',
      description: 'Personnel files for all employees',
      receivedAt: '2025-01-20T14:30:00Z',
      jurisdictionName: 'Town of Lapel',
      exemptions: [
        {
          citation: 'IC 5-14-3-4(b)(8)',
          description: 'Personnel files of public employees',
        },
      ],
    };

    it('should render a denial letter with required fields', async () => {
      const doc = await renderer.render('APRA_DENIAL_STANDARD', baseContext);

      expect(doc.kind).toBe('APRA_DENIAL_STANDARD');
      expect(doc.title).toContain('APRA Denial Letter');
      expect(doc.title).toContain('APRA-2025-002');
      expect(doc.body).toContain('Jane Smith');
      expect(doc.body).toContain('Town of Lapel');
      expect(doc.body).toContain('deny');
      expect(doc.suggestedFileName).toMatch(/^\d{4}-\d{2}-\d{2}-apra-denial/);
    });

    it('should include citations from exemptions', async () => {
      const doc = await renderer.render('APRA_DENIAL_STANDARD', baseContext);

      expect(doc.body).toContain('IC 5-14-3-4(b)(8)');
      expect(doc.body).toContain('Personnel files of public employees');
      expect(doc.body).toContain('Exemptions Cited');
    });

    it('should include multiple exemptions when provided', async () => {
      const contextMultipleExemptions: ApraTemplateContext = {
        ...baseContext,
        exemptions: [
          {
            citation: 'IC 5-14-3-4(b)(6)',
            description: 'Deliberative material',
          },
          {
            citation: 'IC 5-14-3-4(b)(8)',
            description: 'Personnel files',
          },
          {
            citation: 'IC 5-14-3-4(a)(1)',
            description: 'Records declared confidential by statute',
          },
        ],
      };

      const doc = await renderer.render('APRA_DENIAL_STANDARD', contextMultipleExemptions);

      expect(doc.body).toContain('IC 5-14-3-4(b)(6)');
      expect(doc.body).toContain('IC 5-14-3-4(b)(8)');
      expect(doc.body).toContain('IC 5-14-3-4(a)(1)');
      expect(doc.metadata?.exemptionCount).toBe(3);
    });

    it('should mention appeal rights / Public Access Counselor', async () => {
      const doc = await renderer.render('APRA_DENIAL_STANDARD', baseContext);

      expect(doc.body).toContain('Right to Appeal');
      expect(doc.body).toContain('Public Access Counselor');
      expect(doc.body).toContain('IC 5-14-3-9');
      expect(doc.body).toContain('pac@atg.in.gov');
    });

    it('should handle missing exemptions gracefully', async () => {
      const contextNoExemptions: ApraTemplateContext = {
        ...baseContext,
        exemptions: undefined,
      };

      const doc = await renderer.render('APRA_DENIAL_STANDARD', contextNoExemptions);

      expect(doc.body).toContain('No specific exemptions were provided');
      expect(doc.metadata?.exemptionCount).toBe(0);
    });
  });

  // ===========================================================================
  // MEETING NOTICE TEMPLATES
  // ===========================================================================

  describe('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', () => {
    const baseContext: MeetingNoticeTemplateContext = {
      meetingId: 'MTG-2025-001',
      governingBodyName: 'Town Council',
      meetingDate: '2025-02-03T19:00:00Z',
      meetingTime: '7:00 PM',
      locationName: 'Lapel Town Hall',
      locationAddress: '123 Main Street, Lapel, IN 46051',
      meetingType: 'regular',
      jurisdictionName: 'Town of Lapel',
    };

    it('should render a regular meeting notice with required fields', async () => {
      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', baseContext);

      expect(doc.kind).toBe('MEETING_NOTICE_TOWN_COUNCIL_REGULAR');
      expect(doc.title).toContain('Notice of Regular Meeting');
      expect(doc.title).toContain('Town Council');
      expect(doc.body).toContain('Town Council');
      expect(doc.body).toContain('7:00 PM');
      expect(doc.body).toContain('Lapel Town Hall');
      expect(doc.body).toContain('Town of Lapel');
      expect(doc.suggestedFileName).toContain('regular-meeting-notice');
    });

    it('should include location address when provided', async () => {
      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', baseContext);

      expect(doc.body).toContain('123 Main Street, Lapel, IN 46051');
    });

    it('should mention IC 5-14-1.5-5 (Open Door Law)', async () => {
      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', baseContext);

      expect(doc.body).toContain('IC 5-14-1.5-5');
      expect(doc.body).toContain('Open Door Law');
    });

    it('should include agenda items when provided', async () => {
      const contextWithAgenda: MeetingNoticeTemplateContext = {
        ...baseContext,
        agendaItems: [
          'Call to Order',
          'Approval of Minutes',
          'Old Business: Street Repair Project',
          'New Business: Budget Amendment',
          'Adjournment',
        ],
      };

      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', contextWithAgenda);

      expect(doc.body).toContain('Agenda Items');
      expect(doc.body).toContain('Call to Order');
      expect(doc.body).toContain('Budget Amendment');
    });

    it('should include agenda summary when provided', async () => {
      const contextWithSummary: MeetingNoticeTemplateContext = {
        ...baseContext,
        agendaSummary: 'The Council will discuss the proposed annexation of the industrial park.',
      };

      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', contextWithSummary);

      expect(doc.body).toContain('Purpose');
      expect(doc.body).toContain('annexation of the industrial park');
    });

    it('should include metadata in the result', async () => {
      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_REGULAR', baseContext);

      expect(doc.metadata).toBeDefined();
      expect(doc.metadata?.meetingId).toBe('MTG-2025-001');
      expect(doc.metadata?.governingBodyName).toBe('Town Council');
      expect(doc.metadata?.meetingType).toBe('regular');
    });
  });

  describe('MEETING_NOTICE_TOWN_COUNCIL_SPECIAL', () => {
    const baseContext: MeetingNoticeTemplateContext = {
      meetingId: 'MTG-2025-002',
      governingBodyName: 'Town Council',
      meetingDate: '2025-02-10T18:00:00Z',
      meetingTime: '6:00 PM',
      locationName: 'Lapel Town Hall',
      meetingType: 'special',
      jurisdictionName: 'Town of Lapel',
      agendaSummary: 'Emergency discussion of water main break repairs.',
    };

    it('should render a special meeting notice', async () => {
      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_SPECIAL', baseContext);

      expect(doc.kind).toBe('MEETING_NOTICE_TOWN_COUNCIL_SPECIAL');
      expect(doc.title).toContain('Special Meeting');
      expect(doc.body).toContain('special meeting');
      expect(doc.suggestedFileName).toContain('special-meeting-notice');
    });

    it('should include special meeting restriction note', async () => {
      const doc = await renderer.render('MEETING_NOTICE_TOWN_COUNCIL_SPECIAL', baseContext);

      expect(doc.body).toContain('This is a special meeting');
      expect(doc.body).toContain('Only the items listed');
    });
  });

  // ===========================================================================
  // BZA USE VARIANCE TEMPLATE
  // ===========================================================================

  describe('BZA_FINDINGS_USE_VARIANCE', () => {
    const baseContext: BzaUseVarianceTemplateContext = {
      caseNumber: 'BZA-2025-003',
      applicantName: 'ABC Development LLC',
      propertyAddress: '456 Industrial Drive, Lapel, IN 46051',
      legalDescription: 'Lot 5, Block 2, Industrial Park Subdivision',
      dateOfHearing: '2025-02-15T19:00:00Z',
      boardName: 'Town of Lapel Board of Zoning Appeals',
      findings: {
        unnecessaryHardship:
          'The Board finds that the strict application of the zoning ordinance ' +
          'would deprive the applicant of reasonable use of the property due to ' +
          'its unique triangular shape and limited street frontage.',
        publicWelfare:
          'The Board finds that the proposed use will not be injurious to the ' +
          'public health, safety, morals, or general welfare, as the property is ' +
          'surrounded by similar industrial uses.',
        comprehensivePlan:
          'The Board finds that the proposed use is consistent with the ' +
          'Comprehensive Plan designation of "Industrial" for this area.',
      },
      decision: 'APPROVED',
      conditions: [
        'The applicant shall install a 6-foot privacy fence along the north property line.',
        'All outdoor storage shall be screened from public view.',
        'The variance shall expire if not utilized within 12 months.',
      ],
      statutesCited: ['IC 36-7-4-918.4'],
      jurisdictionName: 'Town of Lapel',
    };

    it('should render BZA findings with all required sections', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.kind).toBe('BZA_FINDINGS_USE_VARIANCE');
      expect(doc.title).toContain('BZA Findings of Fact');
      expect(doc.title).toContain('BZA-2025-003');
      expect(doc.body).toContain('ABC Development LLC');
      expect(doc.body).toContain('456 Industrial Drive');
      expect(doc.suggestedFileName).toMatch(/^\d{4}-\d{2}-\d{2}-bza-use-variance/);
    });

    it('should contain headings for each statutory criterion', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.body).toContain('Unnecessary Hardship');
      expect(doc.body).toContain('Public Welfare');
      expect(doc.body).toContain('Comprehensive Plan');
    });

    it('should include the findings text for each criterion', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.body).toContain('unique triangular shape');
      expect(doc.body).toContain('similar industrial uses');
      expect(doc.body).toContain('consistent with the Comprehensive Plan');
    });

    it('should include decision (APPROVED)', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.body).toContain('DECISION');
      expect(doc.body).toContain('APPROVED');
      expect(doc.metadata?.decision).toBe('APPROVED');
    });

    it('should include decision (DENIED)', async () => {
      const deniedContext: BzaUseVarianceTemplateContext = {
        ...baseContext,
        decision: 'DENIED',
        conditions: undefined,
      };

      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', deniedContext);

      expect(doc.body).toContain('DENIED');
      expect(doc.metadata?.decision).toBe('DENIED');
    });

    it('should include conditions when approved with conditions', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.body).toContain('Conditions of Approval');
      expect(doc.body).toContain('6-foot privacy fence');
      expect(doc.body).toContain('outdoor storage shall be screened');
      expect(doc.body).toContain('expire if not utilized within 12 months');
    });

    it('should not include conditions section when denied', async () => {
      const deniedContext: BzaUseVarianceTemplateContext = {
        ...baseContext,
        decision: 'DENIED',
        conditions: undefined,
      };

      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', deniedContext);

      expect(doc.body).not.toContain('Conditions of Approval');
    });

    it('should cite IC 36-7-4-918.4', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.body).toContain('IC 36-7-4-918.4');
    });

    it('should include legal description when provided', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.body).toContain('Lot 5, Block 2, Industrial Park Subdivision');
    });

    it('should include metadata in the result', async () => {
      const doc = await renderer.render('BZA_FINDINGS_USE_VARIANCE', baseContext);

      expect(doc.metadata).toBeDefined();
      expect(doc.metadata?.caseNumber).toBe('BZA-2025-003');
      expect(doc.metadata?.applicantName).toBe('ABC Development LLC');
      expect(doc.metadata?.propertyAddress).toBe('456 Industrial Drive, Lapel, IN 46051');
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should throw a helpful error for unsupported template kinds', async () => {
      const invalidKind = 'INVALID_TEMPLATE_KIND' as LegalTemplateKind;
      const context: ApraTemplateContext = {
        requestId: 'TEST-001',
        requesterName: 'Test User',
        description: 'Test request',
        receivedAt: '2025-01-01T00:00:00Z',
        jurisdictionName: 'Test Town',
      };

      await expect(renderer.render(invalidKind, context)).rejects.toThrow(
        'Unsupported legal template kind: INVALID_TEMPLATE_KIND'
      );
    });

    it('should include supported kinds in error message', async () => {
      const invalidKind = 'UNKNOWN' as LegalTemplateKind;
      const context: ApraTemplateContext = {
        requestId: 'TEST-001',
        requesterName: 'Test User',
        description: 'Test request',
        receivedAt: '2025-01-01T00:00:00Z',
        jurisdictionName: 'Test Town',
      };

      await expect(renderer.render(invalidKind, context)).rejects.toThrow(
        /Supported kinds:/
      );
    });
  });

  // ===========================================================================
  // FILENAME GENERATION
  // ===========================================================================

  describe('filename generation', () => {
    it('should generate date-prefixed filenames for APRA documents', async () => {
      const context: ApraTemplateContext = {
        requestId: 'APRA-2025-001',
        requesterName: 'Test User',
        description: 'Test request',
        receivedAt: '2025-03-15T10:00:00Z',
        jurisdictionName: 'Test Town',
      };

      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', context);

      expect(doc.suggestedFileName).toMatch(/^2025-03-15-/);
    });

    it('should sanitize special characters in filenames', async () => {
      const context: ApraTemplateContext = {
        requestId: 'APRA/2025#001!',
        requesterName: 'Test User',
        description: 'Test request',
        receivedAt: '2025-01-01T00:00:00Z',
        jurisdictionName: 'Test Town',
      };

      const doc = await renderer.render('APRA_FULFILLMENT_STANDARD', context);

      // Should not contain special characters
      expect(doc.suggestedFileName).not.toMatch(/[/#!]/);
      expect(doc.suggestedFileName).toMatch(/apra-2025-001/);
    });
  });
});
