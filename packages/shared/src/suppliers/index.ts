import { z } from 'zod';

export const contactMethods = ['PHONE', 'WHATSAPP', 'EMAIL', 'PORTAL', 'MANUAL'] as const;
export type ContactMethod = (typeof contactMethods)[number];

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(100),
  legalName: z.string().trim().max(150).optional(),
  contactPerson: z.string().trim().max(80).optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number'),
  whatsappPhone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid WhatsApp number').optional(),
  email: z.string().trim().email('Invalid email address').optional(),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  pincode: z.string().trim().max(10).optional(),
  preferredContactMethod: z.enum(contactMethods).default('PHONE'),
  defaultLeadTimeDays: z.number().int().nonnegative().optional(),
  defaultPaymentTerms: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const supplierQuerySchema = z.object({
  query: z.string().optional(),
  includeArchived: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SupplierQuery = z.infer<typeof supplierQuerySchema>;

export const createSupplierProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  supplierSku: z.string().trim().max(80).optional(),
  purchaseUnitLabel: z.string().trim().min(1, 'Purchase unit label is required (e.g., carton, case, bag)').max(40),
  unitsPerPurchasePack: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Must be a positive decimal string')
    .refine(v => Number(v) > 0, 'Units per pack must be greater than zero'),
  minimumOrderQuantity: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Must be a valid decimal string')
    .refine(v => Number(v) >= 0, 'MOQ cannot be negative').default('1.000'),
  lastQuotedPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});
export type CreateSupplierProductInput = z.infer<typeof createSupplierProductSchema>;

export const updateSupplierProductSchema = createSupplierProductSchema.partial().omit({ productId: true });
export type UpdateSupplierProductInput = z.infer<typeof updateSupplierProductSchema>;

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  legalName?: string | null;
  contactPerson?: string | null;
  phone: string;
  whatsappPhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  preferredContactMethod: ContactMethod;
  defaultLeadTimeDays?: number | null;
  defaultPaymentTerms?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProduct {
  id: string;
  storeId: string;
  supplierId: string;
  productId: string;
  supplierSku?: string | null;
  purchaseUnitLabel: string;
  unitsPerPurchasePack: string; // Decimal string
  minimumOrderQuantity: string; // Decimal string
  lastQuotedPrice?: string | null; // Decimal string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
