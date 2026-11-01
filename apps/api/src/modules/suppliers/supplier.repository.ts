import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Supplier, SupplierProduct } from '@dukaanai/shared';

export class SupplierRepository {
  private prisma: PrismaClient | null = null;
  private suppliers: Map<string, Supplier> = new Map();
  private supplierProducts: Map<string, SupplierProduct> = new Map();

  constructor() {
    this.seedDemoData();
  }

  configure(prisma: PrismaClient) { this.prisma = prisma; }

  private toSupplier(row: any): Supplier {
    return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  private toSupplierProduct(row: any): SupplierProduct {
    return {
      ...row,
      unitsPerPurchasePack: row.unitsPerPurchasePack.toString(),
      minimumOrderQuantity: row.minimumOrderQuantity.toString(),
      lastQuotedPrice: row.lastQuotedPrice?.toString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private seedDemoData() {
    const s1: Supplier = {
      id: 'sup_metro',
      storeId: 'demo-store',
      name: 'Metro Cash & Carry - Mumbai Central',
      legalName: 'Metro Cash & Carry India Pvt Ltd',
      contactPerson: 'Rajesh Sharma',
      phone: '+919820011223',
      whatsappPhone: '+919820011223',
      email: 'orders.mumbai@metrocash.in',
      address: 'Plot 4, Lower Parel Industrial Estate',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400013',
      preferredContactMethod: 'PORTAL',
      defaultLeadTimeDays: 2,
      defaultPaymentTerms: '7_DAYS',
      notes: 'Premier distributor portal partner with automated stock sync.',
      isActive: true,
      createdAt: new Date('2026-10-01T10:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-01T10:00:00Z').toISOString(),
    };

    const s2: Supplier = {
      id: 'sup_anand',
      storeId: 'demo-store',
      name: 'Anand Agencies (FMCG Wholesaler)',
      legalName: 'Anand Agencies Partnership Firm',
      contactPerson: 'Suresh Gupta',
      phone: '+919819922334',
      whatsappPhone: '+919819922334',
      email: 'anand.agencies.fmcg@gmail.com',
      address: 'Shop 12, APMC Market 2, Vashi',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400703',
      preferredContactMethod: 'PHONE',
      defaultLeadTimeDays: 1,
      defaultPaymentTerms: 'CASH',
      notes: 'Local distributor, fast same-day or next-day delivery on biscuits and staples.',
      isActive: true,
      createdAt: new Date('2026-10-05T11:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-05T11:00:00Z').toISOString(),
    };

    const s3: Supplier = {
      id: 'sup_ganesh',
      storeId: 'demo-store',
      name: 'Shree Ganesh Wholesale Traders',
      legalName: 'Shree Ganesh Wholesale Proprietary',
      contactPerson: 'Vinod Patel',
      phone: '+919820556677',
      whatsappPhone: '+919820556677',
      email: 'vinod.ganesh@outlook.com',
      address: 'Gala 3, Dana Bandar, Masjid Bunder',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400009',
      preferredContactMethod: 'WHATSAPP',
      defaultLeadTimeDays: 3,
      defaultPaymentTerms: '15_DAYS',
      notes: 'Provides 15 days credit for oils and grains.',
      isActive: true,
      createdAt: new Date('2026-10-10T12:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-10T12:00:00Z').toISOString(),
    };

    this.suppliers.set(s1.id, s1);
    this.suppliers.set(s2.id, s2);
    this.suppliers.set(s3.id, s3);

    // Mappings for Parle-G Biscuit 250g (prod_101)
    const sp1: SupplierProduct = {
      id: 'sp_101',
      storeId: 'demo-store',
      supplierId: 'sup_metro',
      productId: 'prod_101',
      supplierSku: 'METRO-PARLE-G-250',
      purchaseUnitLabel: 'carton',
      unitsPerPurchasePack: '24.000', // 1 carton = 24 packets
      minimumOrderQuantity: '2.000',   // MOQ: 2 cartons = 48 packets
      lastQuotedPrice: '216.00',      // Rs 216 / carton -> Rs 9 / packet
      isActive: true,
      createdAt: new Date('2026-10-01T10:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-01T10:00:00Z').toISOString(),
    };

    const sp2: SupplierProduct = {
      id: 'sp_102',
      storeId: 'demo-store',
      supplierId: 'sup_anand',
      productId: 'prod_101',
      supplierSku: 'ANAND-PARLE-BX',
      purchaseUnitLabel: 'box',
      unitsPerPurchasePack: '12.000', // 1 box = 12 packets
      minimumOrderQuantity: '3.000',   // MOQ: 3 boxes = 36 packets
      lastQuotedPrice: '114.00',      // Rs 114 / box -> Rs 9.50 / packet
      isActive: true,
      createdAt: new Date('2026-10-05T11:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-05T11:00:00Z').toISOString(),
    };

    // Mappings for Fortune Sunlite Sunflower Oil 1L (prod_102)
    const sp3: SupplierProduct = {
      id: 'sp_103',
      storeId: 'demo-store',
      supplierId: 'sup_metro',
      productId: 'prod_102',
      supplierSku: 'METRO-OIL-1L-CASE',
      purchaseUnitLabel: 'carton',
      unitsPerPurchasePack: '12.000',
      minimumOrderQuantity: '1.000',
      lastQuotedPrice: '1440.00',     // Rs 1440 / carton -> Rs 120 / pouch
      isActive: true,
      createdAt: new Date('2026-10-01T10:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-01T10:00:00Z').toISOString(),
    };

    const sp4: SupplierProduct = {
      id: 'sp_104',
      storeId: 'demo-store',
      supplierId: 'sup_ganesh',
      productId: 'prod_102',
      supplierSku: 'GANESH-OIL-CTN',
      purchaseUnitLabel: 'carton',
      unitsPerPurchasePack: '12.000',
      minimumOrderQuantity: '2.000',
      lastQuotedPrice: '1476.00',     // Rs 1476 / carton -> Rs 123 / pouch
      isActive: true,
      createdAt: new Date('2026-10-10T12:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-10T12:00:00Z').toISOString(),
    };

    this.supplierProducts.set(sp1.id, sp1);
    this.supplierProducts.set(sp2.id, sp2);
    this.supplierProducts.set(sp3.id, sp3);
    this.supplierProducts.set(sp4.id, sp4);
  }

  // Supplier CRUD
  async createSupplier(storeId: string, data: Omit<Supplier, 'id' | 'storeId' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<Supplier> {
    if (this.prisma) return this.toSupplier(await this.prisma.supplier.create({ data: { ...data, storeId } }));
    const id = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const supplier: Supplier = {
      ...data,
      id,
      storeId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.suppliers.set(id, supplier);
    return supplier;
  }

  async findSuppliers(storeId: string, options: { query?: string; includeArchived?: boolean; page: number; pageSize: number }) {
    if (this.prisma) {
      const where = {
        storeId,
        ...(options.includeArchived ? {} : { isActive: true }),
        ...(options.query ? { OR: [
          { name: { contains: options.query, mode: 'insensitive' as const } },
          { contactPerson: { contains: options.query, mode: 'insensitive' as const } },
          { phone: { contains: options.query } },
          { city: { contains: options.query, mode: 'insensitive' as const } },
        ] } : {}),
      };
      const [items, total] = await this.prisma.$transaction([
        this.prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (options.page - 1) * options.pageSize, take: options.pageSize }),
        this.prisma.supplier.count({ where }),
      ]);
      return { items: items.map((item) => this.toSupplier(item)), total, page: options.page, pageSize: options.pageSize };
    }
    const all = Array.from(this.suppliers.values()).filter(s => {
      if (s.storeId !== storeId) return false;
      if (!options.includeArchived && !s.isActive) return false;
      if (options.query) {
        const q = options.query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
          s.phone.includes(q) ||
          (s.city && s.city.toLowerCase().includes(q))
        );
      }
      return true;
    });

    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = all.length;
    const start = (options.page - 1) * options.pageSize;
    const items = all.slice(start, start + options.pageSize);

    return { items, total, page: options.page, pageSize: options.pageSize };
  }

  async findSupplierById(storeId: string, supplierId: string): Promise<Supplier | null> {
    if (this.prisma) {
      const row = await this.prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
      return row ? this.toSupplier(row) : null;
    }
    const s = this.suppliers.get(supplierId);
    if (!s || s.storeId !== storeId) return null;
    return s;
  }

  async updateSupplier(storeId: string, supplierId: string, data: Partial<Supplier>): Promise<Supplier | null> {
    if (this.prisma) {
      const { id: _id, storeId: _storeId, createdAt: _createdAt, updatedAt: _updatedAt, ...update } = data;
      const result = await this.prisma.supplier.updateMany({ where: { id: supplierId, storeId }, data: update });
      if (!result.count) return null;
      return this.findSupplierById(storeId, supplierId);
    }
    const s = await this.findSupplierById(storeId, supplierId);
    if (!s) return null;
    const updated: Supplier = {
      ...s,
      ...data,
      id: s.id,
      storeId: s.storeId,
      updatedAt: new Date().toISOString(),
    };
    this.suppliers.set(s.id, updated);
    return updated;
  }

  async archiveSupplier(storeId: string, supplierId: string): Promise<Supplier | null> {
    return this.updateSupplier(storeId, supplierId, { isActive: false });
  }

  // Supplier-Product mappings
  async mapProduct(
    storeId: string,
    supplierId: string,
    data: {
      productId: string;
      supplierSku?: string | null;
      purchaseUnitLabel: string;
      unitsPerPurchasePack: string;
      minimumOrderQuantity: string;
      lastQuotedPrice?: string | null;
    }
  ): Promise<SupplierProduct> {
    if (this.prisma) {
      const row = await this.prisma.supplierProduct.upsert({
        where: { storeId_supplierId_productId: { storeId, supplierId, productId: data.productId } },
        create: { storeId, supplierId, ...data, unitsPerPurchasePack: data.unitsPerPurchasePack, minimumOrderQuantity: data.minimumOrderQuantity },
        update: { ...data, isActive: true },
      });
      return this.toSupplierProduct(row);
    }
    // Check if mapping already exists
    const existing = Array.from(this.supplierProducts.values()).find(
      sp => sp.storeId === storeId && sp.supplierId === supplierId && sp.productId === data.productId
    );

    const now = new Date().toISOString();
    if (existing) {
      const updated: SupplierProduct = {
        ...existing,
        ...data,
        isActive: true,
        updatedAt: now,
      };
      this.supplierProducts.set(existing.id, updated);
      return updated;
    }

    const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const product: SupplierProduct = {
      id,
      storeId,
      supplierId,
      productId: data.productId,
      supplierSku: data.supplierSku ?? null,
      purchaseUnitLabel: data.purchaseUnitLabel,
      unitsPerPurchasePack: data.unitsPerPurchasePack,
      minimumOrderQuantity: data.minimumOrderQuantity,
      lastQuotedPrice: data.lastQuotedPrice ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.supplierProducts.set(id, product);
    return product;
  }

  async findProductsBySupplier(storeId: string, supplierId: string): Promise<SupplierProduct[]> {
    if (this.prisma) {
      const rows = await this.prisma.supplierProduct.findMany({ where: { storeId, supplierId, isActive: true }, orderBy: { createdAt: 'desc' } });
      return rows.map((row) => this.toSupplierProduct(row));
    }
    return Array.from(this.supplierProducts.values()).filter(
      sp => sp.storeId === storeId && sp.supplierId === supplierId && sp.isActive
    );
  }

  async findSupplierProductById(storeId: string, id: string): Promise<SupplierProduct | null> {
    if (this.prisma) {
      const row = await this.prisma.supplierProduct.findFirst({ where: { storeId, id } });
      return row ? this.toSupplierProduct(row) : null;
    }
    const sp = this.supplierProducts.get(id);
    if (!sp || sp.storeId !== storeId) return null;
    return sp;
  }

  async updateSupplierProduct(
    storeId: string,
    id: string,
    data: Partial<SupplierProduct>
  ): Promise<SupplierProduct | null> {
    if (this.prisma) {
      const { id: _id, storeId: _storeId, supplierId: _supplierId, productId: _productId, createdAt: _createdAt, updatedAt: _updatedAt, ...update } = data;
      const result = await this.prisma.supplierProduct.updateMany({ where: { storeId, id }, data: update });
      if (!result.count) return null;
      return this.findSupplierProductById(storeId, id);
    }
    const sp = await this.findSupplierProductById(storeId, id);
    if (!sp) return null;
    const updated: SupplierProduct = {
      ...sp,
      ...data,
      id: sp.id,
      storeId: sp.storeId,
      supplierId: sp.supplierId,
      productId: sp.productId,
      updatedAt: new Date().toISOString(),
    };
    this.supplierProducts.set(id, updated);
    return updated;
  }

  async findSuppliersForProduct(storeId: string, productId: string): Promise<{ supplier: Supplier; mapping: SupplierProduct }[]> {
    if (this.prisma) {
      const rows = await this.prisma.supplierProduct.findMany({
        where: { storeId, productId, isActive: true, supplier: { isActive: true } },
        include: { supplier: true },
      });
      return rows.map(({ supplier, ...mapping }) => ({ supplier: this.toSupplier(supplier), mapping: this.toSupplierProduct(mapping) }));
    }
    const mappings = Array.from(this.supplierProducts.values()).filter(
      sp => sp.storeId === storeId && sp.productId === productId && sp.isActive
    );
    const result: { supplier: Supplier; mapping: SupplierProduct }[] = [];
    for (const m of mappings) {
      const supplier = await this.findSupplierById(storeId, m.supplierId);
      if (supplier && supplier.isActive) {
        result.push({ supplier, mapping: m });
      }
    }
    return result;
  }
}

export const supplierRepository = new SupplierRepository();
