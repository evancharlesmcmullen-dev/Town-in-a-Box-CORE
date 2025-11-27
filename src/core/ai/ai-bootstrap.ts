// src/core/ai/ai-bootstrap.ts

import {
  AiMeetingsService,
  AiMeetingsServiceImpl,
  AiMeetingsProvider,
  MockAiMeetingsProvider,
} from '../../engines/meetings/ai-meetings.service';
import { MeetingsService } from '../../engines/meetings/meetings.service';

/**
 * AI bootstrap configuration.
 */
export interface AiBootstrapConfig {
  provider?: 'mock' | 'openai' | 'anthropic';
}

/**
 * AI bootstrap result containing AI-enhanced services.
 */
export interface AiBootstrap {
  /**
   * Wrap a base MeetingsService with AI capabilities.
   */
  aiMeetingsService(base: MeetingsService): AiMeetingsService;
}

/**
 * Create an AI bootstrap with the specified configuration.
 *
 * Uses AI_PROVIDER env var or defaults to 'mock'.
 * In dev mode, this uses mock AI that returns canned responses.
 */
export function createAiBootstrap(config: AiBootstrapConfig = {}): AiBootstrap {
  const provider = config.provider ?? (process.env.AI_PROVIDER as 'mock' | 'openai' | 'anthropic') ?? 'mock';

  let aiMeetingsProvider: AiMeetingsProvider;

  switch (provider) {
    case 'mock':
    default:
      aiMeetingsProvider = new MockAiMeetingsProvider();
      break;
    // Future: add 'openai' and 'anthropic' cases here
  }

  return {
    aiMeetingsService(base: MeetingsService): AiMeetingsService {
      return new AiMeetingsServiceImpl(base, aiMeetingsProvider);
    },
  };
}
