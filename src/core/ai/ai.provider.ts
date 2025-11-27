// src/core/ai/ai.provider.ts
//
// Provider-agnostic interface for AI clients.
// Implementations wrap specific providers (OpenAI, Anthropic, etc.).

import { AiChatOptions, AiChatResponse, AiCompleteOptions } from './ai.service';

/**
 * Domain errors for AI operations.
 */
export type AiErrorCode =
  | 'AI_CHAT_FAILED'
  | 'AI_UNAVAILABLE'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_RESPONSE'
  | 'AI_CONTENT_FILTERED';

/**
 * Structured error for AI operations.
 */
export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Configuration for an AI provider.
 */
export interface AiProviderConfig {
  /** API key or other auth credential. */
  apiKey?: string;
  /** Base URL for the API (if overriding default). */
  baseUrl?: string;
  /** Default model to use if not specified per-request. */
  defaultModel?: string;
  /** Default temperature (0-2). */
  defaultTemperature?: number;
  /** Default max tokens. */
  defaultMaxTokens?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Maximum retry attempts on transient failures. */
  maxRetries?: number;
}

/**
 * Low-level provider client interface.
 *
 * Implementations should:
 * - Make raw API calls to the provider
 * - NOT handle retries (that's AiCoreServiceImpl's job)
 * - Translate provider-specific errors to AiError
 * - Return normalized AiChatResponse
 *
 * @example
 * const client = new OpenAiClient({ apiKey: process.env.OPENAI_API_KEY });
 * const response = await client.chat({
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   model: 'gpt-4'
 * });
 */
export interface AiProviderClient {
  /**
   * The provider name (e.g., 'openai', 'anthropic', 'mock').
   */
  readonly providerName: string;

  /**
   * Send a chat completion request to the provider.
   *
   * @throws {AiError} On any failure
   */
  chat(options: AiChatOptions): Promise<AiChatResponse>;

  /**
   * Simple single-shot completion.
   * Convenience wrapper that builds a chat request internally.
   *
   * @throws {AiError} On any failure
   */
  complete(prompt: string, options?: AiCompleteOptions): Promise<string>;
}

/**
 * Factory function type for creating provider clients.
 */
export type AiProviderFactory = (config: AiProviderConfig) => AiProviderClient;
