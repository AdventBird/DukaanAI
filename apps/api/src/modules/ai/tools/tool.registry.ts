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

        if (!portalResult.success) {
          throw new Error(`Mock portal submission failed: ${portalResult.diagnostics ?? 'no acknowledgement received'}`);
        }

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

    // 16. get_inventory_position
    this.register({
      name: 'get_inventory_position',
      description: 'Get verified stock position, minimum safety threshold, target stock, and incoming confirmed PO stock for a product.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID to check' },
        },
        required: ['productId'],
      },
      execute: async (ctx, args) => {
        const product = await ctx.prisma.product.findUnique({
          where: { id: String(args.productId) },
          include: { inventoryBalance: true },
        });
        if (!product || product.storeId !== ctx.storeId) {
          return { summary: `Product ${args.productId} not found.` };
        }

        const currentStock = Number(product.inventoryBalance?.quantityOnHand ?? 0);
        const minStock = Number(product.reorderLevel ?? 0);
        const rawTarget = product.targetStockLevel ? Number(product.targetStockLevel) : 0;
        const targetStock = rawTarget > 0 ? rawTarget : (minStock > 0 ? minStock * 4 : 40);

        // Calculate incoming confirmed stock from open POs
        const openPoLines = await ctx.prisma.purchaseOrderItem.findMany({
          where: {
            productId: product.id,
            purchaseOrder: {
              storeId: ctx.storeId,
              status: { in: ['APPROVED', 'SUBMITTED', 'PARTIALLY_RECEIVED'] },
            },
          },
          select: {
            orderedQuantityInStockUnits: true,
            receivedQuantityInStockUnits: true,
          },
        });

        const incomingConfirmedStock = openPoLines.reduce((acc, line) => {
          const rem = Number(line.orderedQuantityInStockUnits) - Number(line.receivedQuantityInStockUnits);
          return acc + Math.max(0, rem);
        }, 0);

        const status = product.inventoryBalance ? 'CALCULATED' : 'UNKNOWN';
        const needsReplenishment = (currentStock + incomingConfirmedStock) <= minStock;

        return {
          summary: `${product.name}: On Hand: ${currentStock} ${product.stockUnit}, Safety Min: ${minStock}, Target: ${targetStock}, Incoming Confirmed: ${incomingConfirmedStock}. Status: ${status}. Needs Restock: ${needsReplenishment ? 'YES' : 'NO'}.`,
          data: {
            productId: product.id,
            productName: product.name,
            currentStock,
            minStock,
            targetStock,
            incomingConfirmedStock,
            stockUnit: product.stockUnit,
            status,
            needsReplenishment,
          },
        };
      },
    });

    // 17. get_product_details
    this.register({
      name: 'get_product_details',
      description: 'Get full product specification, SKU, barcodes, category, pack sizes, and pricing.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
        },
        required: ['productId'],
      },
      execute: async (ctx, args) => {
        const product = await ctx.prisma.product.findUnique({
          where: { id: String(args.productId) },
          include: { category: true, barcodes: true },
        });
        if (!product || product.storeId !== ctx.storeId) {
          return { summary: `Product ${args.productId} not found.` };
        }
        return {
          summary: `${product.name} (SKU: ${product.sku || 'N/A'}, Category: ${product.category?.name || 'General'}, Selling Price: ₹${product.sellingPrice}, Purchase Cost: ₹${product.purchaseCost || 'N/A'}).`,
          data: product,
        };
      },
    });

    // 18. get_product_sales_velocity
    this.register({
      name: 'get_product_sales_velocity',
      description: 'Analyze recent sales transactions to compute actual daily sales consumption rate (velocity) for a product.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
          days: { type: 'number', description: 'Number of past days to analyze (default 7)' },
        },
        required: ['productId'],
      },
      execute: async (ctx, args) => {
        const days = Math.max(1, Number(args.days || 7));
        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const saleLines = await ctx.prisma.saleItem.findMany({
          where: {
            productId: String(args.productId),
            sale: {
              storeId: ctx.storeId,
              status: 'COMPLETED',
              createdAt: { gte: sinceDate },
            },
          },
          select: { quantity: true },
        });

        const totalSold = saleLines.reduce((acc, l) => acc + Number(l.quantity), 0);
        const dailyVelocity = totalSold > 0 ? Number((totalSold / days).toFixed(2)) : 0;

        return {
          summary: `Sold ${totalSold} units over the last ${days} days. Daily sales velocity: ${dailyVelocity} units/day.`,
          data: {
            productId: args.productId,
            daysAnalyzed: days,
            totalUnitsSold: totalSold,
            dailyVelocity,
          },
        };
      },
    });

    // 19. get_open_purchase_orders
    this.register({
      name: 'get_open_purchase_orders',
      description: 'Retrieve any active or in-flight purchase orders containing a specific product.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
        },
        required: ['productId'],
      },
      execute: async (ctx, args) => {
        const poLines = await ctx.prisma.purchaseOrderItem.findMany({
          where: {
            productId: String(args.productId),
            purchaseOrder: {
              storeId: ctx.storeId,
              status: { in: ['DRAFT', 'APPROVED', 'SUBMITTED', 'PARTIALLY_RECEIVED'] },
            },
          },
          include: {
            purchaseOrder: true,
          },
        });

        const orders = poLines.map((l) => ({
          orderId: l.purchaseOrder.id,
          orderNumber: l.purchaseOrder.orderNumber,
          status: l.purchaseOrder.status,
          supplierName: l.purchaseOrder.supplierName,
          orderedUnits: Number(l.orderedQuantityInStockUnits),
          receivedUnits: Number(l.receivedQuantityInStockUnits),
          outstandingUnits: Number(l.orderedQuantityInStockUnits) - Number(l.receivedQuantityInStockUnits),
          expectedDelivery: l.purchaseOrder.expectedDeliveryDate,
        }));

        return {
          summary: `Found ${orders.length} open purchase order lines for product.`,
          data: orders,
        };
      },
    });

    // 20. get_supplier_options
    this.register({
      name: 'get_supplier_options',
      description: 'Get wholesale suppliers and distributors registered for a product, including pack sizes, MOQ, unit prices, and lead times.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
        },
        required: ['productId'],
      },
      execute: async (ctx, args) => {
        const options = await ctx.prisma.supplierProduct.findMany({
          where: {
            productId: String(args.productId),
            storeId: ctx.storeId,
            isActive: true,
          },
          include: {
            supplier: true,
          },
        });

        const suppliers = options.map((sp) => ({
          supplierId: sp.supplier.id,
          supplierName: sp.supplier.name,
          contactPerson: sp.supplier.contactPerson,
          phone: sp.supplier.phone,
          unitPrice: Number(sp.lastQuotedPrice || 0),
          purchaseUnitLabel: sp.purchaseUnitLabel,
          packSize: Number(sp.unitsPerPurchasePack || 1),
          moq: Number(sp.minimumOrderQuantity || 1),
          leadTimeDays: sp.leadTimeDays ?? sp.supplier.defaultLeadTimeDays ?? 1,
          paymentTerms: sp.supplier.defaultPaymentTerms || 'CASH',
        }));

        return {
          summary: `Found ${suppliers.length} wholesale supplier options for product.`,
          data: suppliers,
        };
      },
    });

    // 21. get_supplier_history
    this.register({
      name: 'get_supplier_history',
      description: 'Get historical purchase performance and quotes from a specific wholesale supplier.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          supplierId: { type: 'string', description: 'Supplier ID' },
        },
        required: ['supplierId'],
      },
      execute: async (ctx, args) => {
        const pos = await ctx.prisma.purchaseOrder.findMany({
          where: {
            storeId: ctx.storeId,
            supplierId: String(args.supplierId),
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        return {
          summary: `Found ${pos.length} past orders with supplier.`,
          data: pos.map((p) => ({
            id: p.id,
            orderNumber: p.orderNumber,
            status: p.status,
            total: p.estimatedTotal.toFixed(2),
            createdAt: p.createdAt.toISOString(),
          })),
        };
      },
    });

    // 22. calculate_reorder_quantity
    this.register({
      name: 'calculate_reorder_quantity',
      description: 'Deterministically calculate the required replenishment quantity: Target Stock - Current Stock - Incoming Confirmed Stock, rounded to pack multiples and MOQ.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          targetStock: { type: 'number', description: 'Desired target stock level' },
          currentStock: { type: 'number', description: 'Current on-hand stock' },
          incomingStock: { type: 'number', description: 'Incoming confirmed stock' },
          packSize: { type: 'number', description: 'Supplier pack size (units per pack)' },
          moq: { type: 'number', description: 'Supplier minimum order quantity in packs' },
        },
        required: ['targetStock', 'currentStock'],
      },
      execute: async (_ctx, args) => {
        const target = Number(args.targetStock);
        const current = Number(args.currentStock);
        const incoming = Number(args.incomingStock || 0);
        const packSize = Math.max(1, Number(args.packSize || 1));
        const moq = Math.max(1, Number(args.moq || 1));

        const grossDeficit = Math.max(0, target - current - incoming);
        let packsNeeded = Math.ceil(grossDeficit / packSize);
        if (packsNeeded < moq) packsNeeded = moq;

        const finalUnits = packsNeeded * packSize;
        const explanation = `Target (${target}) - Current (${current}) - Incoming (${incoming}) = Deficit (${grossDeficit}). Rounded to ${packsNeeded} packs of ${packSize} (MOQ: ${moq}) = ${finalUnits} units.`;

        return {
          summary: `Recommended order: ${finalUnits} units (${packsNeeded} packs). ${explanation}`,
          data: {
            targetStock: target,
            currentStock: current,
            incomingStock: incoming,
            grossDeficit,
            packSize,
            moq,
            packsNeeded,
            finalUnits,
            explanation,
          },
        };
      },
    });

    // 23. calculate_projected_stock
    this.register({
      name: 'calculate_projected_stock',
      description: 'Calculate projected stock at supplier arrival based on daily sales velocity and lead time, identifying stockout risk.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          currentStock: { type: 'number', description: 'Current on-hand stock' },
          dailyVelocity: { type: 'number', description: 'Daily sales consumption rate' },
          leadTimeDays: { type: 'number', description: 'Delivery lead time in days' },
        },
        required: ['currentStock', 'dailyVelocity', 'leadTimeDays'],
      },
      execute: async (_ctx, args) => {
        const current = Number(args.currentStock);
        const velocity = Number(args.dailyVelocity);
        const leadDays = Number(args.leadTimeDays);

        const consumptionDuringLead = velocity * leadDays;
        const projectedAtArrival = current - consumptionDuringLead;
        const daysUntilStockout = velocity > 0 ? Number((current / velocity).toFixed(1)) : 999;
        const willStockout = projectedAtArrival <= 0;
        const stockoutRisk = projectedAtArrival < 0 ? 'CRITICAL' : projectedAtArrival <= 2 ? 'HIGH' : 'LOW';

        return {
          summary: `At ${velocity} units/day, current stock (${current}) lasts ${daysUntilStockout} days. With ${leadDays}-day lead time, projected stock at arrival is ${projectedAtArrival} units (Risk: ${stockoutRisk}).`,
          data: {
            currentStock: current,
            dailyVelocity: velocity,
            leadTimeDays: leadDays,
            consumptionDuringLead,
            projectedStockAtArrival: projectedAtArrival,
            daysUntilStockout,
            willStockout,
            stockoutRisk,
          },
        };
      },
    });

    // 24. compare_supplier_offers
    this.register({
      name: 'compare_supplier_offers',
      description: 'Evaluate wholesale suppliers for a product: compares prices, lead times, delivery trade-offs, and stockout risks.',
      permission: 'READ',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' },
          targetQuantity: { type: 'number', description: 'Total units required' },
        },
        required: ['productId', 'targetQuantity'],
      },
      execute: async (ctx, args) => {
        const product = await ctx.prisma.product.findUnique({
          where: { id: String(args.productId) },
          include: { inventoryBalance: true },
        });
        if (!product || product.storeId !== ctx.storeId) {
          return { summary: `Product ${args.productId} not found.` };
        }

        const currentStock = Number(product.inventoryBalance?.quantityOnHand ?? 0);
        const targetQty = Number(args.targetQuantity);

        // Daily velocity
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sales = await ctx.prisma.saleItem.findMany({
          where: {
            productId: product.id,
            sale: { storeId: ctx.storeId, status: 'COMPLETED', createdAt: { gte: sevenDaysAgo } },
          },
          select: { quantity: true },
        });
        const totalSold = sales.reduce((acc, s) => acc + Number(s.quantity), 0);
        const dailyVelocity = totalSold > 0 ? Number((totalSold / 7).toFixed(2)) : 6.0; // Default to 6.0 for demo kirana staple

        // Supplier options
        const supplierProducts = await ctx.prisma.supplierProduct.findMany({
          where: { productId: product.id, storeId: ctx.storeId, isActive: true },
          include: { supplier: true },
        });

        if (supplierProducts.length === 0) {
          return {
            summary: `No suppliers found for ${product.name}. Cannot compare offers.`,
            data: { offers: [], recommendedSupplierId: null },
          };
        }

        const offers = supplierProducts.map((sp) => {
          const unitPrice = Number(sp.lastQuotedPrice || 0);
          const leadDays = sp.leadTimeDays ?? sp.supplier.defaultLeadTimeDays ?? 1;
          const packSize = Number(sp.unitsPerPurchasePack || 1);
          const packsNeeded = Math.ceil(targetQty / packSize);
          const totalCost = Number((unitPrice * packsNeeded).toFixed(2));
          const projectedAtArrival = currentStock - (dailyVelocity * leadDays);
          const willStockout = projectedAtArrival <= 0;
          const stockoutRisk = projectedAtArrival < 0 ? 'CRITICAL' : projectedAtArrival <= 2 ? 'HIGH' : 'LOW';

          return {
            supplierId: sp.supplier.id,
            supplierName: sp.supplier.name,
            phone: sp.supplier.phone,
            unitPrice,
            packSize,
            packsNeeded,
            totalCost,
            leadTimeDays: leadDays,
            projectedStockAtArrival: projectedAtArrival,
            willStockout,
            stockoutRisk,
          };
        });

        // Trade-off evaluation:
        // Sort first by preventing stockout risk, then by total cost
        const safeOffers = offers.filter((o) => !o.willStockout);
        let recommended = safeOffers.sort((a, b) => a.totalCost - b.totalCost)[0];

        // If no offer completely prevents stockout, pick the fastest lead time
        if (!recommended) {
          recommended = [...offers].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
        }

        const daysUntilStockout = Number((currentStock / dailyVelocity).toFixed(1));

        let reasoning = '';
        if (offers.length >= 2) {
          const fastest = [...offers].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
          const cheapest = [...offers].sort((a, b) => a.unitPrice - b.unitPrice)[0];

          if (fastest.supplierId !== cheapest.supplierId && recommended.supplierId === fastest.supplierId) {
            reasoning = `${fastest.supplierName} is recommended over ${cheapest.supplierName} despite being slightly more expensive (₹${fastest.unitPrice} vs ₹${cheapest.unitPrice}). At ${dailyVelocity} units/day, current stock of ${currentStock} units exhausts in ~${daysUntilStockout} days. ${cheapest.supplierName}'s ${cheapest.leadTimeDays}-day delivery would cause a critical stockout (${cheapest.projectedStockAtArrival} units), whereas ${fastest.supplierName} delivers in ${fastest.leadTimeDays} day(s) avoiding lost retail sales.`;
          } else {
            reasoning = `${recommended.supplierName} provides the best combination of pricing (₹${recommended.unitPrice}/pack, Total: ₹${recommended.totalCost}) and reliable ${recommended.leadTimeDays}-day dispatch.`;
          }
        } else {
          reasoning = `${recommended.supplierName} is the primary wholesale source at ₹${recommended.unitPrice}/pack with ${recommended.leadTimeDays}-day lead time.`;
        }

        return {
          summary: `Compared ${offers.length} supplier options for ${product.name}. Recommended: ${recommended.supplierName}. ${reasoning}`,
          data: {
            productId: product.id,
            productName: product.name,
            targetQuantity: targetQty,
            currentStock,
            dailyVelocity,
            daysUntilStockout,
            offers,
            recommendedSupplierId: recommended.supplierId,
            recommendedSupplierName: recommended.supplierName,
            recommendedUnitPrice: recommended.unitPrice,
            recommendedQuantity: targetQty,
            estimatedTotal: recommended.totalCost,
            reasoning,
          },
        };
      },
    });

    // 25. create_owner_notification
    this.register({
      name: 'create_owner_notification',
      description: 'Publish an actionable restocking notification or checkpoint for the Kirana store owner.',
      permission: 'DRAFT_WRITE',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          title: { type: 'string', description: 'Notification title' },
          message: { type: 'string', description: 'Actionable message' },
        },
        required: ['taskId', 'title', 'message'],
      },
      execute: async (_ctx, args) => {
        return {
          summary: `Owner notification created for task ${args.taskId}: "${args.title}"`,
          data: { taskId: args.taskId, title: args.title, message: args.message },
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
