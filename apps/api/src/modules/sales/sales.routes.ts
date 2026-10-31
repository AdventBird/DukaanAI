import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createSaleSchema, errorEnvelope, successEnvelope } from '@dukaanai/shared';
import { SalesService } from './sales.service.js';

export function createSalesRouter(prisma: PrismaClient, salesService: SalesService) {
  const router = Router();

  // GET /api/sales - List sales
  router.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
    const storeId = req.auth.storeId;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const paymentMethod = typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    try {
      const result = await salesService.listSales(storeId, { page, pageSize, paymentMethod, search });
      res.json(successEnvelope(result.items, res.locals.requestId));
    } catch (error) {
      next(error);
    }
  });

  // GET /api/sales/:id - Retrieve sale details
  router.get('/sales/:id', async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
    const storeId = req.auth.storeId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);

    try {
      const sale = await salesService.getSaleById(storeId, id);
      if (!sale) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', 'Sale transaction not found.', res.locals.requestId));
      }
      res.json(successEnvelope(sale, res.locals.requestId));
    } catch (error) {
      next(error);
    }
  });

  // POST /api/sales - Record a POS sale
  router.post('/sales', async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
    const storeId = req.auth.storeId;
    const actorId = req.auth.userId;

    const raw = req.body || {};
    const normalized = {
      idempotencyKey: raw.idempotencyKey || `sale-${randomUUID()}`,
      items: Array.isArray(raw.items)
        ? raw.items.map((i: any) => ({
            productId: i.productId,
            quantity: String(i.quantity ?? ''),
            expectedSellingPrice: String(i.expectedSellingPrice ?? i.unitPrice ?? '0.00'),
          }))
        : [],
      payment: raw.payment || {
        method: raw.paymentMethod || 'CASH',
        amountTendered: raw.amountPaid ? String(raw.amountPaid) : undefined,
        reference: raw.paymentRef || undefined,
      },
      customerLabel: raw.customerLabel || undefined,
    };

    const parsed = createSaleSchema.safeParse(normalized);
    if (!parsed.success) {
      return res.status(400).json(
        errorEnvelope(
          'VALIDATION_ERROR',
          'Invalid sale transaction details.',
          res.locals.requestId,
          parsed.error.issues.map(({ path, message }) => ({ path, message }))
        )
      );
    }

    try {
      const sale = await salesService.createSale(storeId, actorId, parsed.data);
      res.status(201).json(successEnvelope(sale, res.locals.requestId));
    } catch (error: any) {
      if (error?.message?.includes('Product not found')) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', error.message, res.locals.requestId));
      }
      next(error);
    }
  });

  return router;
}
