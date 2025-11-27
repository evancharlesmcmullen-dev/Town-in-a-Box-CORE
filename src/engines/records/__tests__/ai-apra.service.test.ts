// src/engines/records/__tests__/ai-apra.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiApraServiceImpl } from '../ai-apra.service.impl';
import { InMemoryApraService } from '../in-memory-apra.service';
import { TenantContext } from '../../../core/tenancy/tenancy.types';
import { AiCoreService, AiChatOptions, AiChatResponse } from '../../../core/ai/ai.service';

// Mock AI Core Service
class MockAiCoreService implements AiCoreService {
  public lastMessages: AiChatOptions['messages'] = [];
  public mockResponse: string = '{}';

  async chat(_ctx: TenantContext, options: AiChatOptions): Promise<AiChatResponse> {
    this.lastMessages = options.messages;
    return {
      content: this.mockResponse,
      finishReason: 'stop',
    };
  }

  async complete(_ctx: TenantContext, prompt: string): Promise<string> {
    return prompt;
  }
}

describe('AiApraServiceImpl', () => {
  let baseService: InMemoryApraService;
  let aiCore: MockAiCoreService;
  let service: AiApraServiceImpl;
  let ctx: TenantContext;

  beforeEach(() => {
    baseService = new InMemoryApraService();
    aiCore = new MockAiCoreService();
    service = new AiApraServiceImpl(baseService, aiCore);
    ctx = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      jurisdiction: {
        tenantId: 'test-tenant',
        state: 'IN',
        kind: 'town',
        name: 'Test Town',
        authorityTags: [],
      },
    };
  });

  describe('analyzeParticularity', () => {
    it('should return particularity analysis for a request', async () => {
      // Create a request
      const request = await service.createRequest(ctx, {
        requesterName: 'John Doe',
        requesterEmail: 'john@example.com',
        description: 'All emails from the Town Manager to the Police Chief regarding budget discussions from January 2024 to March 2024.',
      });

      // Mock AI response
      aiCore.mockResponse = JSON.stringify({
        isParticular: true,
        confidence: 0.85,
        reasoning: 'The request specifies the sender (Town Manager), recipient (Police Chief), subject matter (budget discussions), and a clear date range (Jan-Mar 2024).',
      });

      const analysis = await service.analyzeParticularity(ctx, request.id);

      expect(analysis.isParticular).toBe(true);
      expect(analysis.confidence).toBe(0.85);
      expect(analysis.reasoning).toContain('Town Manager');
    });

    it('should suggest clarifications for vague requests', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Jane Smith',
        description: 'All records about the new project.',
      });

      aiCore.mockResponse = JSON.stringify({
        isParticular: false,
        confidence: 0.9,
        reasoning: 'The request does not identify which project, what type of records, or a date range.',
        suggestedClarifications: [
          'Which specific project are you referring to?',
          'What types of records are you seeking (emails, contracts, meeting minutes)?',
          'What date range should we search?',
        ],
      });

      const analysis = await service.analyzeParticularity(ctx, request.id);

      expect(analysis.isParticular).toBe(false);
      expect(analysis.suggestedClarifications).toHaveLength(3);
      expect(analysis.suggestedClarifications?.[0]).toContain('project');
    });

    it('should handle invalid AI response gracefully', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Test request',
      });

      aiCore.mockResponse = 'This is not valid JSON';

      const analysis = await service.analyzeParticularity(ctx, request.id);

      expect(analysis.isParticular).toBe(true);
      expect(analysis.confidence).toBe(0.3);
      expect(analysis.reasoning).toContain('inconclusive');
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        service.analyzeParticularity(ctx, 'non-existent-id')
      ).rejects.toThrow('APRA request not found');
    });
  });

  describe('suggestExemptions', () => {
    it('should suggest exemptions based on request content', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Reporter Smith',
        description: 'Personnel files and performance reviews for all police officers from 2023.',
      });

      aiCore.mockResponse = JSON.stringify({
        exemptions: [
          {
            citation: 'IC 5-14-3-4(b)(6)',
            description: 'Personnel files of public employees except for basic information.',
            confidence: 0.85,
            reasoning: 'The request specifically asks for personnel files and performance reviews, which are discretionarily exempt.',
          },
          {
            citation: 'IC 5-14-3-4(b)(1)',
            description: 'Investigatory records of law enforcement agencies.',
            confidence: 0.4,
            reasoning: 'If any officers have ongoing investigations, those records would be exempt.',
          },
        ],
      });

      const suggestions = await service.suggestExemptions(ctx, request.id);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].citation).toBe('IC 5-14-3-4(b)(6)');
      expect(suggestions[0].confidence).toBe(0.85);
      expect(suggestions[1].citation).toBe('IC 5-14-3-4(b)(1)');
    });

    it('should return empty array when no exemptions apply', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Citizen',
        description: 'Meeting minutes from Town Council meetings in 2024.',
      });

      aiCore.mockResponse = JSON.stringify({ exemptions: [] });

      const suggestions = await service.suggestExemptions(ctx, request.id);

      expect(suggestions).toHaveLength(0);
    });

    it('should handle AI errors gracefully', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test',
        description: 'Test request',
      });

      aiCore.mockResponse = 'invalid json';

      const suggestions = await service.suggestExemptions(ctx, request.id);

      expect(suggestions).toEqual([]);
    });
  });

  describe('analyzeScope', () => {
    it('should extract scope details from request description', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Analyst',
        description: 'All contracts with ABC Construction Company from the Public Works Department between January 2023 and December 2023.',
      });

      aiCore.mockResponse = JSON.stringify({
        recordTypes: ['contracts'],
        suggestedCustodians: ['Public Works Department', 'Town Attorney'],
        keywords: ['ABC Construction', 'construction', 'contract'],
        dateRange: {
          start: '2023-01-01',
          end: '2023-12-31',
        },
        confidence: 0.9,
      });

      const scope = await service.analyzeScope(ctx, request.id);

      expect(scope.recordTypes).toContain('contracts');
      expect(scope.suggestedCustodians).toContain('Public Works Department');
      expect(scope.keywords).toContain('ABC Construction');
      expect(scope.dateRange?.start).toBe('2023-01-01');
      expect(scope.dateRange?.end).toBe('2023-12-31');
      expect(scope.confidence).toBe(0.9);
    });

    it('should handle requests without date ranges', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Citizen',
        description: 'Organizational chart for the town.',
      });

      aiCore.mockResponse = JSON.stringify({
        recordTypes: ['organizational chart', 'administrative document'],
        suggestedCustodians: ['Town Manager', 'HR Department'],
        keywords: ['organization', 'chart', 'structure'],
        dateRange: null,
        confidence: 0.8,
      });

      const scope = await service.analyzeScope(ctx, request.id);

      expect(scope.recordTypes).toContain('organizational chart');
      expect(scope.dateRange).toBeUndefined();
    });
  });

  describe('draftResponseLetter', () => {
    it('should draft a response letter for a request', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Jane Reporter',
        requesterEmail: 'jane@newspaper.com',
        description: 'Town Council meeting minutes for 2024.',
      });

      aiCore.mockResponse = `Dear Ms. Reporter,

Thank you for your request for Town Council meeting minutes for 2024, received on ${request.receivedAt}.

We are currently reviewing your request and expect to provide the requested records by the statutory deadline of ${request.statutoryDeadlineAt}.

If you have any questions, please contact our office.

Sincerely,
[Public Access Counselor]
[Town Name]`;

      const letter = await service.draftResponseLetter(ctx, request.id);

      expect(letter).toContain('Reporter');
      expect(letter).toContain('meeting minutes');
      expect(letter).toContain('statutory deadline');
    });

    it('should include exemptions in response letter when cited', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test User',
        description: 'Employee disciplinary records.',
      });

      // Add an exemption
      await service.addExemption(ctx, request.id, {
        citation: 'IC 5-14-3-4(b)(6)',
        description: 'Personnel files are discretionarily exempt.',
      });

      aiCore.mockResponse = `Dear Test User,

We have reviewed your request. Certain records are being withheld pursuant to the following exemption:

IC 5-14-3-4(b)(6): Personnel files of public employees except for basic information.

You have the right to appeal this determination to the Public Access Counselor.

Sincerely,
[Public Access Counselor]`;

      const letter = await service.draftResponseLetter(ctx, request.id);

      expect(letter).toContain('IC 5-14-3-4(b)(6)');
      expect(letter).toContain('withheld');
    });
  });

  describe('delegated methods', () => {
    it('should delegate createRequest to base service', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test',
        description: 'Test',
      });

      expect(request.id).toBeDefined();
      expect(request.status).toBe('RECEIVED');
    });

    it('should delegate getRequest to base service', async () => {
      const created = await service.createRequest(ctx, {
        requesterName: 'Test',
        description: 'Test',
      });

      const fetched = await service.getRequest(ctx, created.id);
      expect(fetched?.id).toBe(created.id);
    });

    it('should delegate listRequests to base service', async () => {
      await service.createRequest(ctx, {
        requesterName: 'Test 1',
        description: 'Test 1',
      });
      await service.createRequest(ctx, {
        requesterName: 'Test 2',
        description: 'Test 2',
      });

      const list = await service.listRequests(ctx);
      expect(list).toHaveLength(2);
    });

    it('should delegate updateStatus to base service', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test',
        description: 'Test',
      });

      const updated = await service.updateStatus(ctx, request.id, 'IN_REVIEW');
      expect(updated.status).toBe('IN_REVIEW');
    });
  });

  describe('reviewParticularity', () => {
    it('should accept human review of particularity', async () => {
      const request = await service.createRequest(ctx, {
        requesterName: 'Test',
        description: 'Vague request',
      });

      const reviewed = await service.reviewParticularity(
        ctx,
        request.id,
        false,
        'Request is too vague - needs date range'
      );

      expect(reviewed).toBeDefined();
      expect(reviewed.id).toBe(request.id);
    });
  });
});
