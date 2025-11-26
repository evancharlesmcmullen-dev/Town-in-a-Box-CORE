// src/core/ai/ai.service.ts
//
// Provider-agnostic AI service interfaces for Town-in-a-Box.
// All engines (meetings, APRA, planning, etc.) should use these contracts.

import { TenantContext } from '../tenancy/tenancy.types';
import { AiInteraction } from './ai.types';

// ===========================================================================
// CORE AI PRIMITIVES (provider-agnostic)
// ===========================================================================

/**
 * Role of a message in a conversation.
 */
export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A single message in a chat conversation.
 * Compatible with OpenAI, Anthropic, and other providers.
 */
export interface AiMessage {
  role: AiMessageRole;
  content: string;
  /** For tool/function messages: the name of the tool. */
  name?: string;
  /** For tool responses: the ID of the tool call being responded to. */
  toolCallId?: string;
}

/**
 * Definition of a tool/function the model can call.
 * @example
 * {
 *   name: 'getParcelInfo',
 *   description: 'Look up parcel details by ID',
 *   parameters: { type: 'object', properties: { parcelId: { type: 'string' } } }
 * }
 */
export interface AiToolDefinition {
  name: string;
  description: string;
  /** JSON Schema describing the tool's parameters. */
  parameters: Record<string, unknown>;
}

/**
 * A tool call requested by the model.
 */
export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Options for a chat completion request.
 */
export interface AiChatOptions {
  messages: AiMessage[];
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus'). Provider-specific. */
  model?: string;
  /** Sampling temperature (0-2). Lower = more deterministic. */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Tools/functions the model may call. */
  tools?: AiToolDefinition[];
  /** How the model should choose tools: 'auto', 'none', or force a specific tool. */
  toolChoice?: 'auto' | 'none' | { name: string };
}

/**
 * Response from a chat completion request.
 */
export interface AiChatResponse {
  /** The model's text response. */
  content: string;
  /** Tool calls the model wants to make (if any). */
  toolCalls?: AiToolCall[];
  /** Why the model stopped generating. */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  /** Token usage for billing/monitoring. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Raw provider response for debugging. */
  raw?: unknown;
}

/**
 * Options for a simple completion (single-shot prompt).
 */
export interface AiCompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ===========================================================================
// AI CORE SERVICE
// The primary interface for all AI interactions. Implementations wrap
// specific providers (OpenAI, Anthropic, local models, etc.).
// ===========================================================================

/**
 * Core AI service interface used by all engines.
 *
 * Implementations should:
 * - Handle rate limiting and retries
 * - Log usage for billing
 * - Respect tenant-specific model preferences if configured
 *
 * @example
 * const response = await aiCore.chat(ctx, {
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'What are the notice requirements for a BZA meeting?' }
 *   ]
 * });
 */
export interface AiCoreService {
  /**
   * Send a chat completion request.
   * Use this for multi-turn conversations or complex prompts.
   */
  chat(ctx: TenantContext, options: AiChatOptions): Promise<AiChatResponse>;

  /**
   * Simple single-shot completion.
   * Use this for quick, stateless prompts where you just need text back.
   *
   * @example
   * const summary = await aiCore.complete(ctx, 'Summarize: ' + longText);
   */
  complete(
    ctx: TenantContext,
    prompt: string,
    options?: AiCompleteOptions
  ): Promise<string>;
}

// ===========================================================================
// AI EXTRACTION SERVICE
// Structured extraction for meetings, APRA, planning, and other engines.
// ===========================================================================

/**
 * A deadline extracted from unstructured text.
 */
export interface ExtractedDeadline {
  /** Human-readable label (e.g., "Response deadline", "Appeal window closes"). */
  label: string;
  /** ISO 8601 date string (e.g., "2025-01-15"). */
  dueDate: string;
  /** Character offsets [start, end] in the source text where this was found. */
  sourceSpan?: [number, number];
  /** Model's confidence in this extraction (0-1). */
  confidence?: number;
}

/**
 * Classification of which module/domain a piece of text relates to.
 */
export interface MatterClassification {
  module: 'planning' | 'apra' | 'meetings' | 'records' | 'finance' | 'utilities' | 'other';
  /** Model's confidence in this classification (0-1). */
  confidence: number;
  /** Optional explanation of why this classification was chosen. */
  reasoning?: string;
}

/**
 * AI-powered structured extraction service.
 *
 * Use this for extracting specific data types from unstructured text:
 * - Deadlines from legal notices
 * - Document classification for routing
 * - Summaries for council packets
 */
export interface AiExtractionService {
  /**
   * Extract deadline information from unstructured text.
   *
   * @example
   * const deadlines = await aiExtract.extractDeadlines(ctx, noticeText);
   * // [{ label: "Public comment period ends", dueDate: "2025-02-01", confidence: 0.95 }]
   */
  extractDeadlines(
    ctx: TenantContext,
    text: string
  ): Promise<ExtractedDeadline[]>;

  /**
   * Classify what module/domain a piece of text relates to.
   * Useful for routing incoming documents or requests.
   */
  classifyMatter(
    ctx: TenantContext,
    text: string
  ): Promise<MatterClassification>;

  /**
   * Generate a summary suitable for council/board presentation.
   *
   * @param options.maxWords - Target word count for the summary.
   */
  summarizeForCouncil(
    ctx: TenantContext,
    text: string,
    options?: { maxWords?: number }
  ): Promise<string>;
}

// ===========================================================================
// LEGACY INTERFACES (deprecated)
// These are retained for backward compatibility only.
// New code should use AiCoreService and AiExtractionService.
// ===========================================================================

/**
 * High-level assistant for citizen/staff Q&A.
 *
 * @deprecated Use {@link AiCoreService} instead. This interface will be
 * removed in a future version. Migrate to `aiCore.chat()` or `aiCore.complete()`.
 */
export interface AiAssistantService {
  /**
   * Answer a question from a citizen.
   * @deprecated Use AiCoreService.complete() with appropriate system prompt.
   */
  askCitizen(ctx: TenantContext, question: string): Promise<string>;

  /**
   * Answer a question from staff.
   * @deprecated Use AiCoreService.complete() with appropriate system prompt.
   */
  askStaff(ctx: TenantContext, question: string): Promise<string>;
}

/**
 * Analytics and logging for AI interactions.
 *
 * @deprecated Use {@link AiExtractionService} for extraction tasks.
 * For interaction logging, integrate directly with your audit service.
 */
export interface AiInsightsService {
  /**
   * Record an AI interaction for analytics.
   * @deprecated Integrate with audit service directly.
   */
  recordInteraction(
    ctx: TenantContext,
    interaction: AiInteraction
  ): Promise<void>;

  /**
   * Get the top questions asked by users.
   * @deprecated Query your analytics database directly.
   */
  listTopQuestions(
    ctx: TenantContext,
    limit?: number
  ): Promise<{ question: string; count: number }[]>;
}
