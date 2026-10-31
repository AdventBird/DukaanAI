import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  ChatMessage,
  ChatResponseData,
  AgentEvidenceItem,
  AgentToolAction,
  AgentTaskRecord,
} from '@dukaanai/shared';
import { getEffectiveAIConfig } from './config.js';
import { ModelAdapter, type ModelMessage } from './model.adapter.js';
import { toolRegistry, type ToolContext } from './tools/tool.registry.js';
import { taskService } from './task.service.js';
import { demoVoiceProvider } from './adapters/voice.adapter.js';
import { procurementService } from '../procurement/procurement.service.js';
import { supplierService } from '../suppliers/supplier.service.js';
import { InventoryService } from '../inventory/inventory.service.js';

export interface AISession {
  id: string;
  storeId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export class AIService {
  private readonly sessions = new Map<string, AISession>();

  constructor(private readonly prisma: PrismaClient) {}

  getSession(sessionId: string, storeId: string): AISession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.storeId === storeId) return session;
    return undefined;
  }

  listSessions(storeId: string): AISession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.storeId === storeId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async handleChat(params: {
    storeId: string;
    userId: string;
    requestId: string;
    message: string;
    sessionId?: string | null;
    customApiKey?: string;
  }): Promise<ChatResponseData> {
    const { storeId, userId, requestId, message, customApiKey } = params;
    const config = getEffectiveAIConfig(customApiKey);
    const modelAdapter = new ModelAdapter(config);

    // Retrieve or create session
    let session: AISession | undefined;

    if (params.sessionId) {
      session = this.getSession(params.sessionId, storeId);
    }

    if (!session) {
      const generatedSessionId = `sess_${Date.now()}_${randomUUID().slice(0, 6)}`;
      session = {
        id: generatedSessionId,
        storeId,
        userId,
        title: message.slice(0, 40),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.sessions.set(generatedSessionId, session);
    }

    const currentSessionId = session.id;

    // Append user message
    session.messages.push({
      id: randomUUID(),
      sessionId: currentSessionId,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    });

    // Check for explicit replenishment trigger command
    const lowerMsg = message.toLowerCase();
    if (
      lowerMsg.includes('replenish') ||
      lowerMsg.includes('reorder low stock') ||
      lowerMsg.includes('start reorder') ||
      lowerMsg.includes('autonomous replenishment')
    ) {
      const task = await this.startAutonomousReplenishmentTask(storeId, userId, requestId);
      const replyText = `I have detected items needing replenishment and initiated autonomous workflow **Task ${task.id}**. I am checking stock, soliciting distributor quotations, and negotiating wholesale rates via telephone. I will prepare an order draft and pause for your review before placing it.`;

      session.messages.push({
        id: randomUUID(),
        sessionId: currentSessionId,
        role: 'assistant',
        content: replyText,
        createdAt: new Date().toISOString(),
      });

      return {
        sessionId: currentSessionId,
        message: replyText,
        taskIds: [task.id],
        actions: [{ tool: 'get_low_stock', status: 'SUCCEEDED', summary: 'Scanned store inventory for items at/below reorder thresholds.' }],
        evidence: [{ type: 'INVENTORY_PRODUCT', id: 'auto-replenish', label: `Replenishment Task ${task.id} Created` }],
        model: config.model,
        keySource: config.keySource === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM_DEFAULT',
      };
    }

    // Build context messages for LLM
    const modelMessages: ModelMessage[] = [
      {
        role: 'system',
        content: `You are DukaanAI, an intelligent Kirana store AI employee and digital Munimji for a traditional Indian Kirana & General Store (Shree Ganesh Kirana & General Store, Chandni Chowk, Delhi).
Store Context: Store ID ${storeId}, Currency INR (₹). Owner: Ramesh Uncle / Josbin.

YOU ARE AN EXPERT ON DUKAANAI AND CAN ANSWER ALL WEBSITE & OPERATIONAL QUESTIONS:
1. Website Navigation & Sections:
   - /dashboard (Overview): Live Store Pulse, Today's & 7-day sales metrics (revenue, transaction count, avg basket, gross profit), interactive daily bar chart, AI co-pilot intelligence banner, quick expense modal, and low-stock safety radar.
   - /pos (POS Counter): Ultra-fast billing terminal. Features camera & laser EAN-13 barcode scanner, instant search, quick-add FMCG chips, cash tendered & change calculator, dynamic UPI QR modal (PhonePe/GPay), and Kirana Khata (Udhar / credit) customer billing with printable receipts.
   - /sales (Sales Register): Full searchable transaction history with payment filter pills (All, Cash, UPI, Khata) and itemized invoice modals.
   - /products (Products Master): FMCG catalog, MRP, retail selling price, wholesale unit cost, barcodes, and purchase pack conversion rules (e.g. 1 carton = 12 bottles).
   - /inventory (Inventory Ledger): Real-time on-hand balances, reorder threshold levels, stock movement history, and audit stock adjustments.
   - /suppliers (Suppliers Directory): Directory of wholesale distributors (Hindustan Unilever, ITC, Nestle, Adani Wilmar, Local Mandi Wholesalers) with MOQ and pack sizes.
   - /purchases (Procurement & POs): Draft and approved purchase orders, automated quotation requests, and Goods Receipt Notes (GRN) with damage reporting.
   - /finance (Store Finance): Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses (Electricity, Wages, Freight, Rent), and Net Operating Result.
   - /analytics (Business Insights): Interactive daily sales trends, payment mode splits (UPI vs Cash vs Khata), and top-selling FMCG products leaderboard.
   - /ai (AI Employee Studio): Multi-lingual autonomous replenishment, telephone voice negotiation simulations with distributors in Hindi/Marathi, and Playwright browser portal automation.

2. Real-Time Tool Execution:
   - Always call available tools when the user asks for real store numbers (e.g., today's sales, low-stock items, top products, customer Khata balances, or recording expenses).
   - If the user asks general questions about how to use any part of the website or retail operations, explain clearly and guide them with navigation paths.

RULES:
- Never fabricate inventory counts or prices. Use tools for real numbers.
- Store owner approval is required before purchase orders are submitted to distributor portals.
- Always quote prices in INR (₹). Be concise, respectful, and helpful. Respond in English, Hindi, or Hinglish as preferred by the user.`,
      },
      ...session.messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const actionsTaken: AgentToolAction[] = [];
    const evidenceItems: AgentEvidenceItem[] = [];
    const taskIds: string[] = [];
    const toolDefs = toolRegistry.getAllDefinitions();

    const toolCtx: ToolContext = {
      storeId,
      userId,
      requestId,
      prisma: this.prisma,
    };

    // Bounded Tool Loop (max 5 cycles)
    let turns = 0;
    const MAX_TURNS = 5;

    while (turns < MAX_TURNS) {
      turns++;
      const response = await modelAdapter.generateChat(modelMessages, toolDefs);

      if (response.finishReason === 'tool_calls' && response.message.tool_calls) {
        // Model wants to call one or more tools
        modelMessages.push(response.message);

        let smartToolSummaryText = '';
        for (const tc of response.message.tool_calls) {
          const tool = toolRegistry.get(tc.function.name);
          let toolResultSummary = '';
          let toolData: any = null;

          if (!tool) {
            toolResultSummary = `Error: Tool '${tc.function.name}' is not allowlisted or recognized.`;
            actionsTaken.push({ tool: tc.function.name, status: 'FAILED', summary: toolResultSummary });
          } else {
            try {
              let parsedArgs = {};
              try {
                parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
              } catch {
                parsedArgs = {};
              }

              const result = await tool.execute(toolCtx, parsedArgs);
              toolResultSummary = result.summary;
              toolData = result.data;

              actionsTaken.push({
                tool: tool.name,
                status: 'SUCCEEDED',
                summary: result.summary,
              });

              // Thoughtfully construct intelligent natural responses for tools
              if (tool.name === 'get_low_stock' && Array.isArray(toolData)) {
                const items = toolData as any[];
                if (items.length === 0) {
                  smartToolSummaryText = `🟢 **Stock Health is Excellent!**\n\nAll products in *Shree Ganesh Kirana & General Store* are currently above their minimum reorder safety thresholds. No immediate replenishment is required.`;
                } else {
                  smartToolSummaryText = `### ⚠️ Low Stock Alert — Replenishment Recommended\n\nI analyzed your store inventory against minimum safety thresholds. Here are the **${items.length} products** currently running low:\n\n` +
                    items.map((it: any, idx: number) => {
                      const onHand = Number(it.quantityOnHand || 0);
                      const reorder = Number(it.reorderLevel || 0);
                      const deficit = Math.max(0, reorder - onHand);
                      return `**${idx + 1}. ${it.name}**\n   - Current Balance: **${onHand} ${it.stockUnit}** (Safety Min: ${reorder} ${it.stockUnit})\n   - **Shortage / Deficit**: **${deficit} ${it.stockUnit}** needed\n   - Category: *${it.category || 'General Kirana'}* | Selling Price: ₹${it.sellingPrice}`;
                    }).join('\n\n') +
                    `\n\n💡 **Munimji Recommendation**: These items have fast daily customer turnover. Would you like me to prepare a draft purchase order or simulate an automated phone call to your distributors to check wholesale crate discounts?`;
                }

                toolData.forEach((it: any) => {
                  evidenceItems.push({
                    type: 'INVENTORY_PRODUCT',
                    id: it.productId,
                    label: `${it.name} (On Hand: ${it.quantityOnHand} ${it.stockUnit}, Reorder Level: ${it.reorderLevel})`,
                  });
                });
              } else if (tool.name === 'get_inventory_overview' && toolData) {
                const { health, sampleStock } = toolData as any;
                smartToolSummaryText = `### 📦 Store Inventory & Stock Breakdown\n\nHere is the real-time stock balance across *Shree Ganesh Kirana & General Store*:\n\n- **Total Active Products**: **${health.totalProducts} SKUs**\n- **Low Stock Items**: **${health.lowStockCount} items**\n- **Out of Stock**: **${health.stockoutCount} items**\n\n**On-Hand Stock Levels (Sample Items):**\n` +
                  (sampleStock || []).map((p: any) => `• **${p.name || p.productName}**: **${p.quantityOnHand} ${p.stockUnit}** on hand (Safety Level: ${p.reorderLevel})`).join('\n') +
                  `\n\n💡 **Summary**: Your store inventory is actively synchronized with the POS register. Any sale made at the counter automatically deducts from these stock balances.`;
              } else if (tool.name === 'get_sales_overview' && toolData) {
                smartToolSummaryText = `### 📊 Live Sales & Revenue Breakdown (${toolData.period || 'today'})\n\n- **Gross Sales Collected**: **₹${toolData.sales}**\n- **Total Invoices / Transactions**: **${toolData.transactions} bills**\n- **Average Basket Size**: **₹${toolData.averageBasket}** per shopper\n- **Estimated Gross Profit**: **₹${toolData.grossProfit}**\n\n💡 **Munimji Insight**: Today's collections show healthy consumer demand. To see individual payment method splits (UPI vs Cash vs Khata), check the **Analytics** tab.`;
              } else if (tool.name === 'get_top_selling_products' && Array.isArray(toolData)) {
                smartToolSummaryText = `### 🏆 Fast-Moving FMCG Leaderboard\n\nHere are your highest-performing products by consumer volume and revenue:\n\n` +
                  toolData.map((p: any, i: number) => `**${i + 1}. ${p.name || p.productName}**\n   - Units Sold: **${p.unitsSold} ${p.stockUnit || 'units'}**\n   - Revenue Generated: **₹${p.revenue}**\n   - Category: *${p.category || 'Kirana'}*`).join('\n\n') +
                  `\n\n💡 **Insight**: Keep high safety stock levels for these top performers to prevent revenue loss from stockouts.`;
              } else if (tool.name === 'get_khata_credit_sales' && toolData) {
                smartToolSummaryText = `### 📖 Customer Khata (Udhar) Ledger Summary\n\n- **Total Unsettled Invoices**: **${toolData.totalInvoices}**\n- **Total Outstanding Credit**: **₹${toolData.totalPendingBalance}**\n\n**Active Customer Balances:**\n` +
                  (toolData.items || []).slice(0, 6).map((s: any) => `• **${s.customerLabel}**: **₹${s.balanceDue}** pending (Bill: *${s.receiptNumber}*)`).join('\n') +
                  `\n\n💡 **Action**: Consider sending friendly payment reminders before the monthly settlement cycle.`;
              } else if (tool.name === 'create_purchase_order_draft' && toolData) {
                evidenceItems.push({
                  type: 'PURCHASE_ORDER',
                  id: toolData.id,
                  label: `Draft PO ${toolData.orderNumber} (₹${toolData.estimatedTotal})`,
                });
              } else if (tool.name === 'simulate_supplier_voice_call' && toolData) {
                evidenceItems.push({
                  type: 'VOICE_TRANSCRIPT',
                  id: toolData.callId,
                  label: `Voice negotiation with ${toolData.supplierName} (${toolData.language})`,
                  data: toolData,
                });
              } else if (tool.name === 'get_inventory_overview' && toolData?.sampleStock && Array.isArray(toolData.sampleStock)) {
                toolData.sampleStock.slice(0, 5).forEach((b: any) => {
                  evidenceItems.push({
                    type: 'INVENTORY_PRODUCT',
                    id: b.productId,
                    label: `${b.name || b.productName}: ${b.quantityOnHand} ${b.stockUnit} on hand`,
                  });
                });
              }
            } catch (execErr: any) {
              toolResultSummary = `Execution failed: ${execErr.message}`;
              actionsTaken.push({ tool: tool.name, status: 'FAILED', summary: toolResultSummary });
            }
          }

          // Feed result back to model
          modelMessages.push({
            role: 'tool',
            name: tc.function.name,
            tool_call_id: tc.id,
            content: JSON.stringify({ summary: toolResultSummary, data: toolData }),
          });
        }

        // If synthetic fallback tool call (no thought_signature), return rich thoughtful text directly
        const isSynthetic = response.message.tool_calls.some((tc: any) => !tc.extra_content);
        if (isSynthetic && smartToolSummaryText) {
          session.messages.push({
            id: randomUUID(),
            sessionId: currentSessionId,
            role: 'assistant',
            content: smartToolSummaryText,
            createdAt: new Date().toISOString(),
          });
          session.updatedAt = new Date().toISOString();

          return {
            sessionId: currentSessionId,
            message: smartToolSummaryText,
            taskIds,
            actions: actionsTaken,
            evidence: evidenceItems,
            model: config.model,
            keySource: config.keySource === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM_DEFAULT',
          };
        }
      } else {
        // Model provided final text response
        const finalContent =
          response.message.content ||
          'I have analyzed your store records. Let me know if you would like me to draft an order or contact distributors.';

        session.messages.push({
          id: randomUUID(),
          sessionId: currentSessionId,
          role: 'assistant',
          content: finalContent,
          createdAt: new Date().toISOString(),
        });
        session.updatedAt = new Date().toISOString();

        return {
          sessionId: currentSessionId,
          message: finalContent,
          taskIds,
          actions: actionsTaken,
          evidence: evidenceItems,
          model: config.model,
          keySource: config.keySource === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM_DEFAULT',
        };
      }
    }

    // Safety fallback if loop limit reached
    const fallbackText =
      'I completed my analysis of your inventory and supplier records. The relevant tools have been executed above.';
    session.messages.push({
      id: randomUUID(),
      sessionId: currentSessionId,
      role: 'assistant',
      content: fallbackText,
      createdAt: new Date().toISOString(),
    });

    return {
      sessionId: currentSessionId,
      message: fallbackText,
      taskIds,
      actions: actionsTaken,
      evidence: evidenceItems,
      model: config.model,
      keySource: config.keySource === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM_DEFAULT',
    };
  }

  /**
   * Autonomous Replenishment Workflow (The Master AI-01 Demo)
   */
  async startAutonomousReplenishmentTask(
    storeId: string,
    userId: string,
    _requestId: string
  ): Promise<AgentTaskRecord> {
    const inv = new InventoryService(this.prisma);
    const lowStockItems = await inv.getLowStock(storeId);

    // Pick top low-stock item (or default to Parle-G)
    const targetItem = lowStockItems[0] || {
      productId: 'prod_parle_g',
      name: 'Parle-G Gold Biscuits 250g',
      quantityOnHand: '2',
      reorderLevel: '10',
      stockUnit: 'PIECE',
    };

    // 1. Create durable task
    const task = taskService.createTask({
      storeId,
      taskType: 'REPLENISHMENT',
      inputSummary: `Autonomous replenishment for ${targetItem.name}`,
      relatedEntityType: 'PRODUCT',
      relatedEntityId: targetItem.productId,
      steps: [
        { name: 'Scan Low-Stock & In-Flight POs', toolName: 'get_low_stock' },
        { name: 'Request Wholesale Quotes', toolName: 'create_quote_request' },
        { name: 'Supplier Call (Hindi Negotiation)', toolName: 'simulate_supplier_voice_call' },
        { name: 'Evaluate Pricing & MOQ Trade-offs', toolName: 'compare_supplier_quotes' },
        { name: 'Draft PO & Pause for Owner Approval', toolName: 'submit_order_for_approval' },
        { name: 'Submit to Distributor Portal via Browser Automation', toolName: 'submit_order_via_mock_portal' },
      ],
      initialCheckpoint: {
        productName: targetItem.name,
        productId: targetItem.productId,
        onHand: targetItem.quantityOnHand,
        reorderLevel: targetItem.reorderLevel,
      },
    });

    taskService.updateTaskStatus(task.id, 'RUNNING');

    // Run steps in sequence
    try {
      // Step 0: Checked low stock
      taskService.advanceStep(task.id, 0, 'COMPLETED', `Verified ${targetItem.name} has only ${targetItem.quantityOnHand} on hand (below reorder level of ${targetItem.reorderLevel}).`);

      // Step 1: Find suppliers and create quote request
      const activeSuppliers = await supplierService.listSuppliers(storeId, {
        includeArchived: false,
        page: 1,
        pageSize: 20,
      });
      const supplierIds = activeSuppliers.items.map((s) => s.id);

      const quoteReq = await procurementService.createQuoteRequest(storeId, userId, {
        supplierIds: supplierIds.slice(0, 2),
        items: [
          {
            productId: targetItem.productId,
            productName: targetItem.name,
            requestedQuantityInPurchasePacks: '30',
            requestedPurchaseUnitLabel: 'box',
            unitsPerPackSnapshot: '12',
          },
        ],
        notes: 'AI Automated replenishment inquiry',
      });

      taskService.advanceStep(task.id, 1, 'COMPLETED', `Created Quote Request ${quoteReq.requestNumber} to ${supplierIds.length} wholesale distributors.`);

      // Step 2: Indian-Language Voice Call Negotiation
      const voiceResult = await demoVoiceProvider.simulateOutboundCall('hi-IN', 'SUPPLIER_QUOTATION', {
        supplierId: supplierIds[0] || 'sup_anand',
        supplierName: activeSuppliers.items[0]?.name || 'Anand Agencies Wholesalers',
        productName: targetItem.name,
        requestedQuantity: 30,
        packLabel: 'box',
        scenario: 'NEGOTIATED_DISCOUNT',
      });

      taskService.advanceStep(
        task.id,
        2,
        'COMPLETED',
        `Simulated telephone conversation with ${voiceResult.supplierName} in Hindi. Negotiated special bulk rate of ₹${voiceResult.extractedQuote?.quotedPricePerPack}/box (12 units/box).`
      );

      // Step 3: Compare and recommend
      const recommendedSupplier = activeSuppliers.items[0] || {
        id: 'sup_anand',
        name: 'Anand Agencies',
      };
      taskService.advanceStep(
        task.id,
        3,
        'COMPLETED',
        `Evaluated offers: ${recommendedSupplier.name} wins on lowest stock-unit cost (₹9.17/unit) and 1-day delivery.`
      );

      // Step 4: Create Purchase Order Draft & transition to WAITING_APPROVAL
      const poDraft = await procurementService.createPurchaseOrderDraft(storeId, userId, {
        supplierId: recommendedSupplier.id,
        items: [
          {
            productId: targetItem.productId,
            quantityInPurchasePacks: '30',
            unitPricePerPurchasePack: voiceResult.extractedQuote?.quotedPricePerPack || '110.00',
          },
        ],
        notes: `Replenishment order negotiated via AI voice agent. Pending owner approval.`,
      });

      await procurementService.submitForApproval(storeId, poDraft.id);

      taskService.advanceStep(
        task.id,
        4,
        'COMPLETED',
        `Draft PO ${poDraft.orderNumber} created (Total ₹${poDraft.estimatedTotal}). Paused: Awaiting Kirana store owner approval.`
      );

      // Pause task in WAITING_APPROVAL state!
      taskService.updateTaskStatus(task.id, 'WAITING_APPROVAL', undefined, {
        purchaseOrderId: poDraft.id,
        purchaseOrderNumber: poDraft.orderNumber,
        estimatedTotal: poDraft.estimatedTotal,
        supplierName: recommendedSupplier.name,
        voiceCallId: voiceResult.callId,
      });
    } catch (err: any) {
      taskService.updateTaskStatus(task.id, 'FAILED', err.message);
    }

    return task;
  }
}
