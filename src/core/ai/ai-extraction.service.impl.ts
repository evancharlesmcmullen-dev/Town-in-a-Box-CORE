// src/core/ai/ai-extraction.service.impl.ts
//
// Implementation of AiExtractionService with strict JSON parsing and validation.

import { TenantContext } from '../tenancy/tenancy.types';
import {
  AiCoreService,
  AiExtractionService,
  ExtractedDeadline,
  MatterClassification,
} from './ai.service';
import { AiError } from './ai.provider';

/**
 * Error thrown when AI response fails validation.
 */
export class AiValidationError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
    public readonly parseError?: unknown
  ) {
    super(message);
    this.name = 'AiValidationError';
  }
}

/**
 * Implementation of AiExtractionService.
 *
 * Uses AiCoreService for chat completions, then parses and validates
 * JSON responses. Throws clear errors on parsing/validation failures.
 */
export class AiExtractionServiceImpl implements AiExtractionService {
  constructor(private readonly aiCore: AiCoreService) {}

  async extractDeadlines(
    ctx: TenantContext,
    text: string
  ): Promise<ExtractedDeadline[]> {
    const prompt = this.buildDeadlineExtractionPrompt(text);

    const response = await this.aiCore.chat(ctx, {
      messages: [
        {
          role: 'system',
          content: `You are a deadline extraction assistant. Extract all deadlines, due dates, and time-sensitive requirements from the provided text. Return ONLY a JSON array with no additional text or markdown.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
    });

    const parsed = this.parseJsonArray<RawDeadline>(response.content, 'deadlines');
    return this.validateDeadlines(parsed);
  }

  async classifyMatter(
    ctx: TenantContext,
    text: string
  ): Promise<MatterClassification> {
    const prompt = this.buildClassificationPrompt(text);

    const response = await this.aiCore.chat(ctx, {
      messages: [
        {
          role: 'system',
          content: `You are a document classification assistant for local government. Classify the provided text into one of these categories: planning, apra, meetings, records, finance, utilities, other. Return ONLY a JSON object with no additional text or markdown.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    });

    const parsed = this.parseJsonObject<RawClassification>(response.content, 'classification');
    return this.validateClassification(parsed);
  }

  async summarizeForCouncil(
    ctx: TenantContext,
    text: string,
    options?: { maxWords?: number }
  ): Promise<string> {
    const maxWords = options?.maxWords ?? 150;

    const response = await this.aiCore.chat(ctx, {
      messages: [
        {
          role: 'system',
          content: `You are a municipal clerk assistant. Write clear, professional summaries suitable for council/board packets. Be concise and focus on key facts, decisions needed, and implications.`,
        },
        {
          role: 'user',
          content: `Summarize the following in approximately ${maxWords} words or less. Write in a professional tone suitable for a council agenda packet:\n\n${text}`,
        },
      ],
      temperature: 0.3,
    });

    return response.content.trim();
  }

  // ---------- Prompt Builders ----------

  private buildDeadlineExtractionPrompt(text: string): string {
    return `Extract all deadlines from this text and return as a JSON array.

Each deadline should have:
- "label": brief description (e.g., "Public comment period ends")
- "dueDate": ISO 8601 date string (YYYY-MM-DD)
- "confidence": number 0-1 indicating extraction confidence

Example output:
[
  {"label": "Response deadline", "dueDate": "2025-02-15", "confidence": 0.95},
  {"label": "Appeal window closes", "dueDate": "2025-03-01", "confidence": 0.85}
]

If no deadlines are found, return an empty array: []

Text to analyze:
${text}`;
  }

  private buildClassificationPrompt(text: string): string {
    return `Classify this document into one of these categories:
- planning: zoning, subdivisions, BZA, plan commission matters
- apra: public records requests (Access to Public Records Act)
- meetings: agendas, minutes, public meetings
- records: general document management, archives
- finance: budgets, fees, payments, tax-related
- utilities: water, sewer, electric service
- other: anything that doesn't fit above

Return a JSON object with:
- "module": one of the categories above
- "confidence": number 0-1
- "reasoning": brief explanation (optional)

Example output:
{"module": "planning", "confidence": 0.92, "reasoning": "Document discusses variance request and BZA hearing"}

Text to classify:
${text}`;
  }

  // ---------- JSON Parsing ----------

  private parseJsonArray<T>(raw: string, context: string): T[] {
    const cleaned = this.extractJson(raw);

    try {
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new AiValidationError(
          `Expected JSON array for ${context}, got ${typeof parsed}`,
          raw
        );
      }

      return parsed as T[];
    } catch (err) {
      if (err instanceof AiValidationError) throw err;

      throw new AiValidationError(
        `Failed to parse JSON array for ${context}`,
        raw,
        err
      );
    }
  }

  private parseJsonObject<T>(raw: string, context: string): T {
    const cleaned = this.extractJson(raw);

    try {
      const parsed = JSON.parse(cleaned);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new AiValidationError(
          `Expected JSON object for ${context}, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`,
          raw
        );
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof AiValidationError) throw err;

      throw new AiValidationError(
        `Failed to parse JSON object for ${context}`,
        raw,
        err
      );
    }
  }

  /**
   * Extract JSON from potentially markdown-wrapped response.
   */
  private extractJson(raw: string): string {
    let content = raw.trim();

    // Remove markdown code blocks if present
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      content = jsonBlockMatch[1].trim();
    }

    return content;
  }

  // ---------- Validation ----------

  private validateDeadlines(raw: RawDeadline[]): ExtractedDeadline[] {
    return raw.map((item, index) => {
      // Validate required fields
      if (typeof item.label !== 'string' || !item.label) {
        throw new AiValidationError(
          `Deadline ${index}: missing or invalid label`,
          JSON.stringify(raw)
        );
      }

      if (typeof item.dueDate !== 'string' || !this.isValidDateString(item.dueDate)) {
        throw new AiValidationError(
          `Deadline ${index}: missing or invalid dueDate (expected YYYY-MM-DD)`,
          JSON.stringify(raw)
        );
      }

      const deadline: ExtractedDeadline = {
        label: item.label,
        dueDate: item.dueDate,
      };

      // Optional fields
      if (typeof item.confidence === 'number') {
        deadline.confidence = Math.max(0, Math.min(1, item.confidence));
      }

      if (Array.isArray(item.sourceSpan) && item.sourceSpan.length === 2) {
        deadline.sourceSpan = [item.sourceSpan[0], item.sourceSpan[1]];
      }

      return deadline;
    });
  }

  private validateClassification(raw: RawClassification): MatterClassification {
    const validModules = [
      'planning',
      'apra',
      'meetings',
      'records',
      'finance',
      'utilities',
      'other',
    ] as const;

    if (!raw.module || !validModules.includes(raw.module as any)) {
      throw new AiValidationError(
        `Invalid module: ${raw.module}. Expected one of: ${validModules.join(', ')}`,
        JSON.stringify(raw)
      );
    }

    if (typeof raw.confidence !== 'number') {
      throw new AiValidationError(
        `Missing or invalid confidence score`,
        JSON.stringify(raw)
      );
    }

    return {
      module: raw.module as MatterClassification['module'],
      confidence: Math.max(0, Math.min(1, raw.confidence)),
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
    };
  }

  private isValidDateString(str: string): boolean {
    // Check YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return false;
    }

    const date = new Date(str);
    return !isNaN(date.getTime());
  }
}

// ---------- Raw Types (before validation) ----------

interface RawDeadline {
  label?: string;
  dueDate?: string;
  confidence?: number;
  sourceSpan?: [number, number];
}

interface RawClassification {
  module?: string;
  confidence?: number;
  reasoning?: string;
}
