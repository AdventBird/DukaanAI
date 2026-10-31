import { Prisma, PrismaClient, StockMovementType, StockUnit } from '@prisma/client';
import type {
  CreateProductInput,
  UpdateProductInput,
  AddBarcodeInput,
  BarcodeLookupResult,
} from '@dukaanai/shared';

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List categories for store
   */
  async listCategories(storeId: string) {
    return await this.prisma.category.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create new category
   */
  async createCategory(storeId: string, name: string) {
    const trimmed = name.trim();
    const existing = await this.prisma.category.findFirst({
      where: { storeId, name: { equals: trimmed, mode: 'insensitive' } },
    });

    if (existing) {
      const error: any = new Error(`Category "${trimmed}" already exists.`);
      error.code = 'CONFLICT';
      error.status = 409;
      throw error;
    }

    return await this.prisma.category.create({
      data: { storeId, name: trimmed },
    });
  }

  /**
   * Search/list products with filters & pagination
   */
  async listProducts(
    storeId: string,
    options: {
      search?: string;
      categoryId?: string;
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));

    const where: Prisma.ProductWhereInput = {
      storeId,
    };

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { brand: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
        { barcodes: { some: { barcode: { contains: options.search } } } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          barcodes: true,
          inventoryBalance: true,
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        categoryId: p.categoryId,
        category: p.category.name,
        description: p.description,
        stockUnit: p.stockUnit,
        purchasePackLabel: p.purchasePackLabel,
        unitsPerPurchasePack: p.unitsPerPurchasePack ? p.unitsPerPurchasePack.toString() : null,
        mrp: p.mrp ? p.mrp.toFixed(2) : null,
        sellingPrice: p.sellingPrice.toFixed(2),
        purchaseCost: p.purchaseCost ? p.purchaseCost.toFixed(2) : null,
        reorderLevel: p.reorderLevel.toString(),
        isActive: p.isActive,
        barcodes: p.barcodes.map((b) => ({
          id: b.id,
          barcode: b.barcode,
          symbology: b.symbology,
          isPrimary: b.isPrimary,
        })),
        quantityOnHand: p.inventoryBalance ? p.inventoryBalance.quantityOnHand.toString() : '0',
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  /**
   * Get product details with barcodes and inventory summary
   */
  async getProductById(storeId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      include: {
        category: true,
        barcodes: true,
        inventoryBalance: true,
      },
    });

    if (!product) {
      const error: any = new Error('Product not found.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      category: product.category.name,
      description: product.description,
      stockUnit: product.stockUnit,
      purchasePackLabel: product.purchasePackLabel,
      unitsPerPurchasePack: product.unitsPerPurchasePack ? product.unitsPerPurchasePack.toString() : null,
      mrp: product.mrp ? product.mrp.toFixed(2) : null,
      sellingPrice: product.sellingPrice.toFixed(2),
      purchaseCost: product.purchaseCost ? product.purchaseCost.toFixed(2) : null,
      reorderLevel: product.reorderLevel.toString(),
      isActive: product.isActive,
      barcodes: product.barcodes.map((b) => ({
        id: b.id,
        barcode: b.barcode,
        symbology: b.symbology,
        isPrimary: b.isPrimary,
      })),
      quantityOnHand: product.inventoryBalance ? product.inventoryBalance.quantityOnHand.toString() : '0',
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new product with optional initial barcode and opening stock
   */
  async createProduct(storeId: string, input: CreateProductInput) {
    // Validate category exists for this store
    const category = await this.prisma.category.findFirst({
      where: { id: input.categoryId, storeId },
    });
    if (!category) {
      const error: any = new Error('Category not found for this store.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    // Check SKU uniqueness if provided
    if (input.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { storeId_sku: { storeId, sku: input.sku } },
      });
      if (existingSku) {
        const error: any = new Error(`Product with SKU "${input.sku}" already exists.`);
        error.code = 'CONFLICT';
        error.status = 409;
        throw error;
      }
    }

    // Check Barcode uniqueness across store if provided
    if (input.barcode) {
      const existingBarcode = await this.prisma.productBarcode.findUnique({
        where: { storeId_barcode: { storeId, barcode: input.barcode } },
      });
      if (existingBarcode) {
        const error: any = new Error(`Barcode "${input.barcode}" is already mapped to another product.`);
        error.code = 'CONFLICT';
        error.status = 409;
        throw error;
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId,
          sku: input.sku || null,
          name: input.name,
          brand: input.brand || null,
          categoryId: input.categoryId,
          description: input.description || null,
          stockUnit: input.stockUnit as StockUnit,
          purchasePackLabel: input.purchasePackLabel || null,
          unitsPerPurchasePack: input.unitsPerPurchasePack ? new Prisma.Decimal(input.unitsPerPurchasePack) : null,
          mrp: input.mrp ? new Prisma.Decimal(input.mrp) : null,
          sellingPrice: new Prisma.Decimal(input.sellingPrice),
          purchaseCost: input.purchaseCost ? new Prisma.Decimal(input.purchaseCost) : null,
          reorderLevel: new Prisma.Decimal(input.reorderLevel || '0'),
          isActive: true,
        },
      });

      // Link initial barcode if provided
      if (input.barcode) {
        await tx.productBarcode.create({
          data: {
            storeId,
            productId: product.id,
            barcode: input.barcode,
            isPrimary: true,
          },
        });
      }

      // Initialize inventory balance & opening movement if specified
      const initialQty = input.openingStockQuantity ? new Prisma.Decimal(input.openingStockQuantity) : new Prisma.Decimal(0);
      await tx.inventoryBalance.create({
        data: {
          storeId,
          productId: product.id,
          quantityOnHand: initialQty,
        },
      });

      if (initialQty.greaterThan(0)) {
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: product.id,
            movementType: StockMovementType.OPENING,
            quantityDelta: initialQty,
            unit: product.stockUnit,
            reason: 'Opening stock count',
            referenceType: 'OPENING',
            referenceId: product.id,
            actorType: 'OWNER',
            actorId: 'owner',
          },
        });
      }

      return product;
    });
  }

  /**
   * Update existing product
   */
  async updateProduct(storeId: string, productId: string, input: UpdateProductInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product) {
      const error: any = new Error('Product not found.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    if (input.sku && input.sku !== product.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { storeId_sku: { storeId, sku: input.sku } },
      });
      if (existingSku) {
        const error: any = new Error(`Product with SKU "${input.sku}" already exists.`);
        error.code = 'CONFLICT';
        error.status = 409;
        throw error;
      }
    }

    const data: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.brand !== undefined) data.brand = input.brand;
    if (input.sku !== undefined) data.sku = input.sku;
    if (input.categoryId !== undefined) data.category = { connect: { id: input.categoryId } };
    if (input.description !== undefined) data.description = input.description;
    if (input.stockUnit !== undefined) data.stockUnit = input.stockUnit as StockUnit;
    if (input.purchasePackLabel !== undefined) data.purchasePackLabel = input.purchasePackLabel;
    if (input.unitsPerPurchasePack !== undefined) {
      data.unitsPerPurchasePack = input.unitsPerPurchasePack ? new Prisma.Decimal(input.unitsPerPurchasePack) : null;
    }
    if (input.mrp !== undefined) {
      data.mrp = input.mrp ? new Prisma.Decimal(input.mrp) : null;
    }
    if (input.sellingPrice !== undefined) {
      data.sellingPrice = new Prisma.Decimal(input.sellingPrice);
    }
    if (input.purchaseCost !== undefined) {
      data.purchaseCost = input.purchaseCost ? new Prisma.Decimal(input.purchaseCost) : null;
    }
    if (input.reorderLevel !== undefined) {
      data.reorderLevel = new Prisma.Decimal(input.reorderLevel);
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data,
    });
  }

  /**
   * Add barcode mapping to product
   */
  async addBarcode(storeId: string, productId: string, input: AddBarcodeInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product) {
      const error: any = new Error('Product not found.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    // Preserve exact barcode string with leading zeros
    const barcodeStr = input.barcode.trim();

    const existing = await this.prisma.productBarcode.findUnique({
      where: { storeId_barcode: { storeId, barcode: barcodeStr } },
      include: { product: true },
    });

    if (existing) {
      const error: any = new Error(`Barcode "${barcodeStr}" is already assigned to "${existing.product.name}".`);
      error.code = 'CONFLICT';
      error.status = 409;
      throw error;
    }

    return await this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productBarcode.updateMany({
          where: { productId },
          data: { isPrimary: false },
        });
      }

      return await tx.productBarcode.create({
        data: {
          storeId,
          productId,
          barcode: barcodeStr,
          symbology: input.symbology,
          isPrimary: input.isPrimary,
        },
      });
    });
  }

  /**
   * Remove barcode mapping
   */
  async removeBarcode(storeId: string, productId: string, barcodeId: string) {
    const barcode = await this.prisma.productBarcode.findFirst({
      where: { id: barcodeId, productId, storeId },
    });
    if (!barcode) {
      const error: any = new Error('Barcode mapping not found.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    await this.prisma.productBarcode.delete({
      where: { id: barcodeId },
    });
    return { success: true };
  }

  /**
   * POS Barcode lookup: High priority for Dev 2
   * Returns sellable item info and current stock.
   */
  async lookupBarcode(storeId: string, barcode: string): Promise<BarcodeLookupResult> {
    const trimmed = barcode.trim();
    const mapping = await this.prisma.productBarcode.findUnique({
      where: { storeId_barcode: { storeId, barcode: trimmed } },
      include: {
        product: {
          include: {
            inventoryBalance: true,
          },
        },
      },
    });

    if (!mapping || !mapping.product || !mapping.product.isActive) {
      const error: any = new Error(`No active product found for barcode "${trimmed}".`);
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    const { product } = mapping;
    const qty = product.inventoryBalance ? product.inventoryBalance.quantityOnHand.toString() : '0';

    return {
      productId: product.id,
      name: product.name,
      brand: product.brand,
      barcode: mapping.barcode,
      stockUnit: product.stockUnit,
      sellingPrice: product.sellingPrice.toFixed(2),
      mrp: product.mrp ? product.mrp.toFixed(2) : null,
      quantityOnHand: qty,
      isActive: product.isActive,
    };
  }
}
