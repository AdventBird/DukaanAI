import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  createProductSchema,
  updateProductSchema,
  addBarcodeSchema,
  createCategorySchema,
  successEnvelope,
  errorEnvelope,
} from '@dukaanai/shared';
import { ProductService } from './product.service.js';

export function createProductRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = new ProductService(prisma);

  // Middleware: Require store context
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.storeId) {
      return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid store session is required.', res.locals.requestId));
    }
    next();
  });

  // Category endpoints
  router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await service.listCategories(req.auth!.storeId);
      res.json(successEnvelope(categories, res.locals.requestId));
    } catch (err) {
      next(err);
    }
  });

  router.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid category input.', res.locals.requestId, parsed.error.issues));
    }
    try {
      const category = await service.createCategory(req.auth!.storeId, parsed.data.name);
      res.status(201).json(successEnvelope(category, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 409) {
        return res.status(409).json(errorEnvelope('CONFLICT', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Fast Barcode Lookup for Dev 2 POS
  router.get('/products/barcode/:barcode', async (req: Request, res: Response, next: NextFunction) => {
    const barcode = String(req.params.barcode || '');
    if (!barcode) {
      return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Barcode string is required.', res.locals.requestId));
    }
    try {
      const item = await service.lookupBarcode(req.auth!.storeId, barcode);
      res.json(successEnvelope(item, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Product List & Search
  router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, categoryId, isActive, page, pageSize } = req.query;
      const result = await service.listProducts(req.auth!.storeId, {
        search: typeof search === 'string' ? search : undefined,
        categoryId: typeof categoryId === 'string' ? categoryId : undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      });
      res.json({
        data: result.products,
        meta: {
          requestId: res.locals.requestId,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Product Details
  router.get('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = String(req.params.productId);
      const product = await service.getProductById(req.auth!.storeId, productId);
      res.json(successEnvelope(product, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Create Product
  router.post('/products', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid product data.', res.locals.requestId, parsed.error.issues));
    }
    try {
      const product = await service.createProduct(req.auth!.storeId, parsed.data);
      res.status(201).json(successEnvelope(product, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 409) {
        return res.status(409).json(errorEnvelope('CONFLICT', err.message, res.locals.requestId));
      }
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Update Product
  router.patch('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid update data.', res.locals.requestId, parsed.error.issues));
    }
    try {
      const productId = String(req.params.productId);
      const updated = await service.updateProduct(req.auth!.storeId, productId, parsed.data);
      res.json(successEnvelope(updated, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      if (err.status === 409) {
        return res.status(409).json(errorEnvelope('CONFLICT', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Add Barcode Mapping
  router.post('/products/:productId/barcodes', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = addBarcodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid barcode input.', res.locals.requestId, parsed.error.issues));
    }
    try {
      const productId = String(req.params.productId);
      const mapping = await service.addBarcode(req.auth!.storeId, productId, parsed.data);
      res.status(201).json(successEnvelope(mapping, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 409) {
        return res.status(409).json(errorEnvelope('CONFLICT', err.message, res.locals.requestId));
      }
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  // Remove Barcode Mapping
  router.delete('/products/:productId/barcodes/:barcodeId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = String(req.params.productId);
      const barcodeId = String(req.params.barcodeId);
      const result = await service.removeBarcode(req.auth!.storeId, productId, barcodeId);
      res.json(successEnvelope(result, res.locals.requestId));
    } catch (err: any) {
      if (err.status === 404) {
        return res.status(404).json(errorEnvelope('NOT_FOUND', err.message, res.locals.requestId));
      }
      next(err);
    }
  });

  return router;
}
