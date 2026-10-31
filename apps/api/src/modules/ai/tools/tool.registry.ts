import type { PrismaClient } from '@prisma/client';
import type { AgentToolPermission } from '@dukaanai/shared';
import { ProductService } from '../../products/product.service.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { procurementService } from '../../procurement/procurement.service.js';
import { supplierService } from '../../suppliers/supplier.service.js';
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
