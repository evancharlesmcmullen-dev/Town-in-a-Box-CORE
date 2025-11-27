// src/core/ai/ai.config.ts
//
// Environment-based configuration for the AI layer.

export type AiProviderName = 'openai' | 'mock';

export interface AiRuntimeConfig {
  provider: AiProviderName;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
}

/**
 * Load AI config from environment variables.
 * Throws if required values are missing in production.
 *
 * Environment variables:
 * - AI_PROVIDER: 'openai' | 'mock' (default: 'openai')
 * - AI_API_KEY: API key for the provider (required unless mock)
 * - AI_BASE_URL: Override base URL for the API
 * - AI_DEFAULT_MODEL: Default model to use (default: 'gpt-4.1-mini')
 * - AI_DEFAULT_TEMPERATURE: Default temperature 0-2 (default: 0.2)
 * - AI_DEFAULT_MAX_TOKENS: Default max tokens (default: 1024)
 * - AI_TIMEOUT_MS: Request timeout in ms (default: 120000)
 * - AI_MAX_RETRIES: Max retry attempts (default: 2)
 * - AI_RETRY_BASE_DELAY_MS: Base delay for exponential backoff (default: 250)
 */
export function loadAiConfig(): AiRuntimeConfig {
  const provider = (process.env.AI_PROVIDER ?? 'openai') as AiProviderName;
  const apiKey = process.env.AI_API_KEY ?? '';

  if (!apiKey && provider !== 'mock') {
    throw new Error('AI_API_KEY is required when AI_PROVIDER is not "mock"');
  }

  return {
    provider,
    apiKey,
    baseUrl: process.env.AI_BASE_URL || undefined,
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini',
    defaultTemperature: Number(process.env.AI_DEFAULT_TEMPERATURE ?? '0.2'),
    defaultMaxTokens: Number(process.env.AI_DEFAULT_MAX_TOKENS ?? '1024'),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? '120000'),
    maxRetries: Number(process.env.AI_MAX_RETRIES ?? '2'),
    retryBaseDelayMs: Number(process.env.AI_RETRY_BASE_DELAY_MS ?? '250'),
  };
}
