import { z } from 'zod';

export const paymentMethods = ['CASH', 'UPI', 'CREDIT'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentStatuses = ['COMPLETED', 'PENDING', 'FAILED'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const saleStatuses = ['COMPLETED', 'CANCELLED'] as const;
export type SaleStatus = (typeof saleStatuses)[number];

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,3})?$/, 'Quantity must be a positive decimal number with up to 3 decimal places')
    .refine((val) => parseFloat(val) > 0, 'Quantity must be greater than zero'),
  expectedSellingPrice: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Expected selling price must be a valid price'),
});
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const salePaymentInputSchema = z.object({
  method: z.enum(paymentMethods),
  amountTendered: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount tendered must be a valid price')
    .optional(),
  reference: z.string().trim().max(100).optional(),
});
export type SalePaymentInput = z.infer<typeof salePaymentInputSchema>;

export const createSaleSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1, 'Idempotency key is required').max(128),
    items: z.array(saleItemInputSchema).min(1, 'Cart must have at least one item'),
    payment: salePaymentInputSchema,
    customerLabel: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.payment.method === 'CREDIT' && (!data.customerLabel || data.customerLabel.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Customer name or label is required for Credit (Udhar) sales',
        path: ['customerLabel'],
      });
    }
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export interface SaleItemDto {
  id: string;
  saleId: string;
  productId: string;
  productNameSnapshot: string;
  barcodeSnapshot: string | null;
  stockUnitSnapshot: string;
  quantity: string;
  unitPriceSnapshot: string;
  unitCostSnapshot: string | null;
  lineTotal: string;
}

export interface PaymentDto {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: string;
  status: PaymentStatus;
  reference: string | null;
  occurredAt: string;
  recordedBy: string;
}

export interface SaleDto {
  id: string;
  storeId: string;
  receiptNumber: string;
  status: SaleStatus;
  subtotal: string;
  discountTotal: string;
  total: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amountPaid: string;
  changeDue: string;
  balanceDue: string;
  customerLabel: string | null;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  items: SaleItemDto[];
  payments: PaymentDto[];
}

export interface SaleSummaryDto {
  id: string;
  receiptNumber: string;
  status: SaleStatus;
  total: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: string;
  balanceDue: string;
  customerLabel: string | null;
  itemCount: number;
  createdAt: string;
}

export interface SalesListFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  paymentMethod?: PaymentMethod;
  from?: string;
  to?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  stockUnit: string;
  sellingPrice: string;
  mrp: string | null;
  quantityOnHand: string;
  quantity: string;
  lineTotal: string;
}
