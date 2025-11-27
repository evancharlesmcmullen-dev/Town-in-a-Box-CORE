// src/core/ai/mock-ai.client.ts
//
// Mock AI client for testing.

import { AiChatOptions, AiChatResponse, AiCompleteOptions } from './ai.service';
import { AiProviderClient, AiError } from './ai.provider';

/**
 * Configured response for the mock client.
 */
export interface MockAiResponse {
  /** Content to return. */
  content?: string;
  /** Tool calls to return. */
  toolCalls?: AiChatResponse['toolCalls'];
  /** Error to throw instead of returning. */
  error?: AiError;
  /** Delay in ms before responding (simulates latency). */
  delayMs?: number;
}

/**
 * Mock AI client for testing.
 *
 * Can be configured to:
 * - Return specific responses
 * - Throw specific errors
 * - Simulate latency
 * - Track call history
 *
 * @example
 * const mock = new MockAiClient();
 * mock.setNextResponse({ content: 'Hello back!' });
 * const response = await mock.chat({ messages: [...] });
 * expect(mock.callHistory).toHaveLength(1);
 */
export class MockAiClient implements AiProviderClient {
  readonly providerName = 'mock';

  /** All chat() calls made to this client. */
  public chatCallHistory: AiChatOptions[] = [];

  /** All complete() calls made to this client. */
  public completeCallHistory: Array<{ prompt: string; options?: AiCompleteOptions }> = [];

  private responseQueue: MockAiResponse[] = [];
  private defaultResponse: MockAiResponse = { content: 'Mock response' };

  /**
   * Set the next response to return.
   * Responses are consumed in order (FIFO).
   */
  setNextResponse(response: MockAiResponse): void {
    this.responseQueue.push(response);
  }

  /**
   * Set multiple responses to return in sequence.
   */
  setResponses(responses: MockAiResponse[]): void {
    this.responseQueue.push(...responses);
  }

  /**
   * Set the default response when queue is empty.
   */
  setDefaultResponse(response: MockAiResponse): void {
    this.defaultResponse = response;
  }

  /**
   * Clear all state (responses, history).
   */
  reset(): void {
    this.responseQueue = [];
    this.chatCallHistory = [];
    this.completeCallHistory = [];
    this.defaultResponse = { content: 'Mock response' };
  }

  async chat(options: AiChatOptions): Promise<AiChatResponse> {
    this.chatCallHistory.push(options);

    const response = this.responseQueue.shift() ?? this.defaultResponse;

    if (response.delayMs) {
      await this.delay(response.delayMs);
    }

    if (response.error) {
      throw response.error;
    }

    return {
      content: response.content ?? '',
      toolCalls: response.toolCalls,
      finishReason: response.toolCalls ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: this.estimateTokens(options.messages.map((m) => m.content).join('')),
        completionTokens: this.estimateTokens(response.content ?? ''),
        totalTokens: 0, // Will be calculated
      },
    };
  }

  async complete(prompt: string, options?: AiCompleteOptions): Promise<string> {
    this.completeCallHistory.push({ prompt, options });

    const response = this.responseQueue.shift() ?? this.defaultResponse;

    if (response.delayMs) {
      await this.delay(response.delayMs);
    }

    if (response.error) {
      throw response.error;
    }

    return response.content ?? '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
