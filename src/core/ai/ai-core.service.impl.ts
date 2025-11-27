// src/core/ai/ai-core.service.impl.ts
//
// Production implementation of AiCoreService with retries, defaults, and error handling.

import { TenantContext } from '../tenancy/tenancy.types';
import {
  AiCoreService,
  AiChatOptions,
  AiChatResponse,
  AiCompleteOptions,
} from './ai.service';
import { AiProviderClient, AiProviderConfig, AiError } from './ai.provider';

/**
 * Configuration for AiCoreServiceImpl.
 */
export interface AiCoreServiceConfig {
  /** Default model if not specified per-request. */
  defaultModel: string;
  /** Default temperature (0-2). */
  defaultTemperature?: number;
  /** Default max tokens. */
  defaultMaxTokens?: number;
  /** Maximum retry attempts on transient failures. */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms. */
  retryBaseDelayMs?: number;
  /** Request timeout in ms. */
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<AiCoreServiceConfig> = {
  defaultModel: 'gpt-4',
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  timeoutMs: 30000,
};

/**
 * Production implementation of AiCoreService.
 *
 * Features:
 * - Applies default model, temperature, maxTokens
 * - Retries transient failures with exponential backoff
 * - Wraps provider errors in domain errors
 * - Logs usage (non-PII) with ISO timestamps
 *
 * @example
 * const service = new AiCoreServiceImpl(openAiClient, {
 *   defaultModel: 'gpt-4-turbo',
 *   maxRetries: 3,
 * });
 */
export class AiCoreServiceImpl implements AiCoreService {
  private readonly config: Required<AiCoreServiceConfig>;

  constructor(
    private readonly client: AiProviderClient,
    config: Partial<AiCoreServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async chat(ctx: TenantContext, options: AiChatOptions): Promise<AiChatResponse> {
    const startTime = new Date().toISOString();
    const requestId = this.generateRequestId();

    // Apply defaults
    const effectiveOptions: AiChatOptions = {
      ...options,
      model: options.model ?? this.config.defaultModel,
      temperature: options.temperature ?? this.config.defaultTemperature,
      maxTokens: options.maxTokens ?? this.config.defaultMaxTokens,
    };

    let lastError: AiError | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateBackoff(attempt);
          await this.delay(delay);
          this.logRetry(requestId, ctx.tenantId, attempt, delay);
        }

        const response = await this.executeWithTimeout(
          () => this.client.chat(effectiveOptions),
          this.config.timeoutMs
        );

        this.logSuccess(requestId, ctx.tenantId, startTime, response);
        return response;
      } catch (err) {
        lastError = this.wrapError(err);

        // Don't retry on non-transient errors
        if (!this.isTransient(lastError)) {
          this.logFailure(requestId, ctx.tenantId, startTime, lastError);
          throw lastError;
        }
      }
    }

    // All retries exhausted
    this.logFailure(requestId, ctx.tenantId, startTime, lastError!);
    throw lastError!;
  }

  async complete(
    ctx: TenantContext,
    prompt: string,
    options?: AiCompleteOptions
  ): Promise<string> {
    const response = await this.chat(ctx, {
      messages: [{ role: 'user', content: prompt }],
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return response.content;
  }

  /**
   * Execute a function with a timeout.
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new AiError('AI_TIMEOUT', `Request timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * baseDelay;
    return Math.min(baseDelay + jitter, 30000); // Cap at 30s
  }

  /**
   * Check if an error is transient (retryable).
   */
  private isTransient(error: AiError): boolean {
    return (
      error.code === 'AI_UNAVAILABLE' ||
      error.code === 'AI_RATE_LIMITED' ||
      error.code === 'AI_TIMEOUT'
    );
  }

  /**
   * Wrap any error in an AiError.
   */
  private wrapError(err: unknown): AiError {
    if (err instanceof AiError) {
      return err;
    }

    const message = err instanceof Error ? err.message : String(err);
    return new AiError('AI_CHAT_FAILED', message, err);
  }

  /**
   * Generate a unique request ID for logging.
   */
  private generateRequestId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Logging methods (minimal, non-PII)

  private logRetry(requestId: string, tenantId: string, attempt: number, delayMs: number): void {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'ai_retry',
        requestId,
        tenantId,
        attempt,
        delayMs,
        provider: this.client.providerName,
      })
    );
  }

  private logSuccess(
    requestId: string,
    tenantId: string,
    startTime: string,
    response: AiChatResponse
  ): void {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'ai_success',
        requestId,
        tenantId,
        startTime,
        provider: this.client.providerName,
        usage: response.usage,
        finishReason: response.finishReason,
      })
    );
  }

  private logFailure(
    requestId: string,
    tenantId: string,
    startTime: string,
    error: AiError
  ): void {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'ai_failure',
        requestId,
        tenantId,
        startTime,
        provider: this.client.providerName,
        errorCode: error.code,
        errorMessage: error.message,
      })
    );
  }
}
