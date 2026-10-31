import type { PrismaClient } from '@prisma/client';
import type { AgentToolPermission } from '@dukaanai/shared';
import { ProductService } from '../../products/product.service.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { procurementService } from '../../procurement/procurement.service.js';
import { supplierService } from '../../suppliers/supplier.service.js';
import { SalesService } from '../../sales/sales.service.js';
import { demoVoiceProvider } from '../adapters/voice.adapter.js';
import { browserPortalAdapter } from '../adapters/browser.adapter.js';

export interface ToolContext {
  storeId: string;
  userId: string;
  requestId: string;
  prisma: PrismaClient;
}

export interface ToolDefinition {
  name: string;
  description: string;
  permission: AgentToolPermission;
  parameters: Record<string, unknown>;
  execute: (context: ToolContext, args: any) => Promise<{ summary: string; data?: unknown }>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerStandardTools();
  }

  private registerStandardTools() {
    // 1. get_low_stock
    this.register({
      name: 'get_low_stock',
      description: 'Find products in the store that are at or below their minimum reorder stock level.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async (ctx) => {
        const inv = new InventoryService(ctx.prisma);
        const items = await inv.getLowStock(ctx.storeId);
        return {
          summary: `Found ${items.length} low-stock products needing replenishment.`,
          data: items,
        };
      },
    });

    // 2. search_products
    this.register({
      name: 'search_products',
      description: 'Search store products by name, brand, SKU, or barcode.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product name or keyword to search' },
          limit: { type: 'number', description: 'Max results to return' },
        },
        required: ['query'],
      },
      execute: async (ctx, args) => {
        const prodService = new ProductService(ctx.prisma);
        const res = await prodService.listProducts(ctx.storeId, {
          search: String(args.query || ''),
          pageSize: Math.min(Number(args.limit || 10), 50),
        });
        return {
          summary: `Found ${res.pagination.total} products matching '${args.query}'.`,
          data: res.products,
        };
      },
    });

    // 3. get_stock
    this.register({
      name: 'get_stock',
      description: 'Get current on-hand balance and reorder level for a specific product ID.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID of the product' },
        },
        required: ['productId'],
      },
      execute: async (ctx, args) => {
        const inv = new InventoryService(ctx.prisma);
        const bal = await inv.getProductBalance(ctx.storeId, String(args.productId));
        if (!bal) {
          return { summary: `No inventory balance found for product ${args.productId}.` };
        }
        return {
          summary: `Product has ${bal.quantityOnHand} on hand (reorder level: ${bal.reorderLevel}).`,
          data: bal,
        };
      },
    });

    // 4. list_suppliers
    this.register({
      name: 'list_suppliers',
      description: 'List active wholesale suppliers and distributors available for the store.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional supplier name search' },
        },
      },
      execute: async (ctx, args) => {
        const res = await supplierService.listSuppliers(ctx.storeId, {
          query: args.search,
          includeArchived: false,
          page: 1,
          pageSize: 20,
        });
        return {
          summary: `Found ${res.total} active suppliers for store.`,
          data: res.items,
        };
      },
    });

    // 5. get_supplier_products
    this.register({
      name: 'get_supplier_products',
      description: 'Get product mappings, purchase pack sizes, and MOQ for a specific supplier.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          supplierId: { type: 'string', description: 'ID of the supplier' },
        },
        required: ['supplierId'],
      },
      execute: async (ctx, args) => {
        const items = await supplierService.listProducts(ctx.storeId, String(args.supplierId));
        return {
          summary: `Supplier offers ${items.length} mapped products with wholesale pack details.`,
          data: items,
        };
      },
    });

    // 6. create_quote_request
    this.register({
      name: 'create_quote_request',
      description: 'Send a quotation request to one or more wholesale distributors for products.',
      permission: 'DRAFT_WRITE',
      parameters: {
        type: 'object',
        properties: {
          supplierIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of supplier IDs to solicit quotes from',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                productName: { type: 'string' },
                requestedQuantityInPurchasePacks: { type: 'string' },
                requestedPurchaseUnitLabel: { type: 'string' },
                unitsPerPackSnapshot: { type: 'string' },
              },
              required: ['productId', 'productName', 'requestedQuantityInPurchasePacks', 'requestedPurchaseUnitLabel', 'unitsPerPackSnapshot'],
            },
          },
          notes: { type: 'string' },
        },
        required: ['supplierIds', 'items'],
      },
      execute: async (ctx, args) => {
        const result = await procurementService.createQuoteRequest(ctx.storeId, ctx.userId, {
          supplierIds: args.supplierIds,
          items: args.items,
          notes: args.notes || 'Automated replenishment quotation inquiry by DukaanAI',
        });
        return {
          summary: `Created quote request ${result.requestNumber} for ${args.supplierIds.length} suppliers.`,
          data: result,
        };
      },
    });

    // 7. simulate_supplier_voice_call
    this.register({
      name: 'simulate_supplier_voice_call',
      description: 'Simulate an outbound Indian-language phone call to a wholesale distributor in Hindi or Marathi.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          supplierId: { type: 'string', description: 'ID of the distributor' },
          supplierName: { type: 'string', description: 'Name of the supplier' },
          productName: { type: 'string', description: 'Product to inquire about' },
          requestedQuantity: { type: 'number', description: 'Quantity of boxes/cartons needed' },
          packLabel: { type: 'string', description: 'carton or box' },
          language: { type: 'string', enum: ['hi-IN', 'mr-IN', 'en-IN'], description: 'Spoken language' },
          scenario: { type: 'string', enum: ['NORMAL', 'NEGOTIATED_DISCOUNT', 'SHORTAGE'] },
        },
        required: ['supplierId', 'supplierName', 'productName', 'requestedQuantity'],
      },
      execute: async (_ctx, args) => {
        const callResult = await demoVoiceProvider.simulateOutboundCall(
          args.language || 'hi-IN',
          'SUPPLIER_QUOTATION',
          {
            supplierId: args.supplierId,
            supplierName: args.supplierName,
            productName: args.productName,
            requestedQuantity: Number(args.requestedQuantity),
            packLabel: args.packLabel || 'box',
            scenario: args.scenario || 'NEGOTIATED_DISCOUNT',
          }
        );
        return {
          summary: `Completed simulated supplier call with ${args.supplierName} (${callResult.language}). Rate quoted: ₹${callResult.extractedQuote?.quotedPricePerPack || '0'}/${callResult.extractedQuote?.packLabel || 'pack'}.`,
          data: callResult,
        };
      },
    });

    // 8. create_purchase_order_draft
    this.register({
      name: 'create_purchase_order_draft',
      description: 'Draft a purchase order for owner review and approval. Does NOT commit money or submit order.',
      permission: 'DRAFT_WRITE',
      parameters: {
        type: 'object',
        properties: {
          supplierId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                orderedQuantityInPurchasePacks: { type: 'string' },
                unitCost: { type: 'string' },
              },
              required: ['productId', 'orderedQuantityInPurchasePacks'],
            },
          },
          notes: { type: 'string' },
        },
        required: ['supplierId', 'items'],
      },
      execute: async (ctx, args) => {
        const po = await procurementService.createPurchaseOrderDraft(ctx.storeId, ctx.userId, {
          supplierId: args.supplierId,
          items: args.items.map((it: any) => ({
            productId: it.productId,
            quantityInPurchasePacks: String(it.orderedQuantityInPurchasePacks),
            unitPricePerPurchasePack: it.unitCost ? String(it.unitCost) : undefined,
          })),
          notes: args.notes || 'DukaanAI AI Employee Replenishment Draft (Pending Owner Approval)',
        });
        return {
          summary: `Draft purchase order ${po.orderNumber} created (Status: ${po.status}, Total: ₹${po.estimatedTotal}). Awaiting owner review.`,
          data: po,
        };
      },
    });

    // 9. submit_order_for_approval
    this.register({
      name: 'submit_order_for_approval',
      description: 'Submit an existing draft purchase order for the Kirana store owner to approve.',
      permission: 'APPROVAL_REQUEST',
      parameters: {
        type: 'object',
        properties: {
          purchaseOrderId: { type: 'string', description: 'ID of the purchase order' },
          reason: { type: 'string', description: 'Brief explanation why this reorder is necessary' },
        },
        required: ['purchaseOrderId'],
      },
      execute: async (ctx, args) => {
        const po = await procurementService.submitForApproval(ctx.storeId, String(args.purchaseOrderId));
        return {
          summary: `Order ${po.orderNumber} transitioned to PENDING_APPROVAL. The store owner must approve before computer-use submission.`,
          data: po,
        };
      },
    });

    // 10. submit_order_via_mock_portal
    this.register({
      name: 'submit_order_via_mock_portal',
      description: 'Submit an APPROVED purchase order to the distributor portal via Playwright computer-use automation.',
      permission: 'APPROVED_EXECUTION',
      parameters: {
        type: 'object',
        properties: {
          purchaseOrderId: { type: 'string', description: 'ID of the APPROVED purchase order' },
        },
        required: ['purchaseOrderId'],
      },
      execute: async (ctx, args) => {
        const po = await procurementService.getPurchaseOrder(ctx.storeId, String(args.purchaseOrderId));
        if (!po) {
          throw new Error(`Purchase order ${args.purchaseOrderId} not found.`);
        }

        // SAFETY INVARIANT: Must be approved by store owner first!
        if (po.status !== 'APPROVED') {
          throw new Error(
            `Safety check failed: Order status is '${po.status}'. The store owner must explicitly approve this PO before browser portal automation can proceed.`
          );
        }

        const portalResult = await browserPortalAdapter.submitPurchaseOrder({
          supplierId: po.supplierId,
          poNumber: po.orderNumber,
          items: po.items.map((it) => ({
            sku: it.productId,
            name: it.productNameSnapshot,
            packs: Number(it.orderedQuantityInPurchasePacks),
            unitPrice: Number(it.unitPricePerPurchasePack),
            total: Number(it.lineTotal),
          })),
          totalAmount: Number(po.estimatedTotal),
        });

        // Record submission in procurement service
        await procurementService.submitPurchaseOrder(ctx.storeId, po.id, {
          expectedRevision: po.revision,
          idempotencyKey: portalResult.orderReference,
          submissionChannel: 'MOCK_PORTAL',
        });

        return {
          summary: `Order ${po.orderNumber} successfully submitted to ${po.supplierName} portal via automated browser agent. Distributor Ref: ${portalResult.orderReference}.`,
          data: portalResult,
        };
      },
    });

    // 11. get_sales_overview
    this.register({
      name: 'get_sales_overview',
      description: 'Get real-time sales overview including total revenue, transaction count, average basket size, and profit for today, 7d, or 30d.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', '7d', '30d'], description: 'Time horizon for sales' },
        },
      },
      execute: async (ctx, args) => {
        const sales = new SalesService(ctx.prisma);
        const summary = await sales.getDashboardSummary(ctx.storeId, args.period || 'today');
        return {
          summary: `Sales for ${args.period || 'today'}: ₹${summary.sales} across ${summary.transactions} transactions (Avg Basket: ₹${summary.averageBasket}, Gross Profit: ₹${summary.grossProfit}).`,
          data: summary,
        };
      },
    });

    // 12. get_top_selling_products
    this.register({
      name: 'get_top_selling_products',
      description: 'Get the fastest-moving and highest-revenue generating FMCG products in the store.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of top products (default 5)' },
        },
      },
      execute: async (ctx, args) => {
        const sales = new SalesService(ctx.prisma);
        const top = await sales.getTopSellingProducts(ctx.storeId, Number(args.limit || 5));
        const listStr = top.map((p: any, i) => `${i + 1}. ${p.name || p.productName} (${p.unitsSold} units, ₹${p.revenue})`).join(', ');
        return {
          summary: `Top selling products: ${listStr || 'No sales recorded yet'}.`,
          data: top,
        };
      },
    });

    // 13. record_quick_expense
    this.register({
      name: 'record_quick_expense',
      description: 'Log and record an operational store expense such as electricity, helper wages, tea/snacks, or transportation.',
      permission: 'DRAFT_WRITE',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['UTILITIES', 'WAGES', 'RENT', 'TRANSPORT', 'PACKAGING', 'MISCELLANEOUS'],
            description: 'Category of expense',
          },
          amount: { type: 'number', description: 'Amount in INR (₹)' },
          description: { type: 'string', description: 'Reason or note for expense' },
        },
        required: ['category', 'amount', 'description'],
      },
      execute: async (ctx, args) => {
        const amountNum = Number(args.amount);
        if (!amountNum || amountNum <= 0) {
          throw new Error('Expense amount must be a positive number.');
        }
        const created = await ctx.prisma.expense.create({
          data: {
            storeId: ctx.storeId,
            category: String(args.category),
            amount: amountNum.toFixed(2),
            currency: 'INR',
            description: String(args.description || 'Quick expense recorded via DukaanAI Chatbot'),
            occurredAt: new Date(),
            createdById: ctx.userId,
          },
        });
        return {
          summary: `Recorded ₹${created.amount} expense for ${created.category} (${created.description}).`,
          data: created,
        };
      },
    });

    // 14. get_khata_credit_sales
    this.register({
      name: 'get_khata_credit_sales',
      description: 'Get outstanding customer credit (Khata / Udhar) balances and recent credit invoices.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional customer name or phone filter' },
        },
      },
      execute: async (ctx, args) => {
        const sales = new SalesService(ctx.prisma);
        const res = await sales.listSales(ctx.storeId, {
          paymentMethod: 'CREDIT',
          search: args.search,
          pageSize: 10,
        });
        const items = res.items || [];
        const totalPending = items.reduce((acc, s) => acc + Number(s.balanceDue || 0), 0);
        const customerList = items.map((s) => `${s.customerLabel}: ₹${s.balanceDue} (${s.receiptNumber})`).join(', ');
        return {
          summary: `Found ${res.total} credit (Udhar) invoices totaling ₹${totalPending.toFixed(2)} pending balance. Active balances: ${customerList}.`,
          data: { totalInvoices: res.total, totalPendingBalance: totalPending.toFixed(2), items },
        };
      },
    });

    // 15. get_inventory_overview
    this.register({
      name: 'get_inventory_overview',
      description: 'Get an overall inventory stock health and breakdown of on-hand products in the store.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async (ctx) => {
        const inv = new InventoryService(ctx.prisma);
        const health = await inv.getInventoryHealth(ctx.storeId);
        const balances = await inv.listBalances(ctx.storeId, { pageSize: 10 });
        const sampleList = balances.items.map((b: any) => `${b.name || b.productName}: ${b.quantityOnHand} ${b.stockUnit}`).join(', ');
        return {
          summary: `Total Products: ${health.totalProducts}, Low Stock: ${health.lowStockCount}, Out of Stock: ${health.stockoutCount}. Sample stock on hand: ${sampleList}.`,
          data: { health, sampleStock: balances.items },
        };
      },
    });
  }

  register(def: ToolDefinition) {
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return Array.from(this.tools.values()).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}

export const toolRegistry = new ToolRegistry();
