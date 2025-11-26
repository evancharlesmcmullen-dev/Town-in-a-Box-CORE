// src/core/ai/ai.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockAiClient } from './mock-ai.client';
import { AiCoreServiceImpl } from './ai-core.service.impl';
import { AiExtractionServiceImpl } from './ai-extraction.service.impl';
import { AiError } from './ai.provider';
import { TenantContext } from '../tenancy/tenancy.types';

// Test fixture for TenantContext
const createTestContext = (): TenantContext => ({
  tenantId: 'test-tenant',
  userId: 'test-user',
  jurisdiction: {
    tenantId: 'test-tenant',
    state: 'IN',
    kind: 'town',
    name: 'Test Town',
    authorityTags: ['zoningAuthority'],
  },
});

describe('MockAiClient', () => {
  let client: MockAiClient;

  beforeEach(() => {
    client = new MockAiClient();
  });

  it('should return configured response', async () => {
    client.setNextResponse({ content: 'Hello from AI!' });

    const response = await client.chat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.content).toBe('Hello from AI!');
    expect(client.chatCallHistory).toHaveLength(1);
  });

  it('should throw configured error', async () => {
    const error = new AiError('AI_RATE_LIMITED', 'Too many requests');
    client.setNextResponse({ error });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow('Too many requests');
  });

  it('should consume responses in FIFO order', async () => {
    client.setResponses([
      { content: 'First' },
      { content: 'Second' },
      { content: 'Third' },
    ]);

    const r1 = await client.complete('1');
    const r2 = await client.complete('2');
    const r3 = await client.complete('3');

    expect(r1).toBe('First');
    expect(r2).toBe('Second');
    expect(r3).toBe('Third');
  });
});

describe('AiCoreServiceImpl', () => {
  let client: MockAiClient;
  let service: AiCoreServiceImpl;
  let ctx: TenantContext;

  beforeEach(() => {
    client = new MockAiClient();
    service = new AiCoreServiceImpl(client, {
      defaultModel: 'test-model',
      defaultTemperature: 0.5,
      maxRetries: 2,
      retryBaseDelayMs: 10, // Fast retries for tests
      timeoutMs: 1000,
    });
    ctx = createTestContext();

    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should apply default options', async () => {
    client.setNextResponse({ content: 'OK' });

    await service.chat(ctx, {
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(client.chatCallHistory[0].model).toBe('test-model');
    expect(client.chatCallHistory[0].temperature).toBe(0.5);
  });

  it('should allow overriding defaults', async () => {
    client.setNextResponse({ content: 'OK' });

    await service.chat(ctx, {
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'custom-model',
      temperature: 0.9,
    });

    expect(client.chatCallHistory[0].model).toBe('custom-model');
    expect(client.chatCallHistory[0].temperature).toBe(0.9);
  });

  it('should retry on transient errors', async () => {
    client.setResponses([
      { error: new AiError('AI_RATE_LIMITED', 'Rate limited') },
      { error: new AiError('AI_UNAVAILABLE', 'Service unavailable') },
      { content: 'Success after retries' },
    ]);

    const response = await service.chat(ctx, {
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.content).toBe('Success after retries');
    expect(client.chatCallHistory).toHaveLength(3);
  });

  it('should not retry on non-transient errors', async () => {
    client.setNextResponse({
      error: new AiError('AI_CONTENT_FILTERED', 'Content filtered'),
    });

    await expect(
      service.chat(ctx, { messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow('Content filtered');

    // Should only try once
    expect(client.chatCallHistory).toHaveLength(1);
  });

  it('should throw after max retries exhausted', async () => {
    // With maxRetries=2, we get 3 total attempts (initial + 2 retries)
    client.setResponses([
      { error: new AiError('AI_UNAVAILABLE', 'Fail 1') },
      { error: new AiError('AI_UNAVAILABLE', 'Fail 2') },
      { error: new AiError('AI_UNAVAILABLE', 'Fail 3') },
    ]);

    await expect(
      service.chat(ctx, { messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow('Fail 3');

    expect(client.chatCallHistory).toHaveLength(3);
  });

  it('complete() should return just the content string', async () => {
    client.setNextResponse({ content: 'The answer is 42' });

    const result = await service.complete(ctx, 'What is the meaning of life?');

    expect(result).toBe('The answer is 42');
  });
});

describe('AiExtractionServiceImpl', () => {
  let client: MockAiClient;
  let coreService: AiCoreServiceImpl;
  let extractionService: AiExtractionServiceImpl;
  let ctx: TenantContext;

  beforeEach(() => {
    client = new MockAiClient();
    coreService = new AiCoreServiceImpl(client, {
      defaultModel: 'test-model',
      maxRetries: 0, // No retries for extraction tests
      timeoutMs: 1000,
    });
    extractionService = new AiExtractionServiceImpl(coreService);
    ctx = createTestContext();

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('extractDeadlines', () => {
    it('should parse valid JSON array of deadlines', async () => {
      client.setNextResponse({
        content: JSON.stringify([
          { label: 'Comment period ends', dueDate: '2025-02-15', confidence: 0.95 },
          { label: 'Appeal deadline', dueDate: '2025-03-01', confidence: 0.8 },
        ]),
      });

      const deadlines = await extractionService.extractDeadlines(
        ctx,
        'Some text with deadlines'
      );

      expect(deadlines).toHaveLength(2);
      expect(deadlines[0].label).toBe('Comment period ends');
      expect(deadlines[0].dueDate).toBe('2025-02-15');
      expect(deadlines[0].confidence).toBe(0.95);
    });

    it('should handle markdown-wrapped JSON', async () => {
      client.setNextResponse({
        content: '```json\n[{"label": "Due", "dueDate": "2025-01-01"}]\n```',
      });

      const deadlines = await extractionService.extractDeadlines(ctx, 'text');

      expect(deadlines).toHaveLength(1);
      expect(deadlines[0].label).toBe('Due');
    });

    it('should return empty array for no deadlines', async () => {
      client.setNextResponse({ content: '[]' });

      const deadlines = await extractionService.extractDeadlines(ctx, 'no deadlines here');

      expect(deadlines).toHaveLength(0);
    });

    it('should throw on invalid JSON', async () => {
      client.setNextResponse({ content: 'This is not JSON' });

      await expect(
        extractionService.extractDeadlines(ctx, 'text')
      ).rejects.toThrow('Failed to parse JSON array');
    });

    it('should throw on missing required fields', async () => {
      client.setNextResponse({
        content: JSON.stringify([{ label: 'Missing date' }]),
      });

      await expect(
        extractionService.extractDeadlines(ctx, 'text')
      ).rejects.toThrow('missing or invalid dueDate');
    });

    it('should throw on invalid date format', async () => {
      client.setNextResponse({
        content: JSON.stringify([{ label: 'Bad date', dueDate: 'not-a-date' }]),
      });

      await expect(
        extractionService.extractDeadlines(ctx, 'text')
      ).rejects.toThrow('invalid dueDate');
    });
  });

  describe('classifyMatter', () => {
    it('should parse valid classification', async () => {
      client.setNextResponse({
        content: JSON.stringify({
          module: 'planning',
          confidence: 0.92,
          reasoning: 'Discusses variance request',
        }),
      });

      const result = await extractionService.classifyMatter(ctx, 'Variance request text');

      expect(result.module).toBe('planning');
      expect(result.confidence).toBe(0.92);
      expect(result.reasoning).toBe('Discusses variance request');
    });

    it('should throw on invalid module', async () => {
      client.setNextResponse({
        content: JSON.stringify({ module: 'invalid_module', confidence: 0.5 }),
      });

      await expect(
        extractionService.classifyMatter(ctx, 'text')
      ).rejects.toThrow('Invalid module');
    });

    it('should throw on missing confidence', async () => {
      client.setNextResponse({
        content: JSON.stringify({ module: 'planning' }),
      });

      await expect(
        extractionService.classifyMatter(ctx, 'text')
      ).rejects.toThrow('Missing or invalid confidence');
    });
  });

  describe('summarizeForCouncil', () => {
    it('should return trimmed summary', async () => {
      client.setNextResponse({
        content: '  This is a summary of the meeting.  ',
      });

      const summary = await extractionService.summarizeForCouncil(
        ctx,
        'Long meeting text'
      );

      expect(summary).toBe('This is a summary of the meeting.');
    });

    it('should use specified maxWords', async () => {
      client.setNextResponse({ content: 'Short summary' });

      await extractionService.summarizeForCouncil(ctx, 'text', { maxWords: 50 });

      // Check that the prompt included the word count
      const lastCall = client.chatCallHistory[0];
      expect(lastCall.messages[1].content).toContain('50 words');
    });
  });
});
