import { randomUUID } from 'node:crypto';
import type {
  QuoteStatus,
  QuoteSource,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  AttachInvoiceInput,
} from '@dukaanai/shared';

export interface StoredQuoteRequestItem {
  id: string;
  quoteRequestId: string;
  productId: string;
  productName: string;
  requestedQuantityInPurchasePacks: string;
  requestedPurchaseUnitLabel: string;
  unitsPerPackSnapshot: string;
  notes?: string | null;
}

export interface StoredQuoteRequest {
  id: string;
  storeId: string;
  requestNumber: string;
  supplierIds: string[];
  status: string;
  requestedById: string;
  notes?: string | null;
  items: StoredQuoteRequestItem[];
  createdAt: string;
  sentAt: string;
}

export interface StoredSupplierQuoteItem {
  id: string;
  supplierQuoteId: string;
  productId: string;
  quotedProductNameSnapshot: string;
  supplierSkuSnapshot?: string | null;
  quotedQuantityInPurchasePacks: string;
  purchaseUnitLabelSnapshot: string;
  unitsPerPackSnapshot: string;
  unitPricePerPurchasePack: string;
  lineDiscount: string;
  freeStockUnits: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface StoredSupplierQuote {
  id: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  quoteRequestId?: string | null;
  quoteReference?: string | null;
  status: QuoteStatus;
  source: QuoteSource;
  sourceReference?: string | null;
  deliveryCharge: string;
  otherCharges: string;
  discountAmount: string;
  quotedAt: string;
  validUntil?: string | null;
  expectedDeliveryDate?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  items: StoredSupplierQuoteItem[];
  createdAt: string;
}

export interface StoredPurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productNameSnapshot: string;
  supplierSkuSnapshot?: string | null;
  orderedQuantityInPurchasePacks: string;
  purchaseUnitLabelSnapshot: string;
  unitsPerPackSnapshot: string;
  orderedQuantityInStockUnits: string;
  unitPricePerPurchasePack: string;
  lineDiscount: string;
  lineTotal: string;
  receivedQuantityInStockUnits: string;
}

export interface StoredPurchaseOrder {
  id: string;
  storeId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierQuoteId?: string | null;
  status: PurchaseOrderStatus;
  revision: number;
  currency: string;
  subtotal: string;
  discountTotal: string;
  chargesTotal: string;
  estimatedTotal: string;
  expectedDeliveryDate?: string | null;
  paymentTermsSnapshot?: string | null;
  notes?: string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  supplierReference?: string | null;
  acknowledgedAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  idempotencyKey?: string | null;
  items: StoredPurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredGoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  productId: string;
  deliveredQuantityInPurchasePacks: string;
  acceptedQuantityInStockUnits: string;
  damagedQuantityInStockUnits: string;
  rejectedQuantityInStockUnits: string;
  shortQuantityInStockUnits: string;
  excessQuantityInStockUnits: string;
  purchaseUnitLabelSnapshot: string;
  unitsPerPackSnapshot: string;
  discrepancyReason?: string | null;
  condition?: string | null;
  notes?: string | null;
}

export interface StoredGoodsReceipt {
  id: string;
  storeId: string;
  purchaseOrderId: string;
  receiptNumber: string;
  status: GoodsReceiptStatus;
  deliveredAt: string;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  deliveryNoteReference?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  items: StoredGoodsReceiptItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredInvoiceAttachment {
  id: string;
  storeId: string;
  purchaseOrderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalInvoicedAmount: string;
  fileReference?: string | null;
  notes?: string | null;
  lineItems?: Array<{
    productId: string;
    invoicedPacks: string;
    invoicedPricePerPack: string;
    invoicedTotal: string;
  }>;
  createdAt: string;
}

export class ProcurementRepository {
  private quoteRequests: Map<string, StoredQuoteRequest> = new Map();
  private supplierQuotes: Map<string, StoredSupplierQuote> = new Map();
  private purchaseOrders: Map<string, StoredPurchaseOrder> = new Map();
  private goodsReceipts: Map<string, StoredGoodsReceipt> = new Map();
  private invoices: Map<string, StoredInvoiceAttachment> = new Map();
  private orderCounter = 1000;
  private receiptCounter = 1000;
  private requestCounter = 1000;

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    // 1. Seed Quote Request for low-stock biscuits
    const qr1: StoredQuoteRequest = {
      id: 'qr_101',
      storeId: 'demo-store',
      requestNumber: 'QR-2026-0001',
      supplierIds: ['sup_metro', 'sup_anand'],
      status: 'PARTIALLY_RESPONDED',
      requestedById: 'demo-owner',
      notes: 'Weekly kirana replenishment for tea biscuits and tea stalls.',
      createdAt: new Date('2026-10-30T09:00:00Z').toISOString(),
      sentAt: new Date('2026-10-30T09:00:00Z').toISOString(),
      items: [
        {
          id: 'qri_101',
          quoteRequestId: 'qr_101',
          productId: 'prod_101',
          productName: 'Parle-G Biscuit 250g',
          requestedQuantityInPurchasePacks: '3.000',
          requestedPurchaseUnitLabel: 'carton',
          unitsPerPackSnapshot: '24.000',
          notes: 'Standard red packet packaging',
        },
      ],
    };
    this.quoteRequests.set(qr1.id, qr1);

    // 2. Seed Quote 1 from Metro Cash & Carry (Initial offer)
    const sq1: StoredSupplierQuote = {
      id: 'quote_metro_1',
      storeId: 'demo-store',
      supplierId: 'sup_metro',
      supplierName: 'Metro Cash & Carry - Mumbai Central',
      quoteRequestId: 'qr_101',
      quoteReference: 'METRO-Q-8891',
      status: 'RECEIVED',
      source: 'MOCK_PORTAL',
      sourceReference: 'PORTAL-SESSION-2026',
      deliveryCharge: '0.00',
      otherCharges: '0.00',
      discountAmount: '0.00',
      quotedAt: new Date('2026-10-30T10:15:00Z').toISOString(),
      validUntil: new Date('2026-11-05T23:59:59Z').toISOString(),
      expectedDeliveryDate: new Date('2026-11-02T18:00:00Z').toISOString(),
      leadTimeDays: 2,
      notes: 'Standard portal quotation for registered kirana retailers.',
      createdAt: new Date('2026-10-30T10:15:00Z').toISOString(),
      items: [
        {
          id: 'sqi_101',
          supplierQuoteId: 'quote_metro_1',
          productId: 'prod_101',
          quotedProductNameSnapshot: 'Parle-G Biscuit 250g',
          supplierSkuSnapshot: 'METRO-PARLE-G-250',
          quotedQuantityInPurchasePacks: '3.000',
          purchaseUnitLabelSnapshot: 'carton',
          unitsPerPackSnapshot: '24.000',
          unitPricePerPurchasePack: '216.00', // ₹9.00 / stock unit
          lineDiscount: '0.00',
          freeStockUnits: '0.000',
          isAvailable: true,
          createdAt: new Date('2026-10-30T10:15:00Z').toISOString(),
        },
      ],
    };

    // 3. Seed Quote 2 from Anand Agencies
    const sq2: StoredSupplierQuote = {
      id: 'quote_anand_1',
      storeId: 'demo-store',
      supplierId: 'sup_anand',
      supplierName: 'Anand Agencies (FMCG Wholesaler)',
      quoteRequestId: 'qr_101',
      quoteReference: 'ANAND-QT-512',
      status: 'RECEIVED',
      source: 'MANUAL',
      sourceReference: 'PHONE-CALL-NOTE',
      deliveryCharge: '20.00',
      otherCharges: '0.00',
      discountAmount: '0.00',
      quotedAt: new Date('2026-10-30T11:00:00Z').toISOString(),
      validUntil: new Date('2026-11-03T23:59:59Z').toISOString(),
      expectedDeliveryDate: new Date('2026-11-01T14:00:00Z').toISOString(),
      leadTimeDays: 1,
      notes: 'Delivered directly by local auto-rickshaw courier.',
      createdAt: new Date('2026-10-30T11:00:00Z').toISOString(),
      items: [
        {
          id: 'sqi_102',
          supplierQuoteId: 'quote_anand_1',
          productId: 'prod_101',
          quotedProductNameSnapshot: 'Parle-G Biscuit 250g',
          supplierSkuSnapshot: 'ANAND-PARLE-BX',
          quotedQuantityInPurchasePacks: '6.000', // 6 boxes of 12 = 72 units
          purchaseUnitLabelSnapshot: 'box',
          unitsPerPackSnapshot: '12.000',
          unitPricePerPurchasePack: '114.00', // ₹9.50 / stock unit
          lineDiscount: '0.00',
          freeStockUnits: '0.000',
          isAvailable: true,
          createdAt: new Date('2026-10-30T11:00:00Z').toISOString(),
        },
      ],
    };

    this.supplierQuotes.set(sq1.id, sq1);
    this.supplierQuotes.set(sq2.id, sq2);

    // 4. Seed an outstanding approved PO for Fortune Sunlite Sunflower Oil to demo Goods Receipt
    const po1: StoredPurchaseOrder = {
      id: 'po_demo_sample',
      storeId: 'demo-store',
      orderNumber: 'PO-2026-1001',
      supplierId: 'sup_metro',
      supplierName: 'Metro Cash & Carry - Mumbai Central',
      supplierQuoteId: null,
      status: 'SUBMITTED',
      revision: 1,
      currency: 'INR',
      subtotal: '2880.00',
      discountTotal: '0.00',
      chargesTotal: '0.00',
      estimatedTotal: '2880.00',
      expectedDeliveryDate: new Date('2026-10-31T18:00:00Z').toISOString(),
      paymentTermsSnapshot: '7_DAYS',
      notes: 'Replenishment for sunflower cooking oil.',
      createdById: 'demo-owner',
      approvedById: 'demo-owner',
      approvedAt: new Date('2026-10-29T14:00:00Z').toISOString(),
      approvalNote: 'Approved regular weekly oil purchase.',
      rejectionReason: null,
      submittedAt: new Date('2026-10-29T14:30:00Z').toISOString(),
      supplierReference: 'METRO-ORD-99014',
      acknowledgedAt: new Date('2026-10-29T15:00:00Z').toISOString(),
      receivedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      idempotencyKey: 'submit-demo-1001',
      createdAt: new Date('2026-10-29T12:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-29T15:00:00Z').toISOString(),
      items: [
        {
          id: 'poi_101',
          purchaseOrderId: 'po_demo_sample',
          productId: 'prod_102',
          productNameSnapshot: 'Fortune Sunlite Sunflower Oil 1L',
          supplierSkuSnapshot: 'METRO-OIL-1L-CASE',
          orderedQuantityInPurchasePacks: '2.000',
          purchaseUnitLabelSnapshot: 'carton',
          unitsPerPackSnapshot: '12.000',
          orderedQuantityInStockUnits: '24.000',
          unitPricePerPurchasePack: '1440.00',
          lineDiscount: '0.00',
          lineTotal: '2880.00',
          receivedQuantityInStockUnits: '0.000',
        },
      ],
    };

    this.purchaseOrders.set(po1.id, po1);
  }

  // Quote Requests
  async createQuoteRequest(
    storeId: string,
    requestedById: string,
    data: { supplierIds: string[]; notes?: string; items: Array<Omit<StoredQuoteRequestItem, 'id' | 'quoteRequestId'>> }
  ): Promise<StoredQuoteRequest> {
    const id = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const requestNumber = `QR-2026-${++this.requestCounter}`;
    const now = new Date().toISOString();

    const items: StoredQuoteRequestItem[] = data.items.map((it, idx) => ({
      id: `qri_${Date.now()}_${idx}`,
      quoteRequestId: id,
      ...it,
    }));

    const record: StoredQuoteRequest = {
      id,
      storeId,
      requestNumber,
      supplierIds: data.supplierIds,
      status: 'SENT',
      requestedById,
      notes: data.notes ?? null,
      items,
      createdAt: now,
      sentAt: now,
    };

    this.quoteRequests.set(id, record);
    return record;
  }

  async findQuoteRequests(storeId: string) {
    return Array.from(this.quoteRequests.values())
      .filter(qr => qr.storeId === storeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findQuoteRequestById(storeId: string, id: string): Promise<StoredQuoteRequest | null> {
    const qr = this.quoteRequests.get(id);
    if (!qr || qr.storeId !== storeId) return null;
    return qr;
  }

  // Supplier Quotes
  async recordSupplierQuote(
    storeId: string,
    supplierName: string,
    data: Omit<StoredSupplierQuote, 'id' | 'storeId' | 'supplierName' | 'createdAt' | 'items' | 'status'> & {
      items: Array<Omit<StoredSupplierQuoteItem, 'id' | 'supplierQuoteId' | 'createdAt'>>;
    }
  ): Promise<StoredSupplierQuote> {
    const id = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const items: StoredSupplierQuoteItem[] = data.items.map((it, idx) => ({
      id: `sqi_${Date.now()}_${idx}`,
      supplierQuoteId: id,
      ...it,
      createdAt: now,
    }));

    const quote: StoredSupplierQuote = {
      ...data,
      id,
      storeId,
      supplierName,
      status: 'RECEIVED',
      items,
      createdAt: now,
    };

    this.supplierQuotes.set(id, quote);
    return quote;
  }

  async findQuotes(storeId: string, supplierId?: string, productId?: string): Promise<StoredSupplierQuote[]> {
    return Array.from(this.supplierQuotes.values())
      .filter(q => {
        if (q.storeId !== storeId) return false;
        if (supplierId && q.supplierId !== supplierId) return false;
        if (productId && !q.items.some(it => it.productId === productId)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findQuoteById(storeId: string, id: string): Promise<StoredSupplierQuote | null> {
    const q = this.supplierQuotes.get(id);
    if (!q || q.storeId !== storeId) return null;
    return q;
  }

  // Purchase Orders
  async createPurchaseOrder(
    storeId: string,
    createdById: string,
    supplierId: string,
    supplierName: string,
    supplierQuoteId: string | null,
    expectedDeliveryDate: string | null,
    paymentTerms: string | null,
    notes: string | null,
    itemsData: Array<{
      productId: string;
      productName: string;
      supplierSku?: string | null;
      quantityInPurchasePacks: string;
      purchaseUnitLabel: string;
      unitsPerPack: string;
      unitPricePerPurchasePack: string;
      lineDiscount?: string;
    }>
  ): Promise<StoredPurchaseOrder> {
    const id = `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = `PO-2026-${++this.orderCounter}`;
    const now = new Date().toISOString();

    let subtotalNum = 0;
    let discountNum = 0;

    const items: StoredPurchaseOrderItem[] = itemsData.map((item, idx) => {
      const packs = parseFloat(item.quantityInPurchasePacks) || 0;
      const unitsPerPack = parseFloat(item.unitsPerPack) || 1;
      const price = parseFloat(item.unitPricePerPurchasePack) || 0;
      const discount = parseFloat(item.lineDiscount ?? '0') || 0;

      const orderedStockUnits = packs * unitsPerPack;
      const lineTotal = Math.max(0, packs * price - discount);

      subtotalNum += packs * price;
      discountNum += discount;

      return {
        id: `poi_${Date.now()}_${idx}`,
        purchaseOrderId: id,
        productId: item.productId,
        productNameSnapshot: item.productName,
        supplierSkuSnapshot: item.supplierSku ?? null,
        orderedQuantityInPurchasePacks: packs.toFixed(3),
        purchaseUnitLabelSnapshot: item.purchaseUnitLabel,
        unitsPerPackSnapshot: unitsPerPack.toFixed(3),
        orderedQuantityInStockUnits: orderedStockUnits.toFixed(3),
        unitPricePerPurchasePack: price.toFixed(2),
        lineDiscount: discount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        receivedQuantityInStockUnits: '0.000',
      };
    });

    const chargesTotal = '0.00';
    const estimatedTotal = (subtotalNum - discountNum).toFixed(2);

    const po: StoredPurchaseOrder = {
      id,
      storeId,
      orderNumber,
      supplierId,
      supplierName,
      supplierQuoteId,
      status: 'DRAFT',
      revision: 1,
      currency: 'INR',
      subtotal: subtotalNum.toFixed(2),
      discountTotal: discountNum.toFixed(2),
      chargesTotal,
      estimatedTotal,
      expectedDeliveryDate,
      paymentTermsSnapshot: paymentTerms,
      notes,
      createdById,
      approvedById: null,
      approvedAt: null,
      approvalNote: null,
      rejectionReason: null,
      submittedAt: null,
      supplierReference: null,
      acknowledgedAt: null,
      receivedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      idempotencyKey: null,
      items,
      createdAt: now,
      updatedAt: now,
    };

    this.purchaseOrders.set(id, po);
    return po;
  }

  async findPurchaseOrders(storeId: string, status?: PurchaseOrderStatus, supplierId?: string): Promise<StoredPurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values())
      .filter(po => {
        if (po.storeId !== storeId) return false;
        if (status && po.status !== status) return false;
        if (supplierId && po.supplierId !== supplierId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findPurchaseOrderById(storeId: string, id: string): Promise<StoredPurchaseOrder | null> {
    const po = this.purchaseOrders.get(id);
    if (!po || po.storeId !== storeId) return null;
    return po;
  }

  async updatePurchaseOrder(storeId: string, id: string, updates: Partial<StoredPurchaseOrder>): Promise<StoredPurchaseOrder | null> {
    const po = await this.findPurchaseOrderById(storeId, id);
    if (!po) return null;
    const updated: StoredPurchaseOrder = {
      ...po,
      ...updates,
      id: po.id,
      storeId: po.storeId,
      updatedAt: new Date().toISOString(),
    };
    this.purchaseOrders.set(id, updated);
    return updated;
  }

  // Goods Receipts
  async createGoodsReceiptDraft(
    storeId: string,
    purchaseOrderId: string,
    deliveryNoteReference?: string,
    notes?: string
  ): Promise<StoredGoodsReceipt> {
    const id = `gr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const receiptNumber = `GR-2026-${++this.receiptCounter}`;
    const now = new Date().toISOString();

    const gr: StoredGoodsReceipt = {
      id,
      storeId,
      purchaseOrderId,
      receiptNumber,
      status: 'DRAFT',
      deliveredAt: now,
      verifiedAt: null,
      verifiedById: null,
      deliveryNoteReference: deliveryNoteReference ?? null,
      notes: notes ?? null,
      idempotencyKey: null,
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    this.goodsReceipts.set(id, gr);
    return gr;
  }

  async findGoodsReceiptById(storeId: string, id: string): Promise<StoredGoodsReceipt | null> {
    const gr = this.goodsReceipts.get(id);
    if (!gr || gr.storeId !== storeId) return null;
    return gr;
  }

  async findGoodsReceiptsForPO(storeId: string, purchaseOrderId: string): Promise<StoredGoodsReceipt[]> {
    return Array.from(this.goodsReceipts.values()).filter(
      gr => gr.storeId === storeId && gr.purchaseOrderId === purchaseOrderId
    );
  }

  async updateGoodsReceipt(storeId: string, id: string, updates: Partial<StoredGoodsReceipt>): Promise<StoredGoodsReceipt | null> {
    const gr = await this.findGoodsReceiptById(storeId, id);
    if (!gr) return null;
    const updated: StoredGoodsReceipt = {
      ...gr,
      ...updates,
      id: gr.id,
      storeId: gr.storeId,
      updatedAt: new Date().toISOString(),
    };
    this.goodsReceipts.set(id, updated);
    return updated;
  }

  // Invoices
  async attachInvoice(storeId: string, purchaseOrderId: string, input: AttachInvoiceInput): Promise<StoredInvoiceAttachment> {
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const inv: StoredInvoiceAttachment = {
      id,
      storeId,
      purchaseOrderId,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      totalInvoicedAmount: input.totalInvoicedAmount,
      fileReference: input.fileReference ?? null,
      notes: input.notes ?? null,
      lineItems: input.lineItems,
      createdAt: new Date().toISOString(),
    };
    this.invoices.set(id, inv);
    return inv;
  }

  async findInvoicesForPO(storeId: string, purchaseOrderId: string): Promise<StoredInvoiceAttachment[]> {
    return Array.from(this.invoices.values()).filter(
      inv => inv.storeId === storeId && inv.purchaseOrderId === purchaseOrderId
    );
  }
}

export const procurementRepository = new ProcurementRepository();
