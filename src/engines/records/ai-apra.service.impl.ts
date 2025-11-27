// src/engines/records/ai-apra.service.impl.ts
//
// AI-enhanced APRA service implementation.

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { AiCoreService } from '../../core/ai/ai.service';
import { ApraRequest, ApraExemptionCitation, ApraFulfillment } from './apra.types';
import {
  ApraService,
  AiApraService,
  ParticularityAnalysis,
  SuggestedExemption,
  ScopeAnalysis,
} from './apra.service';

/**
 * Indiana APRA exemptions catalog for AI reference.
 * Based on IC 5-14-3-4.
 */
const INDIANA_EXEMPTIONS = [
  {
    citation: 'IC 5-14-3-4(a)(1)',
    description: 'Records expressly prohibited from disclosure by federal law.',
    keywords: ['federal', 'hipaa', 'ferpa', 'classified', 'national security'],
  },
  {
    citation: 'IC 5-14-3-4(a)(2)',
    description: 'Records expressly prohibited from disclosure by state statute.',
    keywords: ['confidential', 'statute', 'state law'],
  },
  {
    citation: 'IC 5-14-3-4(b)(1)',
    description: 'Investigatory records of law enforcement agencies.',
    keywords: ['investigation', 'police', 'criminal', 'law enforcement', 'detective'],
  },
  {
    citation: 'IC 5-14-3-4(b)(2)',
    description: 'Work product of an attorney representing the agency.',
    keywords: ['attorney', 'legal', 'litigation', 'work product', 'counsel'],
  },
  {
    citation: 'IC 5-14-3-4(b)(3)',
    description: 'Test questions, scoring keys, and other examination data.',
    keywords: ['test', 'exam', 'scoring', 'questions', 'answers'],
  },
  {
    citation: 'IC 5-14-3-4(b)(6)',
    description: 'Personnel files of public employees except for basic information.',
    keywords: ['personnel', 'employee', 'hr', 'human resources', 'performance', 'discipline'],
  },
  {
    citation: 'IC 5-14-3-4(b)(8)',
    description: 'Administrative or technical information that would jeopardize security.',
    keywords: ['security', 'alarm', 'password', 'vulnerability', 'access codes'],
  },
  {
    citation: 'IC 5-14-3-4(b)(14)',
    description: 'Deliberative material (advisory or deliberative communications).',
    keywords: ['deliberative', 'advisory', 'draft', 'internal discussion', 'recommendation'],
  },
  {
    citation: 'IC 5-14-3-4(b)(19)',
    description: 'Social security numbers.',
    keywords: ['social security', 'ssn', 'social security number'],
  },
  {
    citation: 'IC 5-14-3-4(b)(26)',
    description: 'Home addresses of law enforcement officers.',
    keywords: ['home address', 'officer', 'police', 'personal address'],
  },
];

/**
 * System prompt for APRA analysis tasks.
 */
const APRA_SYSTEM_PROMPT = `You are an expert in Indiana's Access to Public Records Act (APRA), codified at IC 5-14-3.

Key APRA requirements:
- Agencies must respond within 7 business days (IC 5-14-3-9)
- Requests must "reasonably particularly" identify records (IC 5-14-3-3(a))
- Exemptions from disclosure are listed in IC 5-14-3-4
- Agencies may charge reasonable copying fees

When analyzing requests, be helpful to public agencies while respecting the public's right to access government records. Favor disclosure when exemptions don't clearly apply.`;

/**
 * Wraps any ApraService implementation with AI capabilities.
 *
 * Uses composition to add AI features to an existing APRA service.
 * Requires an AiCoreService for natural language processing.
 *
 * @example
 * const baseService = new InMemoryApraService();
 * const aiService = new AiApraServiceImpl(baseService, aiCore);
 * const analysis = await aiService.analyzeParticularity(ctx, requestId);
 */
export class AiApraServiceImpl implements AiApraService {
  constructor(
    private readonly base: ApraService,
    private readonly aiCore: AiCoreService
  ) {}

  // ---------- Delegated methods ----------

  createRequest = this.base.createRequest.bind(this.base);
  getRequest = this.base.getRequest.bind(this.base);
  listRequests = this.base.listRequests.bind(this.base);
  addClarification = this.base.addClarification.bind(this.base);
  recordClarificationResponse = this.base.recordClarificationResponse.bind(this.base);
  updateStatus = this.base.updateStatus.bind(this.base);
  addExemption = this.base.addExemption.bind(this.base);
  recordFulfillment = this.base.recordFulfillment.bind(this.base);
  getStatusHistory = this.base.getStatusHistory.bind(this.base);
  getScopes = this.base.getScopes.bind(this.base);
  getClarifications = this.base.getClarifications.bind(this.base);
  getExemptions = this.base.getExemptions.bind(this.base);
  getFulfillments = this.base.getFulfillments.bind(this.base);

  // ---------- AI-enhanced methods ----------

  async analyzeParticularity(
    ctx: TenantContext,
    requestId: string
  ): Promise<ParticularityAnalysis> {
    const request = await this.getRequest(ctx, requestId);
    if (!request) {
      throw new Error('APRA request not found');
    }

    const scopes = await this.getScopes(ctx, requestId);
    const scopeText = scopes.length > 0
      ? `\n\nScopes provided:\n${scopes.map(s => `- Type: ${s.recordType ?? 'not specified'}, Date range: ${s.dateRangeStart ?? 'not specified'} to ${s.dateRangeEnd ?? 'not specified'}`).join('\n')}`
      : '';

    const prompt = `Analyze whether this APRA request meets the "reasonably particular" requirement under IC 5-14-3-3(a).

Request description:
"${request.description}"${scopeText}

A request is "reasonably particular" if it identifies specific records or categories of records that can be located with reasonable effort. Vague requests like "all records about topic X" without date ranges or other limiting factors may not be particular enough.

Respond in JSON format:
{
  "isParticular": boolean,
  "confidence": number (0-1),
  "reasoning": "explanation of assessment",
  "suggestedClarifications": ["question 1", "question 2"] // only if not particular
}`;

    const response = await this.aiCore.chat(ctx, {
      messages: [
        { role: 'system', content: APRA_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        isParticular: result.isParticular ?? true,
        confidence: result.confidence ?? 0.5,
        reasoning: result.reasoning ?? 'Unable to parse AI response',
        suggestedClarifications: result.suggestedClarifications,
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        isParticular: true,
        confidence: 0.3,
        reasoning: 'AI analysis inconclusive. Manual review recommended.',
      };
    }
  }

  async suggestExemptions(
    ctx: TenantContext,
    requestId: string
  ): Promise<SuggestedExemption[]> {
    const request = await this.getRequest(ctx, requestId);
    if (!request) {
      throw new Error('APRA request not found');
    }

    const scopes = await this.getScopes(ctx, requestId);
    const scopeText = scopes.length > 0
      ? `\n\nRecord types/scopes requested:\n${scopes.map(s => `- ${s.recordType ?? 'general'}: ${s.keywords?.join(', ') ?? 'no keywords'}`).join('\n')}`
      : '';

    const exemptionCatalog = INDIANA_EXEMPTIONS.map(
      e => `${e.citation}: ${e.description}`
    ).join('\n');

    const prompt = `Analyze this APRA request and suggest any exemptions from IC 5-14-3-4 that may apply.

Request description:
"${request.description}"${scopeText}

Available exemptions:
${exemptionCatalog}

Only suggest exemptions that reasonably might apply based on the request content. Favor disclosure - only suggest exemptions where there's a reasonable basis.

Respond in JSON format:
{
  "exemptions": [
    {
      "citation": "IC 5-14-3-4(x)(y)",
      "description": "brief description",
      "confidence": number (0-1),
      "reasoning": "why this might apply"
    }
  ]
}

If no exemptions clearly apply, return {"exemptions": []}.`;

    const response = await this.aiCore.chat(ctx, {
      messages: [
        { role: 'system', content: APRA_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(response.content);
      return (result.exemptions ?? []).map((e: Record<string, unknown>) => ({
        citation: String(e.citation ?? ''),
        description: String(e.description ?? ''),
        confidence: Number(e.confidence ?? 0.5),
        reasoning: String(e.reasoning ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async analyzeScope(
    ctx: TenantContext,
    requestId: string
  ): Promise<ScopeAnalysis> {
    const request = await this.getRequest(ctx, requestId);
    if (!request) {
      throw new Error('APRA request not found');
    }

    const prompt = `Extract scope details from this APRA request to help staff locate records.

Request description:
"${request.description}"

Identify:
1. Types of records being requested (emails, contracts, meeting minutes, etc.)
2. Departments or people who might have custody of these records
3. Keywords that would help search for these records
4. Any date ranges mentioned

Respond in JSON format:
{
  "recordTypes": ["type1", "type2"],
  "suggestedCustodians": ["department1", "person/role"],
  "keywords": ["keyword1", "keyword2"],
  "dateRange": {
    "start": "YYYY-MM-DD or null",
    "end": "YYYY-MM-DD or null"
  },
  "confidence": number (0-1)
}`;

    const response = await this.aiCore.chat(ctx, {
      messages: [
        { role: 'system', content: APRA_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        recordTypes: result.recordTypes ?? [],
        suggestedCustodians: result.suggestedCustodians ?? [],
        keywords: result.keywords ?? [],
        dateRange: result.dateRange?.start || result.dateRange?.end
          ? {
              start: result.dateRange?.start ?? undefined,
              end: result.dateRange?.end ?? undefined,
            }
          : undefined,
        confidence: result.confidence ?? 0.5,
      };
    } catch {
      return {
        recordTypes: [],
        suggestedCustodians: [],
        keywords: [],
        confidence: 0.3,
      };
    }
  }

  async draftResponseLetter(
    ctx: TenantContext,
    requestId: string
  ): Promise<string> {
    const request = await this.getRequest(ctx, requestId);
    if (!request) {
      throw new Error('APRA request not found');
    }

    const exemptions = await this.getExemptions(ctx, requestId);
    const fulfillments = await this.getFulfillments(ctx, requestId);
    const clarifications = await this.getClarifications(ctx, requestId);

    const statusContext = this.buildStatusContext(request, exemptions, fulfillments, clarifications);

    const prompt = `Draft a professional response letter for this APRA request.

Request details:
- Requester: ${request.requesterName}
- Description: "${request.description}"
- Current status: ${request.status}
- Received: ${request.receivedAt}
- Deadline: ${request.statutoryDeadlineAt ?? 'not set'}

${statusContext}

Draft a formal but friendly response letter appropriate for the current status. Include:
- Acknowledgment of the request
- Status update
- Any exemptions being cited (with IC citations)
- Next steps or delivery information
- Contact information placeholder

The letter should be professional and compliant with IC 5-14-3.`;

    const response = await this.aiCore.chat(ctx, {
      messages: [
        { role: 'system', content: APRA_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    return response.content;
  }

  async reviewParticularity(
    ctx: TenantContext,
    requestId: string,
    isParticular: boolean,
    reason?: string
  ): Promise<ApraRequest> {
    const request = await this.getRequest(ctx, requestId);
    if (!request) {
      throw new Error('APRA request not found');
    }

    // Update the request with the human review determination
    // This uses the base service to update status if clarification is needed
    if (!isParticular && request.status === 'RECEIVED') {
      // If not particular and still in RECEIVED status, suggest adding clarification
      // The actual clarification should be added separately via addClarification
    }

    // Update request fields - for now return the request as-is since
    // the base service doesn't have a direct update method for these fields.
    // In a real implementation, we'd update reasonablyParticular and particularityReason.
    return request;
  }

  // ---------- Helper methods ----------

  private buildStatusContext(
    request: ApraRequest,
    exemptions: ApraExemptionCitation[],
    fulfillments: ApraFulfillment[],
    clarifications: { sentAt: string; respondedAt?: string; messageToRequester: string }[]
  ): string {
    const parts: string[] = [];

    if (exemptions.length > 0) {
      parts.push(
        'Exemptions cited:\n' +
        exemptions.map(e => `- ${e.citation}: ${e.description}`).join('\n')
      );
    }

    if (fulfillments.length > 0) {
      parts.push(
        'Fulfillments:\n' +
        fulfillments.map(f =>
          `- ${f.deliveryMethod} on ${f.fulfilledAt}${f.totalFeesCents ? ` (fees: $${(f.totalFeesCents / 100).toFixed(2)})` : ''}`
        ).join('\n')
      );
    }

    if (clarifications.length > 0) {
      const pendingClarification = clarifications.find(c => !c.respondedAt);
      if (pendingClarification) {
        parts.push(`Pending clarification sent on ${pendingClarification.sentAt}: "${pendingClarification.messageToRequester}"`);
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : 'No additional context.';
  }
}
