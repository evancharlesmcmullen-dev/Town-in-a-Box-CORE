// src/core/ai/ai.bootstrap.ts
//
// Factory for wiring up the AI layer from environment config.

import { loadAiConfig, AiRuntimeConfig } from './ai.config';
import { AiCoreServiceImpl, AiCoreServiceConfig } from './ai-core.service.impl';
import { AiExtractionServiceImpl } from './ai-extraction.service.impl';
import { AiProviderClient, AiProviderConfig } from './ai.provider';
import { OpenAiClient } from './openai.client';
import { MockAiClient } from './mock-ai.client';
import { AiCoreService, AiExtractionService } from './ai.service';
import { MeetingsService } from '../../engines/meetings/meetings.service';
import { AiMeetingsServiceImpl } from '../../engines/meetings/ai-meetings.service.impl';

/**
 * Result of AI bootstrap containing all wired services.
 */
export interface AiBootstrap {
  /** The underlying provider client (OpenAI, mock, etc.). */
  providerClient: AiProviderClient;

  /** Core AI service with defaults, retries, and logging. */
  core: AiCoreService;

  /** Extraction service for deadlines, classification, summaries. */
  extraction: AiExtractionService;

  /**
   * Factory to wrap a MeetingsService with AI capabilities.
   * Call this with your base meetings service to get AI-enhanced version.
   */
  aiMeetingsService: (base: MeetingsService) => AiMeetingsServiceImpl;

  /** The runtime config used for this bootstrap. */
  config: AiRuntimeConfig;
}

/**
 * Create and wire up all AI services from environment config.
 *
 * @example
 * ```typescript
 * const ai = createAiBootstrap();
 *
 * // Use extraction service directly
 * const deadlines = await ai.extraction.extractDeadlines(ctx, text);
 *
 * // Wrap a meetings service with AI
 * const baseMeetings = new InMemoryMeetingsService();
 * const meetings = ai.aiMeetingsService(baseMeetings);
 * await meetings.generateCouncilSummary(ctx, meetingId, agendaText);
 * ```
 *
 * @throws {Error} If AI_API_KEY is missing and provider is not 'mock'
 */
export function createAiBootstrap(): AiBootstrap {
  const runtime = loadAiConfig();

  const providerConfig: AiProviderConfig = {
    apiKey: runtime.apiKey,
    baseUrl: runtime.baseUrl,
    defaultModel: runtime.defaultModel,
    defaultTemperature: runtime.defaultTemperature,
    defaultMaxTokens: runtime.defaultMaxTokens,
    timeoutMs: runtime.timeoutMs,
    maxRetries: runtime.maxRetries,
  };

  const coreConfig: AiCoreServiceConfig = {
    defaultModel: runtime.defaultModel,
    defaultTemperature: runtime.defaultTemperature,
    defaultMaxTokens: runtime.defaultMaxTokens,
    maxRetries: runtime.maxRetries,
    retryBaseDelayMs: runtime.retryBaseDelayMs,
    timeoutMs: runtime.timeoutMs,
  };

  // Create the appropriate provider client
  const providerClient: AiProviderClient =
    runtime.provider === 'mock'
      ? new MockAiClient()
      : new OpenAiClient(providerConfig);

  // Wire up the service layers
  const core = new AiCoreServiceImpl(providerClient, coreConfig);
  const extraction = new AiExtractionServiceImpl(core);

  return {
    providerClient,
    core,
    extraction,
    aiMeetingsService: (base: MeetingsService) =>
      new AiMeetingsServiceImpl(base, extraction),
    config: runtime,
  };
}

/**
 * Create AI bootstrap with explicit config (for testing or custom setups).
 *
 * @example
 * ```typescript
 * const ai = createAiBootstrapWithConfig({
 *   provider: 'mock',
 *   apiKey: '',
 *   defaultModel: 'test-model',
 *   // ... other config
 * });
 * ```
 */
export function createAiBootstrapWithConfig(
  runtime: AiRuntimeConfig
): AiBootstrap {
  const providerConfig: AiProviderConfig = {
    apiKey: runtime.apiKey,
    baseUrl: runtime.baseUrl,
    defaultModel: runtime.defaultModel,
    defaultTemperature: runtime.defaultTemperature,
    defaultMaxTokens: runtime.defaultMaxTokens,
    timeoutMs: runtime.timeoutMs,
    maxRetries: runtime.maxRetries,
  };

  const coreConfig: AiCoreServiceConfig = {
    defaultModel: runtime.defaultModel,
    defaultTemperature: runtime.defaultTemperature,
    defaultMaxTokens: runtime.defaultMaxTokens,
    maxRetries: runtime.maxRetries,
    retryBaseDelayMs: runtime.retryBaseDelayMs,
    timeoutMs: runtime.timeoutMs,
  };

  const providerClient: AiProviderClient =
    runtime.provider === 'mock'
      ? new MockAiClient()
      : new OpenAiClient(providerConfig);

  const core = new AiCoreServiceImpl(providerClient, coreConfig);
  const extraction = new AiExtractionServiceImpl(core);

  return {
    providerClient,
    core,
    extraction,
    aiMeetingsService: (base: MeetingsService) =>
      new AiMeetingsServiceImpl(base, extraction),
    config: runtime,
  };
}
