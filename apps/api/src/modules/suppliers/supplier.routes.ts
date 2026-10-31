import { Router, type Request, type Response } from 'express';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
  createSupplierProductSchema,
  updateSupplierProductSchema,
  successEnvelope,
  errorEnvelope,
} from '@dukaanai/shared';
import { supplierService } from './supplier.service.js';

export const supplierRouter = Router();

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0];
  return param ?? '';
};

// GET /api/suppliers
supplierRouter.get('/', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const parseResult = supplierQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid query parameters.', res.locals.requestId, parseResult.error.issues));
  }

  try {
    const result = await supplierService.listSuppliers(req.auth.storeId, parseResult.data);
    res.json(successEnvelope(result, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching suppliers', res.locals.requestId));
  }
});

// POST /api/suppliers
supplierRouter.post('/', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const parseResult = createSupplierSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid supplier input.', res.locals.requestId, parseResult.error.issues));
  }

  try {
    const supplier = await supplierService.createSupplier(req.auth.storeId, parseResult.data);
    res.status(201).json(successEnvelope(supplier, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error creating supplier', res.locals.requestId));
  }
});

// GET /api/suppliers/:supplierId
supplierRouter.get('/:supplierId', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const supplierId = getParam(req.params.supplierId);
  try {
    const supplier = await supplierService.getSupplier(req.auth.storeId, supplierId);
    if (!supplier) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Supplier not found.', res.locals.requestId));
    }
    const products = await supplierService.listProducts(req.auth.storeId, supplierId);
    res.json(successEnvelope({ ...supplier, products }, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching supplier', res.locals.requestId));
  }
});

// PATCH /api/suppliers/:supplierId
supplierRouter.patch('/:supplierId', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const parseResult = updateSupplierSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid supplier updates.', res.locals.requestId, parseResult.error.issues));
  }

  const supplierId = getParam(req.params.supplierId);
  try {
    const updated = await supplierService.updateSupplier(req.auth.storeId, supplierId, parseResult.data);
    if (!updated) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Supplier not found.', res.locals.requestId));
    }
    res.json(successEnvelope(updated, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error updating supplier', res.locals.requestId));
  }
});

// POST /api/suppliers/:supplierId/archive
supplierRouter.post('/:supplierId/archive', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const supplierId = getParam(req.params.supplierId);
  try {
    const archived = await supplierService.archiveSupplier(req.auth.storeId, supplierId);
    if (!archived) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Supplier not found.', res.locals.requestId));
    }
    res.json(successEnvelope(archived, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error archiving supplier', res.locals.requestId));
  }
});

// GET /api/suppliers/:supplierId/products
supplierRouter.get('/:supplierId/products', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const supplierId = getParam(req.params.supplierId);
  try {
    const products = await supplierService.listProducts(req.auth.storeId, supplierId);
    res.json(successEnvelope(products, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error fetching supplier products', res.locals.requestId));
  }
});

// POST /api/suppliers/:supplierId/products
supplierRouter.post('/:supplierId/products', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const parseResult = createSupplierProductSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid supplier product mapping.', res.locals.requestId, parseResult.error.issues));
  }

  const supplierId = getParam(req.params.supplierId);
  try {
    const mapping = await supplierService.mapProduct(req.auth.storeId, supplierId, parseResult.data);
    res.status(201).json(successEnvelope(mapping, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error mapping supplier product', res.locals.requestId));
  }
});

// PATCH /api/supplier-products/:id
export const supplierProductRouter = Router();

supplierProductRouter.patch('/:id', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  }

  const parseResult = updateSupplierProductSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid supplier product update.', res.locals.requestId, parseResult.error.issues));
  }

  const id = getParam(req.params.id);
  try {
    const updated = await supplierService.updateSupplierProduct(req.auth.storeId, id, parseResult.data);
    if (!updated) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Supplier product mapping not found.', res.locals.requestId));
    }
    res.json(successEnvelope(updated, res.locals.requestId));
  } catch (error) {
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', error instanceof Error ? error.message : 'Error updating product mapping', res.locals.requestId));
  }
});
