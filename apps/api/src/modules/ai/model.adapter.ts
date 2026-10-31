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
  extra_content?: Record<string, unknown>;
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

    console.log('[ModelAdapter] Request payload messages:', JSON.stringify(messages, null, 2));

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

        // If 404 (model not found/deprecated), auto-retry with standard stable 'gemini-1.5-flash'
        if (response.status === 404 && model !== 'gemini-1.5-flash') {
          console.log("[ModelAdapter] Retrying with standard production model 'gemini-1.5-flash'...");
          try {
            const retryPayload = { ...payload, model: 'gemini-1.5-flash' };
            const retryRes = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(retryPayload),
            });

            if (retryRes.ok) {
              const retryJson: any = await retryRes.json();
              const choice = retryJson.choices?.[0];
              if (choice && choice.message) {
                return {
                  message: {
                    role: 'assistant',
                    content: choice.message.content || null,
                    tool_calls: choice.message.tool_calls || undefined,
                    extra_content: choice.message.extra_content || undefined,
                  },
                  finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
                  usage: retryJson.usage
                    ? {
                        promptTokens: retryJson.usage.prompt_tokens || 0,
                        completionTokens: retryJson.usage.completion_tokens || 0,
                        totalTokens: retryJson.usage.total_tokens || 0,
                      }
                    : undefined,
                  durationMs: Date.now() - startTime,
                };
              }
            } else {
              const retryErrText = await retryRes.text();
              console.warn(`[ModelAdapter] Retry error (${retryRes.status}): ${retryErrText.slice(0, 200)}`);
            }
          } catch (retryErr) {
            console.warn('[ModelAdapter] Retry attempt exception:', retryErr);
          }
        }

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
          extra_content: choice.message.extra_content || undefined,
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
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'tool') {
      let contentSummary = 'Tool executed successfully.';
      try {
        const parsed = JSON.parse(lastMsg.content || '{}');
        contentSummary = parsed.summary || contentSummary;
      } catch {
        contentSummary = lastMsg.content || contentSummary;
      }

      return {
        message: {
          role: 'assistant',
          content: `Here is the information from your store database:\n\n${contentSummary}`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content?.toLowerCase() || '';

    // ── 1. REAL STORE DATA & TOOL MATCHING (Takes highest priority for store operations) ──
    if (tools && tools.length > 0) {
      // 1. Low stock / reorder / shortages (Evaluated first so questions with "explain what needs reordering" check real stock)
      if (
        lastUserMsg.includes('low') ||
        lastUserMsg.includes('reorder') ||
        lastUserMsg.includes('replenish') ||
        lastUserMsg.includes('shortage') ||
        lastUserMsg.includes('out of stock')
      ) {
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

      // 2. Suppliers / Distributors / Vendors
      if (
        lastUserMsg.includes('supplier') ||
        lastUserMsg.includes('distributor') ||
        lastUserMsg.includes('distrbutor') ||
        lastUserMsg.includes('vendor') ||
        lastUserMsg.includes('wholesaler')
      ) {
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

      // 3. Stock balances / items / products list
      if (
        lastUserMsg.includes('stock') ||
        lastUserMsg.includes('inventory') ||
        lastUserMsg.includes('balance') ||
        (/\b(items?|products?|catalog|catalogue)\b/i.test(lastUserMsg) && !lastUserMsg.includes('how to'))
      ) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_inv`,
                type: 'function',
                function: {
                  name: 'get_inventory_overview',
                  arguments: JSON.stringify({}),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }

      // 4. Sales / Revenue (Use word boundaries, ignore general "how to" advice questions)
      if (
        (/\b(sales?|revenue|turnover|earnings?|collection)\b/i.test(lastUserMsg) ||
          lastUserMsg.includes('how much did we sell') ||
          lastUserMsg.includes('today')) &&
        !lastUserMsg.includes('how to') &&
        !lastUserMsg.includes('improve')
      ) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_3`,
                type: 'function',
                function: {
                  name: 'get_sales_overview',
                  arguments: JSON.stringify({
                    period: lastUserMsg.includes('30') ? '30d' : lastUserMsg.includes('7') || lastUserMsg.includes('week') ? '7d' : 'today',
                  }),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }

      // 5. Customer Khata / Udhar
      if (
        lastUserMsg.includes('khata') ||
        lastUserMsg.includes('udhar') ||
        lastUserMsg.includes('credit') ||
        lastUserMsg.includes('owe') ||
        lastUserMsg.includes('pending')
      ) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_5`,
                type: 'function',
                function: {
                  name: 'get_khata_credit_sales',
                  arguments: JSON.stringify({}),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }

      // 6. Top selling FMCG leaderboard
      if (lastUserMsg.includes('top') || lastUserMsg.includes('best') || lastUserMsg.includes('popular') || lastUserMsg.includes('fast')) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: `call_${Date.now()}_4`,
                type: 'function',
                function: {
                  name: 'get_top_selling_products',
                  arguments: JSON.stringify({ limit: 5 }),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }
    }

    // ── 2. WEBSITE & OPERATIONAL HOW-TO GUIDANCE ──
    const isHowToQuestion =
      lastUserMsg.includes('how to') ||
      lastUserMsg.includes('how do i') ||
      lastUserMsg.includes('where is') ||
      lastUserMsg.includes('explain') ||
      lastUserMsg.includes('guide') ||
      lastUserMsg.includes('help me') ||
      lastUserMsg.includes('what features') ||
      lastUserMsg.includes('overview') ||
      lastUserMsg.includes('improve') ||
      lastUserMsg.includes('about dukaanai');

    if (isHowToQuestion) {
      if (lastUserMsg.includes('pos') || lastUserMsg.includes('bill') || lastUserMsg.includes('checkout') || lastUserMsg.includes('counter') || lastUserMsg.includes('make a sale')) {
        return {
          message: {
            role: 'assistant',
            content: `### 🛒 How to Use the POS Counter (/pos)\n\n1. **Scan Products**: Click the barcode search box and scan with a camera or barcode laser reader (EAN-13). You can also type product names (e.g. *Maggi*, *Tata Tea*).\n2. **Quick-Add Items**: Click the FMCG quick chips on top to instantly add frequent items to the cart.\n3. **Adjust Quantities**: Change units directly in the cart table with automatic ₹ subtotal calculation.\n4. **Choose Payment Mode**:\n   - **Cash**: Enter the amount tendered by customer to calculate exact change.\n   - **UPI**: Generates a dynamic PhonePe / GPay QR code for instant scan-and-pay.\n   - **Khata**: Select Credit (Udhar) and link the bill to a customer account (e.g. *Gupta Kirana Khata*).\n5. **Complete & Print**: Click Complete Sale to print or view an instant thermal receipt!`,
          },
          finishReason: 'stop',
          durationMs: Date.now() - startTime,
        };
      }

      if (lastUserMsg.includes('finance') || lastUserMsg.includes('profit') || lastUserMsg.includes('margin') || lastUserMsg.includes('expense') || lastUserMsg.includes('cogs')) {
        return {
          message: {
            role: 'assistant',
            content: `### 💰 Strategies to Maximize Kirana Profit Margins & Finance (/finance)\n\n1. **Procure Direct from Wholesalers**: Use the **/suppliers** directory to negotiate bulk crate discounts from distributors (e.g. *Shree Ganesh Wholesale*, *Metro Cash & Carry*) rather than paying retail intermediary margins.\n2. **Prioritize High-Margin FMCG**: Promote items with higher margins (spices, tea, pulses, personal care at 15–25% margin) next to staple commodities (flour, sugar, oil at 4–8% margin).\n3. **Track Operating Overheads**: Regularly record daily shop expenses (Electricity, Helper Wages, Mandi Freight) via the **💸 Quick Expense** button.\n4. **Eliminate Dead Stock**: Check the **Low-Stock Safety Radar** on your dashboard to replenish fast-turning items and avoid locking capital in slow-moving SKUs.\n5. **Settle Customer Khata Promptly**: Recover pending Khata balances within 15–30 days to keep working capital liquid.`,
          },
          finishReason: 'stop',
          durationMs: Date.now() - startTime,
        };
      }

      if (lastUserMsg.includes('product') || lastUserMsg.includes('inventory') || lastUserMsg.includes('stock') || lastUserMsg.includes('barcode')) {
        return {
          message: {
            role: 'assistant',
            content: `### 📦 Managing Products & Inventory (/products & /inventory)\n\n- **/products**: Product master catalog with MRP, retail selling price, wholesale unit cost, EAN-13 barcodes, and purchase pack conversion rules (e.g., 1 carton = 12 packets).\n- **/inventory**: Real-time stock ledger. Track on-hand balances, view reorder threshold warnings, and record stock audit adjustments.\n\nAsk me: *"What products are low on stock?"* to see items needing reorder right now!`,
          },
          finishReason: 'stop',
          durationMs: Date.now() - startTime,
        };
      }

      if (lastUserMsg.includes('analytics') || lastUserMsg.includes('chart') || lastUserMsg.includes('report')) {
        return {
          message: {
            role: 'assistant',
            content: `### 📈 Business Analytics & Reports (/analytics)\n\n- **Interactive Trends**: 7-day, 14-day, and 30-day revenue and transaction charts.\n- **Payment Distribution**: UPI vs Cash vs Khata Udhar split.\n- **FMCG Leaderboard**: Top-selling products ranked by volume and revenue.\n\nVisit [http://localhost:5173/analytics](http://localhost:5173/analytics) to view full charts.`,
          },
          finishReason: 'stop',
          durationMs: Date.now() - startTime,
        };
      }

      if (lastUserMsg.includes('supplier') || lastUserMsg.includes('purchase') || lastUserMsg.includes('po') || lastUserMsg.includes('distributor')) {
        return {
          message: {
            role: 'assistant',
            content: `### 🚚 Suppliers & Purchasing (/suppliers & /purchases)\n\n- **/suppliers**: Directory of wholesale FMCG distributors (Hindustan Unilever, ITC, Nestle, Adani Wilmar) with MOQ and pack sizes.\n- **/purchases**: Draft and approved purchase orders, RFQs, and Goods Receipt Notes (GRN) with damage reporting.\n- **Autonomous Voice Negotiation**: DukaanAI can simulate Hindi/Marathi phone calls to negotiate wholesale rates before placing orders!`,
          },
          finishReason: 'stop',
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Default conversational reply
    return {
      message: {
        role: 'assistant',
        content: `Namaste! I am DukaanAI Munimji, your Kirana store AI copilot. I can assist you with:\n\n- **Live Sales & Profits**: *"How much did we sell today?"*\n- **Low Stock & Reorders**: *"What products are low on stock?"*\n- **Top Selling FMCG Items**: *"Which products are selling fastest?"*\n- **Customer Khata (Udhar)**: *"Who owes money on Khata?"*\n- **Logging Expenses**: *"Record 200 Rs for tea and snacks"*\n- **Website Help**: Ask me how to use the POS counter, manage products, view analytics, or handle suppliers!\n\n(AI Mode: Store Copilot Ready)`,
      },
      finishReason: 'stop',
      durationMs: Date.now() - startTime,
    };
  }
}
