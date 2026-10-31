import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  createSaleSchema,
  successEnvelope,
  errorEnvelope,
  PaymentMethod,
} from '@dukaanai/shared';
import { SalesService } from './sales.service.js';
import type { InventoryService } from '../inventory/inventory.service.js';

export function createSalesRouter(prisma: PrismaClient, inventoryService?: InventoryService): Router {
  const router = Router();
  const service = new SalesService(prisma, inventoryService);

  // Require store session
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.storeId) {
      return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid store session is required.', res.locals.requestId));
    }
    next();
  });

  // Create Sale / Checkout
  router.post('/sales', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = createSaleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(
        errorEnvelope(
          'VALIDATION_ERROR',
          parsed.error.issues[0]?.message || 'Invalid sale checkout payload.',
          res.locals.requestId,
          parsed.error.issues
        )
      );
    }

    try {
      const sale = await service.createSale(req.auth!.storeId, parsed.data, req.auth!.userId);
      res.status(201).json(successEnvelope(sale, res.locals.requestId));
    } catch (err: any) {
      if (err.code === 'PRICE_CHANGED') {
        return res.status(409).json(
          errorEnvelope('PRICE_CHANGED', err.message, res.locals.requestId, err.details)
        );
      }
      if (err.code === 'INSUFFICIENT_STOCK') {
        return res.status(409).json(
          errorEnvelope('INSUFFICIENT_STOCK', err.message, res.locals.requestId, err.details)
        );
      }
      if (err.code === 'PRODUCT_NOT_FOUND') {
        return res.status(404).json(
          errorEnvelope('PRODUCT_NOT_FOUND', err.message, res.locals.requestId, err.details)
        );
      }
      if (err.status && err.status < 500) {
        return res.status(err.status).json(
          errorEnvelope(err.code || 'VALIDATION_ERROR', err.message, res.locals.requestId, err.details)
        );
      }
      next(err);
    }
  });

  // List Sales History
  router.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, search, paymentMethod, from, to } = req.query;
      const result = await service.listSales(req.auth!.storeId, {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
        search: typeof search === 'string' ? search : undefined,
        paymentMethod: typeof paymentMethod === 'string' ? (paymentMethod as PaymentMethod) : undefined,
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
      });

      res.json({
        data: result.sales,
        meta: {
          requestId: res.locals.requestId,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Get Sale Details & Receipt Snapshot
  router.get('/sales/:saleId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saleId = String(req.params.saleId);
      const sale = await service.getSaleById(req.auth!.storeId, saleId);
      res.json(successEnvelope(sale, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404 || err.code === 'NOT_FOUND') {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  return router;
}
