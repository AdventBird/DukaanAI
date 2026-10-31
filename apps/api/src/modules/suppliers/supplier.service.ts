import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierQuery,
  CreateSupplierProductInput,
  UpdateSupplierProductInput,
  Supplier,
  SupplierProduct,
} from '@dukaanai/shared';
import { supplierRepository, SupplierRepository } from './supplier.repository.js';

export class SupplierService {
  constructor(private repo: SupplierRepository = supplierRepository) {}

  async createSupplier(storeId: string, input: CreateSupplierInput): Promise<Supplier> {
    return this.repo.createSupplier(storeId, {
      name: input.name,
      legalName: input.legalName ?? null,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone,
      whatsappPhone: input.whatsappPhone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      preferredContactMethod: input.preferredContactMethod,
      defaultLeadTimeDays: input.defaultLeadTimeDays ?? null,
      defaultPaymentTerms: input.defaultPaymentTerms ?? null,
      notes: input.notes ?? null,
    });
  }

  async listSuppliers(storeId: string, query: SupplierQuery) {
    return this.repo.findSuppliers(storeId, {
      query: query.query,
      includeArchived: query.includeArchived,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async getSupplier(storeId: string, supplierId: string): Promise<Supplier | null> {
    return this.repo.findSupplierById(storeId, supplierId);
  }

  async updateSupplier(storeId: string, supplierId: string, input: UpdateSupplierInput): Promise<Supplier | null> {
    return this.repo.updateSupplier(storeId, supplierId, input);
  }

  async archiveSupplier(storeId: string, supplierId: string): Promise<Supplier | null> {
    return this.repo.archiveSupplier(storeId, supplierId);
  }

  async mapProduct(storeId: string, supplierId: string, input: CreateSupplierProductInput): Promise<SupplierProduct> {
    const supplier = await this.repo.findSupplierById(storeId, supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    return this.repo.mapProduct(storeId, supplierId, {
      productId: input.productId,
      supplierSku: input.supplierSku,
      purchaseUnitLabel: input.purchaseUnitLabel,
      unitsPerPurchasePack: input.unitsPerPurchasePack,
      minimumOrderQuantity: input.minimumOrderQuantity,
      lastQuotedPrice: input.lastQuotedPrice,
    });
  }

  async listProducts(storeId: string, supplierId: string): Promise<SupplierProduct[]> {
    return this.repo.findProductsBySupplier(storeId, supplierId);
  }

  async updateSupplierProduct(storeId: string, id: string, input: UpdateSupplierProductInput): Promise<SupplierProduct | null> {
    return this.repo.updateSupplierProduct(storeId, id, input);
  }

  async getSuppliersForProduct(storeId: string, productId: string) {
    return this.repo.findSuppliersForProduct(storeId, productId);
  }
}

export const supplierService = new SupplierService();
