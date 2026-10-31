import { Router, type Request, type Response } from 'express';
import {
  createQuoteRequestSchema,
  recordSupplierQuoteSchema,
  compareQuotesSchema,
  createPurchaseOrderDraftSchema,
  approvePurchaseOrderSchema,
  rejectPurchaseOrderSchema,
  submitPurchaseOrderSchema,
  cancelPurchaseOrderSchema,
  createGoodsReceiptDraftSchema,
  confirmGoodsReceiptSchema,
  attachInvoiceSchema,
  successEnvelope,
  errorEnvelope,
} from '@dukaanai/shared';
import { procurementService } from './procurement.service.js';

export const quoteRouter = Router();
export const purchaseOrderRouter = Router();
export const goodsReceiptRouter = Router();

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0];
  return param ?? '';
};

// ==========================================
// Quote APIs
// ==========================================

// POST /api/quote-requests
quoteRouter.post('/quote-requests', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = createQuoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid quote request input.', res.locals.requestId, parsed.error.issues));
  }

  try {
    const result = await procurementService.createQuoteRequest(req.auth.storeId, req.auth.userId, parsed.data);
    res.status(201).json(successEnvelope(result, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error creating quote request', res.locals.requestId));
  }
});

// GET /api/quote-requests
quoteRouter.get('/quote-requests', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  try {
    const list = await procurementService.listQuoteRequests(req.auth.storeId);
    res.json(successEnvelope(list, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error listing quote requests', res.locals.requestId));
  }
});

// GET /api/quote-requests/:id
quoteRouter.get('/quote-requests/:id', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const id = getParam(req.params.id);
  try {
    const record = await procurementService.getQuoteRequest(req.auth.storeId, id);
    if (!record) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Quote request not found', res.locals.requestId));
    res.json(successEnvelope(record, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching quote request', res.locals.requestId));
  }
});

// POST /api/supplier-quotes
quoteRouter.post('/supplier-quotes', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = recordSupplierQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid supplier quote input.', res.locals.requestId, parsed.error.issues));
  }

  try {
    const quote = await procurementService.recordSupplierQuote(req.auth.storeId, parsed.data);
    res.status(201).json(successEnvelope(quote, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error recording supplier quote', res.locals.requestId));
  }
});

// GET /api/supplier-quotes
quoteRouter.get('/supplier-quotes', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
  const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;

  try {
    const quotes = await procurementService.listQuotes(req.auth.storeId, supplierId, productId);
    res.json(successEnvelope(quotes, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching quotes', res.locals.requestId));
  }
});

// GET /api/supplier-quotes/:id
quoteRouter.get('/supplier-quotes/:id', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const id = getParam(req.params.id);
  try {
    const quote = await procurementService.getQuote(req.auth.storeId, id);
    if (!quote) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Quote not found', res.locals.requestId));
    res.json(successEnvelope(quote, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching quote', res.locals.requestId));
  }
});

// POST /api/supplier-quotes/compare
quoteRouter.post('/supplier-quotes/compare', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = compareQuotesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid compare input.', res.locals.requestId, parsed.error.issues));
  }

  try {
    const comparison = await procurementService.compareQuotes(req.auth.storeId, parsed.data.quoteIds, parsed.data.productId);
    res.json(successEnvelope(comparison, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error comparing quotes', res.locals.requestId));
  }
});

// ==========================================
// Purchase Order APIs
// ==========================================

// POST /api/purchase-orders
purchaseOrderRouter.post('/', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = createPurchaseOrderDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid purchase order draft input.', res.locals.requestId, parsed.error.issues));
  }

  try {
    const draft = await procurementService.createPurchaseOrderDraft(req.auth.storeId, req.auth.userId, parsed.data);
    res.status(201).json(successEnvelope(draft, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error creating purchase order', res.locals.requestId));
  }
});

// GET /api/purchase-orders
purchaseOrderRouter.get('/', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const status = typeof req.query.status === 'string' ? (req.query.status as any) : undefined;
  const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;

  try {
    const orders = await procurementService.listPurchaseOrders(req.auth.storeId, status, supplierId);
    res.json(successEnvelope(orders, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching purchase orders', res.locals.requestId));
  }
});

// GET /api/purchase-orders/:id
purchaseOrderRouter.get('/:id', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const id = getParam(req.params.id);
  try {
    const order = await procurementService.getPurchaseOrder(req.auth.storeId, id);
    if (!order) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Purchase order not found.', res.locals.requestId));
    res.json(successEnvelope(order, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching purchase order', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/submit-for-approval
purchaseOrderRouter.post('/:id/submit-for-approval', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const id = getParam(req.params.id);
  try {
    const order = await procurementService.submitForApproval(req.auth.storeId, id);
    res.json(successEnvelope(order, res.locals.requestId));
  } catch (error) {
    res.status(400).json(errorEnvelope('CONFLICT', error instanceof Error ? error.message : 'Cannot submit for approval', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/approve
purchaseOrderRouter.post('/:id/approve', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = approvePurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid approval input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const order = await procurementService.approvePurchaseOrder(
      req.auth.storeId,
      id,
      req.auth.userId,
      req.auth.role,
      parsed.data
    );
    res.json(successEnvelope(order, res.locals.requestId));
  } catch (error) {
    res.status(403).json(errorEnvelope('FORBIDDEN', error instanceof Error ? error.message : 'Approval failed', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/reject
purchaseOrderRouter.post('/:id/reject', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = rejectPurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid rejection input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const order = await procurementService.rejectPurchaseOrder(
      req.auth.storeId,
      id,
      req.auth.userId,
      req.auth.role,
      parsed.data
    );
    res.json(successEnvelope(order, res.locals.requestId));
  } catch (error) {
    res.status(403).json(errorEnvelope('FORBIDDEN', error instanceof Error ? error.message : 'Rejection failed', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/submit
purchaseOrderRouter.post('/:id/submit', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = submitPurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid submit input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const order = await procurementService.submitPurchaseOrder(req.auth.storeId, id, parsed.data);
    res.json(successEnvelope(order, res.locals.requestId));
  } catch (error) {
    res.status(400).json(errorEnvelope('CONFLICT', error instanceof Error ? error.message : 'Order submission failed', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/cancel
purchaseOrderRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = cancelPurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid cancellation input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const order = await procurementService.cancelPurchaseOrder(req.auth.storeId, id, req.auth.userId, parsed.data);
    res.json(successEnvelope(order, res.locals.requestId));
  } catch (error) {
    res.status(400).json(errorEnvelope('CONFLICT', error instanceof Error ? error.message : 'Order cancellation failed', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/goods-receipts
purchaseOrderRouter.post('/:id/goods-receipts', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = createGoodsReceiptDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid goods receipt draft input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const receipt = await procurementService.createGoodsReceiptDraft(req.auth.storeId, id, parsed.data);
    res.status(201).json(successEnvelope(receipt, res.locals.requestId));
  } catch (error) {
    res.status(400).json(errorEnvelope('CONFLICT', error instanceof Error ? error.message : 'Goods receipt draft failed', res.locals.requestId));
  }
});

// POST /api/purchase-orders/:id/invoices
purchaseOrderRouter.post('/:id/invoices', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = attachInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid invoice attachment input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const invoice = await procurementService.attachInvoice(req.auth.storeId, id, parsed.data);
    res.status(201).json(successEnvelope(invoice, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to attach invoice', res.locals.requestId));
  }
});

// GET /api/purchase-orders/:id/reconciliation
purchaseOrderRouter.get('/:id/reconciliation', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const id = getParam(req.params.id);
  try {
    const report = await procurementService.getReconciliationReport(req.auth.storeId, id);
    res.json(successEnvelope(report, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to generate reconciliation report', res.locals.requestId));
  }
});

// ==========================================
// Goods Receipt APIs
// ==========================================

// POST /api/goods-receipts/:id/confirm
goodsReceiptRouter.post('/:id/confirm', async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));

  const parsed = confirmGoodsReceiptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid confirmation input.', res.locals.requestId, parsed.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const result = await procurementService.confirmGoodsReceipt(
      req.auth.storeId,
      id,
      req.auth.userId,
      req.auth.role,
      parsed.data
    );
    res.json(successEnvelope(result, res.locals.requestId));
  } catch (error) {
    res.status(403).json(errorEnvelope('FORBIDDEN', error instanceof Error ? error.message : 'Goods receipt confirmation failed', res.locals.requestId));
  }
});
