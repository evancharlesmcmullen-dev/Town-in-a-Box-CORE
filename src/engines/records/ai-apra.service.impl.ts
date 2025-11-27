// src/engines/records/ai-apra.service.impl.ts
//
// AI-enhanced APRA service implementation.
// Wraps any ApraService with AI capabilities.

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { AiCoreService } from '../../core/ai/ai.service';
import { ApraService } from './apra.service';
import { ApraRequest } from './apra.types';
import {
  AiApraService,
  ParticularityAnalysis,
  SuggestedExemption,
  ScopeAnalysis,
} from './ai-apra.service';

/**
 * Wraps any ApraService implementation with AI capabilities.
 *
 * Uses composition to add AI features to an existing APRA service.
 * Requires an AiCoreService for LLM-powered analysis.
 *
 * @example
 * const baseService = new InMemoryApraService();
 * const aiService = new AiApraServiceImpl(baseService, aiCoreService);
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
      ? `\n\nAdditional scope details:\n${JSON.stringify(scopes, null, 2)}`
      : '';

    const prompt = `You are a legal analyst specializing in Indiana public records law (APRA - IC 5-14-3).

Analyze the following public records request to determine if it meets the "reasonably particular" requirement under IC 5-14-3-3(a).

A request is "reasonably particular" if it:
- Identifies the records with enough specificity that staff can locate them
- Does not require staff to conduct research or answer questions
- Is not so broad that it would require an unreasonable amount of staff time

Request description:
"${request.description}"
${scopeText}

Respond in JSON format:
{
  "isParticular": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of your assessment",
  "suggestedClarifications": ["optional array of clarifying questions if not particular"]
}`;

    const response = await this.aiCore.complete(ctx, prompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const parsed = JSON.parse(this.extractJson(response));
      return {
        isParticular: Boolean(parsed.isParticular),
        confidence: Number(parsed.confidence) || 0.5,
        reasoning: String(parsed.reasoning || 'Unable to assess'),
        suggestedClarifications: Array.isArray(parsed.suggestedClarifications)
          ? parsed.suggestedClarifications.map(String)
          : undefined,
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        isParticular: true,
        confidence: 0.5,
        reasoning: 'Unable to parse AI response. Defaulting to particular.',
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
      ? `\n\nScope details:\n${JSON.stringify(scopes, null, 2)}`
      : '';

    const prompt = `You are a legal analyst specializing in Indiana public records law (APRA - IC 5-14-3).

Analyze the following public records request and suggest which exemptions under IC 5-14-3-4 might apply.

Common exemptions include:
- IC 5-14-3-4(a)(1): Trade secrets
- IC 5-14-3-4(a)(2): Legislative matters
- IC 5-14-3-4(a)(3): Executive privilege
- IC 5-14-3-4(b)(1): Personnel file of public employee
- IC 5-14-3-4(b)(6): Attorney-client privileged information
- IC 5-14-3-4(b)(8): Social Security numbers
- IC 5-14-3-4(b)(14): Investigatory records
- IC 5-14-3-4(b)(19): Work product of an attorney

Request description:
"${request.description}"
${scopeText}

Respond in JSON format:
{
  "exemptions": [
    {
      "citation": "IC 5-14-3-4(b)(6)",
      "description": "Plain English explanation",
      "confidence": 0.0-1.0,
      "reasoning": "Why this might apply"
    }
  ]
}

Only include exemptions that have a reasonable chance of applying. If none apply, return an empty array.`;

    const response = await this.aiCore.complete(ctx, prompt, {
      temperature: 0.3,
      maxTokens: 1500,
    });

    try {
      const parsed = JSON.parse(this.extractJson(response));
      if (Array.isArray(parsed.exemptions)) {
        return parsed.exemptions.map((e: unknown) => {
          const exemption = e as Record<string, unknown>;
          return {
            citation: String(exemption.citation || ''),
            description: String(exemption.description || ''),
            confidence: Number(exemption.confidence) || undefined,
            reasoning: String(exemption.reasoning || '') || undefined,
          };
        });
      }
      return [];
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

    const prompt = `You are a records management specialist helping to scope a public records request.

Analyze the following request and extract structured scope information to help staff locate responsive records.

Request description:
"${request.description}"

Respond in JSON format:
{
  "recordTypes": ["email", "contract", "invoice"],
  "suggestedCustodians": ["clerk-treasurer", "police-department"],
  "keywords": ["budget", "2024", "construction"],
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "confidence": 0.0-1.0
}

Only include fields where you have reasonable confidence. Use null for uncertain fields.`;

    const response = await this.aiCore.complete(ctx, prompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const parsed = JSON.parse(this.extractJson(response));
      return {
        recordTypes: Array.isArray(parsed.recordTypes)
          ? parsed.recordTypes.map(String)
          : undefined,
        suggestedCustodians: Array.isArray(parsed.suggestedCustodians)
          ? parsed.suggestedCustodians.map(String)
          : undefined,
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.map(String)
          : undefined,
        dateRange: parsed.dateRange && typeof parsed.dateRange === 'object'
          ? {
              start: parsed.dateRange.start ? String(parsed.dateRange.start) : undefined,
              end: parsed.dateRange.end ? String(parsed.dateRange.end) : undefined,
            }
          : undefined,
        confidence: Number(parsed.confidence) || undefined,
      };
    } catch {
      return { confidence: 0 };
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

    const [clarifications, exemptions, fulfillments] = await Promise.all([
      this.getClarifications(ctx, requestId),
      this.getExemptions(ctx, requestId),
      this.getFulfillments(ctx, requestId),
    ]);

    const contextParts = [
      `Request ID: ${request.id}`,
      `Requester: ${request.requesterName}`,
      `Status: ${request.status}`,
      `Description: "${request.description}"`,
      `Received: ${request.receivedAt}`,
      `Statutory Deadline: ${request.statutoryDeadlineAt || 'Not set'}`,
    ];

    if (exemptions.length > 0) {
      contextParts.push(`\nExemptions cited:\n${exemptions.map(e =>
        `- ${e.citation}: ${e.description}`
      ).join('\n')}`);
    }

    if (fulfillments.length > 0) {
      contextParts.push(`\nFulfillments:\n${fulfillments.map(f =>
        `- ${f.deliveryMethod} on ${f.fulfilledAt}${f.notes ? `: ${f.notes}` : ''}`
      ).join('\n')}`);
    }

    if (clarifications.length > 0) {
      contextParts.push(`\nClarifications:\n${clarifications.map(c =>
        `- Asked: ${c.messageToRequester}\n  Response: ${c.requesterResponse || 'Pending'}`
      ).join('\n')}`);
    }

    const prompt = `You are drafting a professional response letter for a public records request under Indiana's Access to Public Records Act (IC 5-14-3).

${contextParts.join('\n')}

Draft an appropriate response letter based on the current status:
- If FULFILLED: Thank requester, summarize what was provided
- If DENIED: Cite specific exemptions, explain appeal rights
- If PARTIALLY_FULFILLED: Explain what was provided and what was withheld (with exemptions)
- If NEEDS_CLARIFICATION: Ask clarifying questions
- If IN_REVIEW: Acknowledge receipt, provide timeline

The letter should:
- Be professional and courteous
- Cite relevant statute sections where appropriate
- Include appeal rights if any records are withheld
- Reference the 7-day response requirement under IC 5-14-3-9

Do not include placeholders like [YOUR NAME] - just end the letter appropriately.`;

    const letter = await this.aiCore.complete(ctx, prompt, {
      temperature: 0.5,
      maxTokens: 2000,
    });

    return letter.trim();
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

    // Update the request's particularity fields
    // Note: This modifies the in-memory object. A real implementation
    // would persist this to the database.
    request.reasonablyParticular = isParticular;
    request.particularityReason = reason;
    request.updatedAt = new Date().toISOString();

    return request;
  }

  // ---------- Helpers ----------

  /**
   * Extract JSON from a response that might have markdown code blocks.
   */
  private extractJson(text: string): string {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }
    // Otherwise assume the whole thing is JSON
    return text.trim();
  }
}
