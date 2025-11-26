// src/core/ai/ai.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { AiInteraction } from './ai.types';

// ---------------------------------------------------------------------------
// Core AI primitives (provider-agnostic)
// ---------------------------------------------------------------------------

export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
  name?: string;        // for tool messages
  toolCallId?: string;  // for tool responses
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiChatOptions {
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AiToolDefinition[];
  toolChoice?: 'auto' | 'none' | { name: string };
}

export interface AiChatResponse {
  content: string;
  toolCalls?: AiToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: unknown; // provider-specific response for debugging
}

export interface AiCompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Core AI Service (low-level, used by all engines)
// ---------------------------------------------------------------------------

export interface AiCoreService {
  /**
   * Generic chat/completion call used by all engines.
   */
  chat(ctx: TenantContext, options: AiChatOptions): Promise<AiChatResponse>;

  /**
   * Cheaper helper for short, single-shot prompts.
   */
  complete(
    ctx: TenantContext,
    prompt: string,
    options?: AiCompleteOptions
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// Structured extraction service (used by meetings, APRA, planning, etc.)
// ---------------------------------------------------------------------------

export interface ExtractedDeadline {
  label: string;
  dueDate: string;           // ISO date string
  sourceSpan?: [number, number]; // character offsets in source text
  confidence?: number;
}

export interface MatterClassification {
  module: 'planning' | 'apra' | 'meetings' | 'records' | 'finance' | 'utilities' | 'other';
  confidence: number;
  reasoning?: string;
}

export interface AiExtractionService {
  /**
   * Extract deadline information from unstructured text.
   */
  extractDeadlines(
    ctx: TenantContext,
    text: string
  ): Promise<ExtractedDeadline[]>;

  /**
   * Classify what module/domain a piece of text relates to.
   */
  classifyMatter(
    ctx: TenantContext,
    text: string
  ): Promise<MatterClassification>;

  /**
   * Summarize text for council/board presentation.
   */
  summarizeForCouncil(
    ctx: TenantContext,
    text: string,
    options?: { maxWords?: number }
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// High-level assistant service (citizen/staff facing)
// ---------------------------------------------------------------------------

export interface AiAssistantService {
  /**
   * Answer a question from a citizen.
   */
  askCitizen(ctx: TenantContext, question: string): Promise<string>;

  /**
   * Answer a question from staff.
   */
  askStaff(ctx: TenantContext, question: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Insights & analytics service
// ---------------------------------------------------------------------------

export interface AiInsightsService {
  /**
   * Record an AI interaction for analytics.
   */
  recordInteraction(
    ctx: TenantContext,
    interaction: AiInteraction
  ): Promise<void>;

  /**
   * Get the top questions asked by users.
   */
  listTopQuestions(
    ctx: TenantContext,
    limit?: number
  ): Promise<{ question: string; count: number }[]>;
}
