import type { EffectiveAIConfig } from './config.js';

export interface ModelToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ModelToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ModelToolCall[];
}

export interface ModelResponse {
  message: ModelMessage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export class ModelAdapter {
  constructor(private readonly config: EffectiveAIConfig) {}

  async generateChat(
    messages: ModelMessage[],
    tools?: ModelToolDefinition[]
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    const { baseUrl, model, apiKey, timeoutMs } = this.config;

    if (!apiKey) {
      return this.generateOfflineFallback(messages, tools, startTime, 'API Key is not configured.');
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[ModelAdapter] API Error (${response.status}): ${errText.slice(0, 300)}`);
        return this.generateOfflineFallback(
          messages,
          tools,
          startTime,
          `LLM provider returned HTTP ${response.status}: ${errText.slice(0, 100)}`
        );
      }

      const json: any = await response.json();
      const choice = json.choices?.[0];

      if (!choice || !choice.message) {
        throw new Error('Malformed completion response from provider.');
      }

      return {
        message: {
          role: 'assistant',
          content: choice.message.content || null,
          tool_calls: choice.message.tool_calls || undefined,
        },
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens || 0,
              completionTokens: json.usage.completion_tokens || 0,
              totalTokens: json.usage.total_tokens || 0,
            }
          : undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      const reason = isTimeout ? `Request timed out after ${timeoutMs}ms` : err.message;
      console.warn(`[ModelAdapter] Fallback triggered: ${reason}`);
      return this.generateOfflineFallback(messages, tools, startTime, reason);
    }
  }

  /**
   * Deterministic offline assistant for hackathon resilience & disconnected testing
   */
  private generateOfflineFallback(
    messages: ModelMessage[],
    tools: ModelToolDefinition[] | undefined,
    startTime: number,
    diagnostic: string
  ): ModelResponse {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content?.toLowerCase() || '';

    // If tools are available and user wants to check stock/replenishment
    if (tools && tools.length > 0) {
      if (lastUserMsg.includes('low stock') || lastUserMsg.includes('reorder') || lastUserMsg.includes('replenish') || lastUserMsg.includes('check')) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_1`,
                type: 'function',
                function: {
                  name: 'get_low_stock',
                  arguments: JSON.stringify({}),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }

      if (lastUserMsg.includes('supplier') || lastUserMsg.includes('distributor')) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_2`,
                type: 'function',
                function: {
                  name: 'list_suppliers',
                  arguments: JSON.stringify({}),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Default conversational reply
    return {
      message: {
        role: 'assistant',
        content: `Namaste! I am DukaanAI, your store assistant. I can inspect your low-stock items, compare wholesale supplier quotes, simulate voice negotiations, and prepare purchase orders for your review. (Mode: Offline Engine - ${diagnostic})`,
      },
      finishReason: 'stop',
      durationMs: Date.now() - startTime,
    };
  }
}
