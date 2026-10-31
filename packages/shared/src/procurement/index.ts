import { z } from 'zod';

export const quoteStatuses = ['RECEIVED', 'ACCEPTED_FOR_ORDER', 'REJECTED', 'EXPIRED', 'SUPERSEDED'] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteSources = ['MANUAL', 'MOCK_PORTAL', 'VOICE_CALL', 'WHATSAPP', 'EMAIL', 'API'] as const;
export type QuoteSource = (typeof quoteSources)[number];

export const purchaseOrderStatuses = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'EXCEPTION',
  'CANCELLED',
] as const;
export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number];

export const allowedPoTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SUBMITTED', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  SUBMITTED: ['ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'EXCEPTION', 'CANCELLED'],
  ACKNOWLEDGED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'EXCEPTION', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'EXCEPTION', 'CANCELLED'],
  RECEIVED: [],
  EXCEPTION: ['ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  CANCELLED: [],
};

export const goodsReceiptStatuses = ['DRAFT', 'PENDING_VERIFICATION', 'CONFIRMED', 'CANCELLED'] as const;
export type GoodsReceiptStatus = (typeof goodsReceiptStatuses)[number];

// --- Quote Request ---
export const createQuoteRequestItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  requestedQuantityInPurchasePacks: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) > 0, 'Quantity must be > 0'),
  requestedPurchaseUnitLabel: z.string().min(1),
  unitsPerPackSnapshot: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) > 0, 'Conversion must be > 0'),
  notes: z.string().max(300).optional(),
});

export const createQuoteRequestSchema = z.object({
  supplierIds: z.array(z.string().min(1)).min(1, 'Select at least one supplier'),
  items: z.array(createQuoteRequestItemSchema).min(1, 'Add at least one product to the quote request'),
  notes: z.string().max(500).optional(),
});
export type CreateQuoteRequestInput = z.infer<typeof createQuoteRequestSchema>;

// --- Supplier Quote ---
export const recordSupplierQuoteItemSchema = z.object({
  productId: z.string().min(1),
  quotedProductNameSnapshot: z.string().min(1),
  supplierSkuSnapshot: z.string().max(80).optional(),
  quotedQuantityInPurchasePacks: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) > 0),
  purchaseUnitLabelSnapshot: z.string().min(1),
  unitsPerPackSnapshot: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) > 0),
  unitPricePerPurchasePack: z.string().regex(/^\d+(\.\d{1,2})?$/).refine(v => Number(v) >= 0),
  lineDiscount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  freeStockUnits: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0.000'),
  isAvailable: z.boolean().default(true),
});

export const recordSupplierQuoteSchema = z.object({
  supplierId: z.string().min(1),
  quoteRequestId: z.string().optional(),
  quoteReference: z.string().max(80).optional(),
  source: z.enum(quoteSources).default('MANUAL'),
  sourceReference: z.string().max(120).optional(),
  deliveryCharge: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  otherCharges: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  leadTimeDays: z.number().int().nonnegative().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(recordSupplierQuoteItemSchema).min(1, 'Quote must have at least one line item'),
});
export type RecordSupplierQuoteInput = z.infer<typeof recordSupplierQuoteSchema>;

export const compareQuotesSchema = z.object({
  quoteIds: z.array(z.string().min(1)).min(1, 'Provide at least one quote to compare'),
  productId: z.string().optional(),
});
export type CompareQuotesInput = z.infer<typeof compareQuotesSchema>;

export interface QuoteComparisonLine {
  quoteId: string;
  quoteReference?: string | null;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  quotedQuantityInPurchasePacks: string;
  purchaseUnitLabel: string;
  unitsPerPack: string;
  quotedPricePerPack: string;
  totalStockUnits: string;
  totalLineCost: string;
  allocatedCharges: string;
  effectiveCostPerStockUnit: string; // Normalised benchmark
  moqInPacks: string;
  isMoqMet: boolean;
  leadTimeDays?: number | null;
  isAvailable: boolean;
  isExpired: boolean;
  isIncomplete: boolean;
  assumptions: string[];
}

export interface QuoteComparisonSummary {
  lines: QuoteComparisonLine[];
  recommendedQuoteId?: string | null;
  recommendationReason: string;
}

// --- Purchase Order ---
export const createPurchaseOrderItemSchema = z.object({
  productId: z.string().min(1),
  supplierProductId: z.string().optional(),
  quantityInPurchasePacks: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) > 0, 'Quantity must be > 0'),
  unitPricePerPurchasePack: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), // Backend will re-verify against quote/supplier product
});

export const createPurchaseOrderDraftSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  supplierQuoteId: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  paymentTerms: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional(),
  items: z.array(createPurchaseOrderItemSchema).min(1, 'Add at least one item to draft order'),
});
export type CreatePurchaseOrderDraftInput = z.infer<typeof createPurchaseOrderDraftSchema>;

export const approvePurchaseOrderSchema = z.object({
  expectedRevision: z.number().int().positive('Expected revision is required for safe approval'),
  decisionNote: z.string().trim().min(3, 'Decision note is required for auditability').max(500),
});
export type ApprovePurchaseOrderInput = z.infer<typeof approvePurchaseOrderSchema>;

export const rejectPurchaseOrderSchema = z.object({
  expectedRevision: z.number().int().positive('Expected revision is required'),
  reason: z.string().trim().min(3, 'Rejection reason is required').max(500),
});
export type RejectPurchaseOrderInput = z.infer<typeof rejectPurchaseOrderSchema>;

export const submitPurchaseOrderSchema = z.object({
  expectedRevision: z.number().int().positive('Expected revision is required'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required for order submission').max(100),
  submissionChannel: z.enum(['MOCK_PORTAL', 'MANUAL', 'SIMULATED_VOICE', 'WHATSAPP']).default('MOCK_PORTAL'),
});
export type SubmitPurchaseOrderInput = z.infer<typeof submitPurchaseOrderSchema>;

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
});
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;

// --- Goods Receipt ---
export const receiveItemLineSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  productId: z.string().min(1),
  deliveredQuantityInPurchasePacks: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) >= 0),
  acceptedQuantityInStockUnits: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v => Number(v) >= 0),
  damagedQuantityInStockUnits: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0.000'),
  rejectedQuantityInStockUnits: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0.000'),
  shortQuantityInStockUnits: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0.000'),
  excessQuantityInStockUnits: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0.000'),
  discrepancyReason: z.string().max(300).optional(),
  condition: z.string().max(100).optional(),
  notes: z.string().max(300).optional(),
});

export const createGoodsReceiptDraftSchema = z.object({
  deliveryNoteReference: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(receiveItemLineSchema).min(1, 'Receipt must have at least one line item'),
});
export type CreateGoodsReceiptDraftInput = z.infer<typeof createGoodsReceiptDraftSchema>;

export const confirmGoodsReceiptSchema = z.object({
  idempotencyKey: z.string().min(1, 'Idempotency key required for receipt confirmation').max(100),
  verificationNote: z.string().max(500).optional(),
});
export type ConfirmGoodsReceiptInput = z.infer<typeof confirmGoodsReceiptSchema>;

// --- Invoice Reconciliation ---
export const attachInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(80),
  invoiceDate: z.string().datetime(),
  totalInvoicedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  fileReference: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  lineItems: z.array(z.object({
    productId: z.string().min(1),
    invoicedPacks: z.string().regex(/^\d+(\.\d{1,3})?$/),
    invoicedPricePerPack: z.string().regex(/^\d+(\.\d{1,2})?$/),
    invoicedTotal: z.string().regex(/^\d+(\.\d{1,2})?$/),
  })).optional(),
});
export type AttachInvoiceInput = z.infer<typeof attachInvoiceSchema>;

export interface ReconciliationReport {
  purchaseOrderId: string;
  orderNumber: string;
  supplierName: string;
  orderStatus: PurchaseOrderStatus;
  hasInvoice: boolean;
  invoiceNumber?: string | null;
  items: {
    productId: string;
    productName: string;
    orderedPacks: string;
    orderedStockUnits: string;
    orderedPricePerPack: string;
    receivedStockUnits: string;
    acceptedStockUnits: string;
    damagedStockUnits: string;
    invoicedPacks?: string | null;
    invoicedPricePerPack?: string | null;
    priceMismatch: boolean;
    quantityMismatch: boolean;
    discrepancyNotes?: string | null;
  }[];
  isFullyReconciled: boolean;
  warnings: string[];
}

export interface ProcurementAnalyticsSummary {
  dataAvailable: boolean;
  openPurchaseOrders: number;
  overdueDeliveries: number;
  pendingApprovals: number;
  recentDeliveriesCount: number;
  totalProcurementSpentMonth: string;
}
