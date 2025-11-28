// src/core/legal/templates/simple-legal-template.renderer.ts
//
// A simple, deterministic legal template renderer for Indiana.
// Uses hand-coded template functions (no external template library).

import {
  LegalTemplateKind,
  RenderedLegalDocument,
  ApraTemplateContext,
  MeetingNoticeTemplateContext,
  BzaUseVarianceTemplateContext,
  LegalTemplateRenderer,
  LegalTemplateContext,
} from '../types';

/**
 * SimpleLegalTemplateRenderer
 *
 * A dependency-free, deterministic template engine that produces
 * legal documents for Indiana municipalities. Each template references
 * Indiana statutes and follows standard municipal legal document formats.
 *
 * Templates produced require human review before official use.
 */
export class SimpleLegalTemplateRenderer implements LegalTemplateRenderer {
  /**
   * Render a legal document from a template kind and context.
   *
   * @param kind - The template kind to render
   * @param context - The context data for the template
   * @returns A rendered legal document
   * @throws Error if the template kind is not supported
   */
  async render(
    kind: LegalTemplateKind,
    context: LegalTemplateContext
  ): Promise<RenderedLegalDocument> {
    switch (kind) {
      case 'APRA_FULFILLMENT_STANDARD':
        return this.renderApraFulfillment(context as ApraTemplateContext);

      case 'APRA_DENIAL_STANDARD':
        return this.renderApraDenial(context as ApraTemplateContext);

      case 'MEETING_NOTICE_TOWN_COUNCIL_REGULAR':
        return this.renderMeetingNotice(
          kind,
          context as MeetingNoticeTemplateContext
        );

      case 'MEETING_NOTICE_TOWN_COUNCIL_SPECIAL':
        return this.renderMeetingNotice(
          kind,
          context as MeetingNoticeTemplateContext
        );

      case 'BZA_FINDINGS_USE_VARIANCE':
        return this.renderBzaUseVariance(
          context as BzaUseVarianceTemplateContext
        );

      default:
        throw new Error(
          `Unsupported legal template kind: ${kind}. ` +
            `Supported kinds: APRA_FULFILLMENT_STANDARD, APRA_DENIAL_STANDARD, ` +
            `MEETING_NOTICE_TOWN_COUNCIL_REGULAR, MEETING_NOTICE_TOWN_COUNCIL_SPECIAL, ` +
            `BZA_FINDINGS_USE_VARIANCE`
        );
    }
  }

  // ===========================================================================
  // APRA TEMPLATES
  // ===========================================================================

  /**
   * Render an APRA fulfillment letter.
   */
  private renderApraFulfillment(
    ctx: ApraTemplateContext
  ): RenderedLegalDocument {
    const currentDate = this.formatDate(new Date().toISOString());
    const receivedDate = this.formatDate(ctx.receivedAt);
    const deadlineDate = ctx.statutoryDeadlineAt
      ? this.formatDate(ctx.statutoryDeadlineAt)
      : null;

    const lines: string[] = [
      `# Response to Public Records Request`,
      ``,
      `**${ctx.jurisdictionName}**`,
      ``,
      `**Date:** ${currentDate}`,
      ``,
      `**Re:** Public Records Request ${ctx.requestId}`,
      ``,
      `---`,
      ``,
      `Dear ${ctx.requesterName},`,
      ``,
      `This letter is in response to your public records request received on ${receivedDate}, ` +
        `in which you requested:`,
      ``,
      `> ${ctx.description}`,
      ``,
      `Pursuant to the Indiana Access to Public Records Act (IC 5-14-3), ` +
        `the ${ctx.jurisdictionName} has reviewed your request and is providing ` +
        `the responsive records as described below.`,
      ``,
    ];

    // Add deadline reference if available
    if (deadlineDate) {
      lines.push(
        `The statutory deadline for response to this request was ${deadlineDate}.`,
        ``
      );
    }

    // Add fee information if applicable
    if (ctx.totalFeesCents && ctx.totalFeesCents > 0) {
      const feeDisplay = ctx.formattedTotalFees || this.formatCents(ctx.totalFeesCents);
      lines.push(
        `## Fees`,
        ``,
        `In accordance with IC 5-14-3-8, the total fees for copying and/or ` +
          `transmitting the requested records are **${feeDisplay}**.`,
        ``,
        `Please remit payment to the ${ctx.jurisdictionName} prior to or upon ` +
          `receipt of the records.`,
        ``
      );
    }

    lines.push(
      `## Records Provided`,
      ``,
      `The enclosed/attached records are responsive to your request. ` +
        `If you have any questions about these records, please contact our office.`,
      ``,
      `---`,
      ``,
      `*This response is provided pursuant to Indiana Code 5-14-3 ` +
        `(Access to Public Records Act).*`,
      ``,
      `Sincerely,`,
      ``,
      `${ctx.jurisdictionName}`,
      `Public Records Office`,
      ``
    );

    const dateSlug = this.formatDateSlug(ctx.receivedAt);
    const requestSlug = ctx.requestId.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return {
      kind: 'APRA_FULFILLMENT_STANDARD',
      title: `APRA Fulfillment Letter - ${ctx.requestId}`,
      body: lines.join('\n'),
      suggestedFileName: `${dateSlug}-apra-fulfillment-${requestSlug}.md`,
      metadata: {
        requestId: ctx.requestId,
        requesterName: ctx.requesterName,
        receivedAt: ctx.receivedAt,
        totalFeesCents: ctx.totalFeesCents,
      },
    };
  }

  /**
   * Render an APRA denial letter.
   */
  private renderApraDenial(ctx: ApraTemplateContext): RenderedLegalDocument {
    const currentDate = this.formatDate(new Date().toISOString());
    const receivedDate = this.formatDate(ctx.receivedAt);

    const lines: string[] = [
      `# Denial of Public Records Request`,
      ``,
      `**${ctx.jurisdictionName}**`,
      ``,
      `**Date:** ${currentDate}`,
      ``,
      `**Re:** Public Records Request ${ctx.requestId}`,
      ``,
      `---`,
      ``,
      `Dear ${ctx.requesterName},`,
      ``,
      `This letter is in response to your public records request received on ${receivedDate}, ` +
        `in which you requested:`,
      ``,
      `> ${ctx.description}`,
      ``,
      `After review, the ${ctx.jurisdictionName} must **deny** your request ` +
        `(in whole or in part) for the following reasons:`,
      ``,
    ];

    // Add exemption citations
    if (ctx.exemptions && ctx.exemptions.length > 0) {
      lines.push(`## Exemptions Cited`, ``);
      for (const exemption of ctx.exemptions) {
        lines.push(
          `- **${exemption.citation}**: ${exemption.description}`,
          ``
        );
      }
    } else {
      lines.push(
        `*No specific exemptions were provided. Please contact the office ` +
          `for clarification.*`,
        ``
      );
    }

    lines.push(
      `## Right to Appeal`,
      ``,
      `Pursuant to IC 5-14-3-9(f), you have the right to appeal this denial ` +
        `to the Indiana Public Access Counselor within the Office of the ` +
        `Indiana Attorney General. You may file a formal complaint with:`,
      ``,
      `**Office of the Indiana Attorney General**`,
      `Public Access Counselor`,
      `302 West Washington Street, 5th Floor`,
      `Indianapolis, IN 46204`,
      `Phone: (317) 234-0906`,
      `Email: pac@atg.in.gov`,
      `Website: https://www.in.gov/pac/`,
      ``,
      `You also have the right to bring an action in court under IC 5-14-3-9(g).`,
      ``,
      `---`,
      ``,
      `*This response is provided pursuant to Indiana Code 5-14-3 ` +
        `(Access to Public Records Act).*`,
      ``,
      `Sincerely,`,
      ``,
      `${ctx.jurisdictionName}`,
      `Public Records Office`,
      ``
    );

    const dateSlug = this.formatDateSlug(ctx.receivedAt);
    const requestSlug = ctx.requestId.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return {
      kind: 'APRA_DENIAL_STANDARD',
      title: `APRA Denial Letter - ${ctx.requestId}`,
      body: lines.join('\n'),
      suggestedFileName: `${dateSlug}-apra-denial-${requestSlug}.md`,
      metadata: {
        requestId: ctx.requestId,
        requesterName: ctx.requesterName,
        receivedAt: ctx.receivedAt,
        exemptionCount: ctx.exemptions?.length || 0,
      },
    };
  }

  // ===========================================================================
  // MEETING NOTICE TEMPLATES
  // ===========================================================================

  /**
   * Render a meeting notice (regular or special).
   */
  private renderMeetingNotice(
    kind: LegalTemplateKind,
    ctx: MeetingNoticeTemplateContext
  ): RenderedLegalDocument {
    const isSpecial = kind === 'MEETING_NOTICE_TOWN_COUNCIL_SPECIAL';
    const meetingTypeLabel = this.getMeetingTypeLabel(ctx.meetingType);
    const formattedDate = this.formatDate(ctx.meetingDate);

    const lines: string[] = [
      `# NOTICE OF ${meetingTypeLabel.toUpperCase()} MEETING`,
      ``,
      `**${ctx.jurisdictionName}**`,
      `**${ctx.governingBodyName}**`,
      ``,
      `---`,
      ``,
      `Notice is hereby given that a **${meetingTypeLabel} meeting** of the ` +
        `${ctx.governingBodyName} of the ${ctx.jurisdictionName} will be held:`,
      ``,
      `**Date:** ${formattedDate}`,
      `**Time:** ${ctx.meetingTime}`,
      `**Location:** ${ctx.locationName}`,
    ];

    if (ctx.locationAddress) {
      lines.push(`**Address:** ${ctx.locationAddress}`);
    }

    lines.push(``);

    // Add agenda summary or items if provided
    if (ctx.agendaSummary) {
      lines.push(`## Purpose`, ``, ctx.agendaSummary, ``);
    }

    if (ctx.agendaItems && ctx.agendaItems.length > 0) {
      lines.push(`## Agenda Items`, ``);
      for (const item of ctx.agendaItems) {
        lines.push(`- ${item}`);
      }
      lines.push(``);
    }

    // Add special meeting note if applicable
    if (isSpecial) {
      lines.push(
        `---`,
        ``,
        `*This is a special meeting. Only the items listed above ` +
          `will be considered.*`,
        ``
      );
    }

    // Add Open Door Law citation
    const statutes = ctx.statutesCited || ['IC 5-14-1.5-5'];
    lines.push(
      `---`,
      ``,
      `This notice is posted in accordance with Indiana's Open Door Law ` +
        `(${statutes.join(', ')}). The meeting is open to the public.`,
      ``,
      `For more information, please contact the ${ctx.jurisdictionName} ` +
        `Clerk-Treasurer's Office.`,
      ``
    );

    const dateSlug = this.formatDateSlug(ctx.meetingDate);
    const bodySlug = ctx.governingBodyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const typeSlug = isSpecial ? 'special' : 'regular';

    return {
      kind,
      title: `Notice of ${meetingTypeLabel} Meeting - ${ctx.governingBodyName}`,
      body: lines.join('\n'),
      suggestedFileName: `${dateSlug}-${bodySlug}-${typeSlug}-meeting-notice.md`,
      metadata: {
        meetingId: ctx.meetingId,
        meetingDate: ctx.meetingDate,
        meetingTime: ctx.meetingTime,
        governingBodyName: ctx.governingBodyName,
        meetingType: ctx.meetingType,
      },
    };
  }

  // ===========================================================================
  // BZA TEMPLATES
  // ===========================================================================

  /**
   * Render BZA use variance findings of fact.
   */
  private renderBzaUseVariance(
    ctx: BzaUseVarianceTemplateContext
  ): RenderedLegalDocument {
    const hearingDate = this.formatDate(ctx.dateOfHearing);
    const decisionLabel = ctx.decision === 'APPROVED' ? 'APPROVED' : 'DENIED';

    const lines: string[] = [
      `# FINDINGS OF FACT AND DECISION`,
      `# USE VARIANCE`,
      ``,
      `**${ctx.boardName}**`,
      ``,
      `---`,
      ``,
      `**Case Number:** ${ctx.caseNumber}`,
      `**Applicant:** ${ctx.applicantName}`,
      `**Property Address:** ${ctx.propertyAddress}`,
    ];

    if (ctx.legalDescription) {
      lines.push(`**Legal Description:** ${ctx.legalDescription}`);
    }

    lines.push(
      `**Date of Hearing:** ${hearingDate}`,
      ``,
      `---`,
      ``,
      `## FINDINGS OF FACT`,
      ``,
      `The ${ctx.boardName} has considered the application for a use variance ` +
        `and, pursuant to IC 36-7-4-918.4, makes the following findings:`,
      ``,
      `### 1. Unnecessary Hardship`,
      `*(IC 36-7-4-918.4(a)(1): The approval will not be injurious to the public ` +
        `health, safety, morals, and general welfare of the community)*`,
      ``,
      ctx.findings.unnecessaryHardship,
      ``,
      `### 2. Public Welfare`,
      `*(IC 36-7-4-918.4(a)(2): The use and value of the area adjacent to the ` +
        `property included in the variance will not be affected in a substantially ` +
        `adverse manner)*`,
      ``,
      ctx.findings.publicWelfare,
      ``,
      `### 3. Comprehensive Plan`,
      `*(IC 36-7-4-918.4(a)(3): The strict application of the terms of the ` +
        `zoning ordinance will result in practical difficulties in the use of ` +
        `the property)*`,
      ``,
      ctx.findings.comprehensivePlan,
      ``,
      `---`,
      ``,
      `## DECISION`,
      ``,
      `Based upon the above Findings of Fact, the ${ctx.boardName} hereby ` +
        `**${decisionLabel}** the use variance requested by ${ctx.applicantName} ` +
        `for the property located at ${ctx.propertyAddress}.`,
      ``
    );

    // Add conditions if approved with conditions
    if (ctx.decision === 'APPROVED' && ctx.conditions && ctx.conditions.length > 0) {
      lines.push(`### Conditions of Approval`, ``);
      for (let i = 0; i < ctx.conditions.length; i++) {
        lines.push(`${i + 1}. ${ctx.conditions[i]}`);
      }
      lines.push(``);
    }

    // Add statutory citation
    const statutes = ctx.statutesCited || ['IC 36-7-4-918.4'];
    lines.push(
      `---`,
      ``,
      `*This decision is made pursuant to ${statutes.join(', ')} and the ` +
        `applicable provisions of the ${ctx.jurisdictionName} Zoning Ordinance.*`,
      ``,
      `**${ctx.boardName}**`,
      ``,
      `_______________________________`,
      `Board President / Chairperson`,
      ``,
      `Date: _______________________________`,
      ``
    );

    const dateSlug = this.formatDateSlug(ctx.dateOfHearing);
    const caseSlug = ctx.caseNumber.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return {
      kind: 'BZA_FINDINGS_USE_VARIANCE',
      title: `BZA Findings of Fact - Use Variance - ${ctx.caseNumber}`,
      body: lines.join('\n'),
      suggestedFileName: `${dateSlug}-bza-use-variance-${caseSlug}.md`,
      metadata: {
        caseNumber: ctx.caseNumber,
        applicantName: ctx.applicantName,
        propertyAddress: ctx.propertyAddress,
        decision: ctx.decision,
        dateOfHearing: ctx.dateOfHearing,
      },
    };
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Format an ISO date string to a human-readable date.
   */
  private formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format an ISO date to a filename-safe slug (YYYY-MM-DD).
   */
  private formatDateSlug(isoDate: string): string {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format cents as a dollar string (e.g., 1050 -> "$10.50").
   */
  private formatCents(cents: number): string {
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  }

  /**
   * Get a human-readable label for meeting type.
   */
  private getMeetingTypeLabel(
    meetingType: 'regular' | 'special' | 'emergency' | 'executiveSession'
  ): string {
    switch (meetingType) {
      case 'regular':
        return 'Regular';
      case 'special':
        return 'Special';
      case 'emergency':
        return 'Emergency';
      case 'executiveSession':
        return 'Executive Session';
      default:
        return 'Regular';
    }
  }
}
