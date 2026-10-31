import { z } from 'zod';

export * from './suppliers/index.js';
export * from './procurement/index.js';
export * from './ai/index.js';

export const authContextSchema = z.object({
  userId: z.string().min(1),
  storeId: z.string().min(1),
  role: z.enum(['OWNER', 'CASHIER', 'ASSISTANT']),
});
export type AuthContext = z.infer<typeof authContextSchema>;

export const successEnvelope = <T>(data: T, requestId: string) => ({ data, meta: { requestId } });
export const errorEnvelope = (code: string, message: string, requestId: string, details: unknown[] = []) => ({
  error: { code, message, details, requestId },
});

export const apiErrorCodes = [
  'VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'INSUFFICIENT_STOCK', 'RATE_LIMITED', 'INTERNAL_ERROR', 'DEPENDENCY_UNAVAILABLE',
] as const;
export type ApiErrorCode = (typeof apiErrorCodes)[number];

export const domainEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  payloadVersion: z.number().int().positive(),
  storeId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  occurredAt: z.string().datetime(),
  actor: z.object({ type: z.enum(['USER', 'SYSTEM', 'AI']), id: z.string().optional() }),
  payload: z.unknown(),
});
export type DomainEvent = z.infer<typeof domainEventSchema>;

export const createExpenseSchema = z.object({
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).refine((value) => Number(value) > 0, 'Amount must be greater than zero.'),
  currency: z.literal('INR').default('INR'),
  occurredAt: z.string().datetime(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ==========================================
// Product & Inventory Schemas & Types (Dev 1)
// ==========================================

export const stockUnits = ['PIECE', 'KG', 'GRAM', 'LITRE', 'MILLILITRE', 'PACKET', 'BOX'] as const;
export type StockUnit = (typeof stockUnits)[number];

export const stockMovementTypes = [
  'OPENING', 'SALE', 'PURCHASE_RECEIPT', 'MANUAL_ADJUSTMENT', 'DAMAGE', 'EXPIRY', 'CUSTOMER_RETURN', 'REVERSAL'
] as const;
export type StockMovementType = (typeof stockMovementTypes)[number];

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(80),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createProductSchema = z.object({
  sku: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1, 'Product name is required').max(120),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().trim().max(500).optional(),
  stockUnit: z.enum(stockUnits).default('PIECE'),
  purchasePackLabel: z.string().trim().max(80).optional(),
  unitsPerPurchasePack: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/, 'Must be a valid decimal quantity').optional(),
  mrp: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Must be a valid price').optional(),
  sellingPrice: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Selling price is required and must be valid'),
  purchaseCost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Must be a valid price').optional(),
  reorderLevel: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/, 'Must be a valid quantity').default('0'),
  barcode: z.string().trim().min(1).max(64).optional(),
  openingStockQuantity: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/, 'Must be a valid quantity').optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  sku: z.string().trim().max(50).optional().nullable(),
  name: z.string().trim().min(1).max(120).optional(),
  brand: z.string().trim().max(80).optional().nullable(),
  categoryId: z.string().min(1).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  stockUnit: z.enum(stockUnits).optional(),
  purchasePackLabel: z.string().trim().max(80).optional().nullable(),
  unitsPerPurchasePack: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/).optional().nullable(),
  mrp: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional().nullable(),
  sellingPrice: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional(),
  purchaseCost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional().nullable(),
  reorderLevel: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addBarcodeSchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required').max(64),
  symbology: z.string().trim().max(30).optional(),
  isPrimary: z.boolean().default(false),
});
export type AddBarcodeInput = z.infer<typeof addBarcodeSchema>;

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  countedQuantity: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/, 'Counted quantity must be a non-negative decimal'),
  reason: z.string().trim().min(1, 'Reason is mandatory for inventory adjustment').max(100),
  note: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required').max(128),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export interface StockChangeResult {
  success: boolean;
  productId: string;
  previousQuantity: string;
  newQuantity: string;
  difference: string;
  movementId: string;
}

export interface BarcodeLookupResult {
  productId: string;
  name: string;
  brand: string | null;
  barcode: string;
  stockUnit: string;
  sellingPrice: string;
  mrp: string | null;
  quantityOnHand: string;
  isActive: boolean;
}

export interface LowStockResult {
  productId: string;
  name: string;
  brand: string | null;
  category: string;
  barcodes: string[];
  stockUnit: string;
  quantityOnHand: string;
  reorderLevel: string;
  sellingPrice: string;
  updatedAt: string;
}
