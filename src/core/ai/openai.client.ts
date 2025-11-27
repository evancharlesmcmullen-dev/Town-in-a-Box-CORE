// src/core/ai/openai.client.ts
//
// OpenAI implementation of AiProviderClient.

import { AiProviderClient, AiProviderConfig, AiError } from './ai.provider';
import {
  AiChatOptions,
  AiChatResponse,
  AiCompleteOptions,
  AiMessage,
  AiToolCall,
  AiToolDefinition,
} from './ai.service';

/**
 * OpenAI API client implementing AiProviderClient.
 *
 * Uses the native fetch API (Node 18+).
 * Maps OpenAI-specific responses to the provider-agnostic interface.
 */
export class OpenAiClient implements AiProviderClient {
  readonly providerName = 'openai';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(cfg: AiProviderConfig) {
    if (!cfg.apiKey) {
      throw new Error('OpenAiClient requires apiKey');
    }

    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl ?? 'https://api.openai.com/v1/chat/completions';
    this.defaultModel = cfg.defaultModel ?? 'gpt-4.1-mini';
    this.defaultTemperature = cfg.defaultTemperature ?? 0.2;
    this.defaultMaxTokens = cfg.defaultMaxTokens ?? 1024;
  }

  async chat(options: AiChatOptions): Promise<AiChatResponse> {
    const model = options.model ?? this.defaultModel;

    const body: OpenAiRequestBody = {
      model,
      messages: this.mapMessages(options.messages),
      temperature: options.temperature ?? this.defaultTemperature,
      max_tokens: options.maxTokens ?? this.defaultMaxTokens,
    };

    // Add tools if provided
    if (options.tools && options.tools.length > 0) {
      body.tools = this.mapTools(options.tools);
      if (options.toolChoice) {
        body.tool_choice = this.mapToolChoice(options.toolChoice);
      }
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        await this.handleErrorResponse(res);
      }

      const data = (await res.json()) as OpenAiResponse;
      return this.mapResponse(data);
    } catch (err: unknown) {
      if (err instanceof AiError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AiError('AI_CHAT_FAILED', `OpenAI chat failed: ${message}`, err);
    }
  }

  async complete(prompt: string, options?: AiCompleteOptions): Promise<string> {
    const res = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
    return res.content;
  }

  // ---------- Request Mapping ----------

  private mapMessages(messages: AiMessage[]): OpenAiMessage[] {
    return messages.map((m) => {
      const mapped: OpenAiMessage = {
        role: m.role as OpenAiRole,
        content: m.content,
      };

      if (m.name) {
        mapped.name = m.name;
      }

      if (m.toolCallId) {
        mapped.tool_call_id = m.toolCallId;
      }

      return mapped;
    });
  }

  private mapTools(tools: AiToolDefinition[]): OpenAiTool[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  private mapToolChoice(
    choice: AiChatOptions['toolChoice']
  ): OpenAiToolChoice {
    if (choice === 'auto' || choice === 'none') {
      return choice;
    }
    if (typeof choice === 'object' && choice.name) {
      return { type: 'function', function: { name: choice.name } };
    }
    return 'auto';
  }

  // ---------- Response Mapping ----------

  private mapResponse(data: OpenAiResponse): AiChatResponse {
    const choice = data.choices?.[0];

    const content = choice?.message?.content ?? '';

    // Map tool calls if present
    let toolCalls: AiToolCall[] | undefined;
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      toolCalls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.parseToolArguments(tc.function.arguments),
      }));
    }

    // Map finish reason
    let finishReason: AiChatResponse['finishReason'];
    switch (choice?.finish_reason) {
      case 'stop':
        finishReason = 'stop';
        break;
      case 'tool_calls':
        finishReason = 'tool_calls';
        break;
      case 'length':
        finishReason = 'length';
        break;
      case 'content_filter':
        finishReason = 'content_filter';
        break;
      default:
        finishReason = 'stop';
    }

    const usage = data.usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      content,
      toolCalls,
      finishReason,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      raw: data,
    };
  }

  private parseToolArguments(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }

  // ---------- Error Handling ----------

  private async handleErrorResponse(res: Response): Promise<never> {
    const status = res.status;
    let body: OpenAiErrorResponse | null = null;

    try {
      body = (await res.json()) as OpenAiErrorResponse;
    } catch {
      // Ignore JSON parse errors
    }

    const msg = body?.error?.message || `OpenAI error ${status}`;

    if (status === 429) {
      throw new AiError('AI_RATE_LIMITED', msg);
    }
    if (status >= 500) {
      throw new AiError('AI_UNAVAILABLE', msg);
    }
    if (status === 400 || status === 422) {
      throw new AiError('AI_INVALID_RESPONSE', msg);
    }

    throw new AiError('AI_CHAT_FAILED', msg);
  }
}

// ---------- OpenAI API Types ----------

type OpenAiRole = 'system' | 'user' | 'assistant' | 'tool';

interface OpenAiMessage {
  role: OpenAiRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface OpenAiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

type OpenAiToolChoice =
  | 'auto'
  | 'none'
  | { type: 'function'; function: { name: string } };

interface OpenAiRequestBody {
  model: string;
  messages: OpenAiMessage[];
  temperature: number;
  max_tokens: number;
  tools?: OpenAiTool[];
  tool_choice?: OpenAiToolChoice;
}

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAiChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: OpenAiToolCall[];
  };
  finish_reason: string;
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAiChoice[];
  usage?: OpenAiUsage;
}

interface OpenAiErrorResponse {
  error?: {
    message: string;
    type: string;
    code: string;
  };
}
