import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  stockAdjustmentSchema,
  successEnvelope,
  errorEnvelope,
} from '@dukaanai/shared';
import { InventoryService } from './inventory.service.js';

export function createInventoryRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = new InventoryService(prisma);

  // Middleware: Require store context
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.storeId) {
      return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid store session is required.', res.locals.requestId));
    }
    next();
  });

  // Low-Stock Items query (for Dev 4 AI Employee & proactive reordering)
  router.get('/inventory/low-stock', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await service.getLowStock(req.auth!.storeId);
      res.json(successEnvelope(items, res.locals.requestId));
    } catch (err) {
      next(err);
    }
  });

  // List Inventory Balances
  router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, categoryId, lowStockOnly, page, pageSize } = req.query;
      const result = await service.listBalances(req.auth!.storeId, {
        search: typeof search === 'string' ? search : undefined,
        categoryId: typeof categoryId === 'string' ? categoryId : undefined,
        lowStockOnly: lowStockOnly === 'true',
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      });
      res.json({
        data: result.items,
        meta: {
          requestId: res.locals.requestId,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Single Product Balance
  router.get('/inventory/:productId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = String(req.params.productId);
      const balance = await service.getProductBalance(req.auth!.storeId, productId);
      res.json(successEnvelope(balance, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Movement Ledger History
  router.get('/inventory/:productId/movements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = String(req.params.productId);
      const { page, pageSize } = req.query;
      const result = await service.getMovements(req.auth!.storeId, productId, {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      });
      res.json({
        data: result.movements,
        meta: {
          requestId: res.locals.requestId,
          pagination: result.pagination,
        },
      });
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Manual Stock Adjustment
  router.post('/inventory/adjustments', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = stockAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid stock adjustment data.', res.locals.requestId, parsed.error.issues));
    }
    try {
      const result = await service.adjustToPhysicalCount(
        req.auth!.storeId,
        parsed.data,
        req.auth!.userId
      );
      res.json(successEnvelope(result, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      if (err.status === 400) {
        return res.status(400).json(errorEnvelope('VALIDATION_ERROR', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  return router;
}
