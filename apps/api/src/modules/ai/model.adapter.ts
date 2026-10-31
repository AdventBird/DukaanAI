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

    // ── Website & Application Knowledge Handlers (for informational / how-to / website queries) ──
    const isQuestionAboutWebsite =
      lastUserMsg.includes('how') ||
      lastUserMsg.includes('what is') ||
      lastUserMsg.includes('where is') ||
      lastUserMsg.includes('explain') ||
      lastUserMsg.includes('guide') ||
      lastUserMsg.includes('help') ||
      lastUserMsg.includes('feature') ||
      lastUserMsg.includes('overview') ||
      lastUserMsg.includes('website');

    if (isQuestionAboutWebsite) {
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

      if (lastUserMsg.includes('finance') || lastUserMsg.includes('profit') || lastUserMsg.includes('expense') || lastUserMsg.includes('cogs')) {
        return {
          message: {
            role: 'assistant',
            content: `### 💰 Understanding Finance & Recording Expenses (/finance)\n\n- **Recorded Sales**: Live gross collections from completed POS bills.\n- **Cost of Goods Sold (COGS)**: Wholesale purchase cost basis of items sold.\n- **Gross Profit**: Recorded Sales minus COGS.\n- **Operating Expenses**: Daily shop overheads (Electricity, Helper Wages, Mandi Freight, Packaging).\n\n💡 **How to Record an Expense**:\n1. Click **💸 Quick Expense** on the Dashboard.\n2. Or go to **Finance (/finance)**, fill in category (e.g. *Electricity*), amount (₹), and notes, and click **Save Expense**.\n3. Or tell me in chat: *"Record 500 Rs for helper wages"*!`,
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

      // General website overview
      return {
        message: {
          role: 'assistant',
          content: `### 🌟 Welcome to DukaanAI — Kirana Store Operating System!\n\nHere are all the key sections available on the website:\n\n1. **📊 Dashboard (/dashboard)**: Live Store Pulse, Today's & 7-day sales, revenue chart, AI insights, and safety radar.\n2. **🛒 POS Counter (/pos)**: Fast barcode scanning, UPI QR generator, Cash change calculation, and Khata ledger billing.\n3. **🧾 Sales Register (/sales)**: Searchable bill history with itemized invoice modals.\n4. **📦 Products (/products)**: Catalog with MRP, costs, and EAN-13 barcodes.\n5. **📋 Inventory (/inventory)**: Real-time stock levels, reorder thresholds, and stock adjustments.\n6. **🚚 Suppliers & POs (/suppliers, /purchases)**: Wholesale distributors and procurement workflows.\n7. **💰 Finance (/finance)**: COGS, gross profit margins, and expense tracking.\n8. **📈 Analytics (/analytics)**: Interactive revenue charts, payment splits, and product leaderboards.\n9. **🤖 DukaanAI Munimji (/ai)**: Autonomous procurement and Hindi/Marathi voice negotiations.\n\nAsk me anything about how to use any of these sections!`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    // If tools are available and user wants to check real store data
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

      if (lastUserMsg.includes('sale') || lastUserMsg.includes('revenue') || lastUserMsg.includes('sold') || lastUserMsg.includes('today') || lastUserMsg.includes('profit')) {
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
                  arguments: JSON.stringify({ period: lastUserMsg.includes('30') ? '30d' : lastUserMsg.includes('7') || lastUserMsg.includes('week') ? '7d' : 'today' }),
                },
              },
            ],
          },
          finishReason: 'tool_calls',
          durationMs: Date.now() - startTime,
        };
      }

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

      if (lastUserMsg.includes('khata') || lastUserMsg.includes('udhar') || lastUserMsg.includes('credit') || lastUserMsg.includes('owe') || lastUserMsg.includes('pending')) {
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
    }

    // ── Website & Application Knowledge Handlers (for offline & conversational queries) ──
    if (lastUserMsg.includes('pos') || lastUserMsg.includes('bill') || lastUserMsg.includes('checkout') || lastUserMsg.includes('cash') || lastUserMsg.includes('counter')) {
      return {
        message: {
          role: 'assistant',
          content: `### 🛒 DukaanAI Point of Sale (POS) Counter (/pos)\n\nThe **POS Counter** is designed for ultra-fast Kirana counter billing:\n\n1. **Barcode Scanning**: Scan items with your camera or handheld laser scanner (EAN-13), or search by item name/SKU.\n2. **Quick-Add FMCG Chips**: Tap frequent products (e.g. Parle-G, Maggi, Tata Tea, Amul Milk) to instantly add them to the cart.\n3. **Payment Methods**:\n   - **Cash**: Enter cash tendered to calculate change automatically.\n   - **UPI**: Generates a dynamic PhonePe / GPay QR code for instant scan-and-pay.\n   - **Khata / Udhar**: Links the invoice to a customer credit ledger account (e.g., *Gupta Kirana Khata*).\n4. **Receipts**: Generates printable thermal receipts with GSTIN details.`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    if (lastUserMsg.includes('finance') || lastUserMsg.includes('expense') || lastUserMsg.includes('cogs') || lastUserMsg.includes('profit') || lastUserMsg.includes('loss')) {
      return {
        message: {
          role: 'assistant',
          content: `### 💰 Store Finance & Expenses (/finance)\n\nThe **Finance Overview** tracks your store's money movements:\n\n- **Recorded Sales**: Total revenue collected from completed POS bills.\n- **Cost of Goods Sold (COGS)**: The wholesale purchase cost basis of products sold.\n- **Gross Profit**: Net margin (Sales minus COGS).\n- **Operating Expenses**: Daily overheads like electricity, helper wages, mandi freight, and packaging.\n\n💡 **Tip**: You can record an expense anytime using the **Quick Expense** button on the Dashboard, on the Finance page, or by telling me right here in chat (e.g., *"Record 250 Rs for tempo freight"*).`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    if (lastUserMsg.includes('analytics') || lastUserMsg.includes('trend') || lastUserMsg.includes('report') || lastUserMsg.includes('chart')) {
      return {
        message: {
          role: 'assistant',
          content: `### 📈 Business Analytics & Reports (/analytics)\n\nThe **Analytics** section visualizes your store performance:\n\n1. **Dynamic Sales Trends**: Interactive 7-day, 14-day, and 30-day revenue and bill count charts.\n2. **Payment Distribution**: Breakdown comparing collections via **UPI**, **Cash**, and **Khata Credit (Udhar)**.\n3. **FMCG Leaderboard**: Top-selling products ranked by both volume and gross revenue.\n\nOpen [http://localhost:5173/analytics](http://localhost:5173/analytics) to explore your charts.`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    if (lastUserMsg.includes('product') || lastUserMsg.includes('inventory') || lastUserMsg.includes('item') || lastUserMsg.includes('stock')) {
      return {
        message: {
          role: 'assistant',
          content: `### 📦 Products & Inventory Management\n\n- **Products Master (/products)**: Manage your FMCG catalog, MRP, selling price, wholesale purchase costs, and EAN-13 barcodes.\n- **Inventory Ledger (/inventory)**: Track real-time stock balances on hand, set minimum reorder levels, and log physical stock count adjustments.\n\n💡 You can also ask me: *"What products are low on stock?"* to see items needing replenishment right now.`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    if (lastUserMsg.includes('supplier') || lastUserMsg.includes('purchase') || lastUserMsg.includes('order') || lastUserMsg.includes('distributor')) {
      return {
        message: {
          role: 'assistant',
          content: `### 🚚 Suppliers & Procurement (/suppliers, /purchases)\n\n- **Supplier Directory (/suppliers)**: Directory of wholesale distributors (Hindustan Unilever, ITC, Nestle, Adani Wilmar) with MOQ and pack sizes.\n- **Purchasing & POs (/purchases)**: Draft purchase orders, compare quotation requests, and accept deliveries with Goods Receipt Notes (GRN).\n- **Autonomous Voice Negotiation**: DukaanAI can simulate Hindi/Marathi phone calls to negotiate wholesale rates before placing orders!`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
    }

    if (lastUserMsg.includes('website') || lastUserMsg.includes('feature') || lastUserMsg.includes('how to') || lastUserMsg.includes('help') || lastUserMsg.includes('what can you do') || lastUserMsg.includes('overview')) {
      return {
        message: {
          role: 'assistant',
          content: `### 🌟 Welcome to DukaanAI — Your Kirana Store Operating System!\n\nHere are all the key sections available on the website:\n\n1. **📊 Dashboard (/dashboard)**: Live Store Pulse, Today's & 7-day sales, revenue chart, AI insights, and safety radar.\n2. **🛒 POS Counter (/pos)**: Fast barcode scanning, UPI QR generator, Cash change calculation, and Khata ledger billing.\n3. **🧾 Sales Register (/sales)**: Searchable bill history with itemized invoice modals.\n4. **📦 Products (/products)**: Catalog with MRP, costs, and EAN-13 barcodes.\n5. **📋 Inventory (/inventory)**: Real-time stock levels, reorder thresholds, and stock adjustments.\n6. **🚚 Suppliers & POs (/suppliers, /purchases)**: Wholesale distributors and procurement workflows.\n7. **💰 Finance (/finance)**: COGS, gross profit margins, and expense tracking.\n8. **📈 Analytics (/analytics)**: Interactive revenue charts, payment splits, and product leaderboards.\n9. **🤖 DukaanAI Munimji (/ai)**: Autonomous procurement and Hindi/Marathi voice negotiations.\n\nAsk me anything about your store or how to use any of these features!`,
        },
        finishReason: 'stop',
        durationMs: Date.now() - startTime,
      };
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
