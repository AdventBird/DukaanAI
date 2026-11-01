import { Prisma, PrismaClient, StockMovementType, StockUnit } from '@prisma/client';
import type { StockChangeResult, LowStockResult, StockAdjustmentInput } from '@dukaanai/shared';

export type DbTransaction = Prisma.TransactionClient;

export class InventoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Internal Domain Service: Deduct inventory for completed sale (called by Dev 2 POS)
   */
  async deductForSale(
    tx: DbTransaction,
    input: {
      storeId: string;
      productId: string;
      quantity: string;
      saleId: string;
      idempotencyKey: string;
      actorId?: string;
    }
  ): Promise<StockChangeResult> {
    const { storeId, productId, quantity, saleId, idempotencyKey, actorId } = input;
    const qtyToDeduct = new Prisma.Decimal(quantity);

    if (qtyToDeduct.isNegative() || qtyToDeduct.isZero()) {
      throw new Error('Deduction quantity must be greater than zero.');
    }

    // Check idempotency
    const existingMovement = await tx.stockMovement.findUnique({
      where: { idempotencyKey },
    });
    if (existingMovement) {
      const balance = await tx.inventoryBalance.findUnique({
        where: { storeId_productId: { storeId, productId } },
      });
      return {
        success: true,
        productId,
        previousQuantity: balance ? balance.quantityOnHand.toString() : '0',
        newQuantity: balance ? balance.quantityOnHand.toString() : '0',
        difference: existingMovement.quantityDelta.toString(),
        movementId: existingMovement.id,
      };
    }

    // Find current balance with store isolation
    const balance = await tx.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId, productId } },
      include: { product: true },
    });

    if (!balance || !balance.product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    const currentQty = balance.quantityOnHand;
    const newQty = currentQty.minus(qtyToDeduct);

    if (newQty.isNegative()) {
      const error: any = new Error(`Insufficient stock. Available: ${currentQty.toString()}, Requested: ${qtyToDeduct.toString()}`);
      error.code = 'INSUFFICIENT_STOCK';
      error.status = 409;
      throw error;
    }

    // Conditional decrement prevents two concurrent checkouts from both spending
    // the same on-hand units. PostgreSQL rechecks the predicate after row locking.
    const changed = await tx.inventoryBalance.updateMany({
      where: { id: balance.id, storeId, productId, quantityOnHand: { gte: qtyToDeduct } },
      data: { quantityOnHand: { decrement: qtyToDeduct } },
    });
    if (changed.count !== 1) {
      const latest = await tx.inventoryBalance.findUnique({ where: { storeId_productId: { storeId, productId } } });
      const available = latest?.quantityOnHand ?? new Prisma.Decimal(0);
      const error: any = new Error(`Insufficient stock. Available: ${available.toString()}, Requested: ${qtyToDeduct.toString()}`);
      error.code = 'INSUFFICIENT_STOCK';
      error.status = 409;
      throw error;
    }
    const updatedBalance = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } });

    // Create append-only stock movement
    const movement = await tx.stockMovement.create({
      data: {
        storeId,
        productId,
        movementType: StockMovementType.SALE,
        quantityDelta: qtyToDeduct.negated(),
        unit: balance.product.stockUnit,
        reason: 'POS Sale Checkout',
        referenceType: 'SALE',
        referenceId: saleId,
        idempotencyKey,
        actorType: 'USER',
        actorId: actorId ?? 'cashier',
      },
    });

    return {
      success: true,
      productId,
      previousQuantity: currentQty.toString(),
      newQuantity: updatedBalance.quantityOnHand.toString(),
      difference: qtyToDeduct.negated().toString(),
      movementId: movement.id,
    };
  }

  /**
   * Internal Domain Service: Add verified received goods (called by Dev 3 Procurement)
   */
  async receiveVerifiedGoods(
    tx: DbTransaction,
    input: {
      storeId: string;
      productId: string;
      receivedQuantityInStockUnits: string;
      goodsReceiptId: string;
      idempotencyKey: string;
      actorId?: string;
    }
  ): Promise<StockChangeResult> {
    const { storeId, productId, receivedQuantityInStockUnits, goodsReceiptId, idempotencyKey, actorId } = input;
    const qtyToAdd = new Prisma.Decimal(receivedQuantityInStockUnits);

    if (qtyToAdd.isNegative() || qtyToAdd.isZero()) {
      throw new Error('Received quantity must be greater than zero.');
    }

    // Check idempotency
    const existingMovement = await tx.stockMovement.findUnique({
      where: { idempotencyKey },
    });
    if (existingMovement) {
      const balance = await tx.inventoryBalance.findUnique({
        where: { storeId_productId: { storeId, productId } },
      });
      return {
        success: true,
        productId,
        previousQuantity: balance ? balance.quantityOnHand.toString() : '0',
        newQuantity: balance ? balance.quantityOnHand.toString() : '0',
        difference: existingMovement.quantityDelta.toString(),
        movementId: existingMovement.id,
      };
    }

    // Find product and balance
    const product = await tx.product.findFirst({
      where: { id: productId, storeId },
      include: { inventoryBalance: true },
    });

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    let currentQty = new Prisma.Decimal(0);
    let balanceId = product.inventoryBalance?.id;

    if (product.inventoryBalance) {
      currentQty = product.inventoryBalance.quantityOnHand;
    } else {
      const newBal = await tx.inventoryBalance.create({
        data: {
          storeId,
          productId,
          quantityOnHand: new Prisma.Decimal(0),
        },
      });
      balanceId = newBal.id;
    }

    const newQty = currentQty.plus(qtyToAdd);

    await tx.inventoryBalance.update({
      where: { id: balanceId },
      data: { quantityOnHand: { increment: qtyToAdd } },
    });
    const updatedBalance = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: balanceId } });

    const movement = await tx.stockMovement.create({
      data: {
        storeId,
        productId,
        movementType: StockMovementType.PURCHASE_RECEIPT,
        quantityDelta: qtyToAdd,
        unit: product.stockUnit,
        reason: 'Verified Supplier Goods Receipt',
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: goodsReceiptId,
        idempotencyKey,
        actorType: 'USER',
        actorId: actorId ?? 'owner',
      },
    });

    return {
      success: true,
      productId,
      previousQuantity: currentQty.toString(),
      newQuantity: updatedBalance.quantityOnHand.toString(),
      difference: qtyToAdd.toString(),
      movementId: movement.id,
    };
  }

  /**
   * Manual Stock Count Adjustment (Physical reconciliation)
   */
  async adjustToPhysicalCount(
    storeId: string,
    input: StockAdjustmentInput,
    actorId: string
  ): Promise<StockChangeResult> {
    const { productId, countedQuantity, reason, note, idempotencyKey } = input;
    const countedQty = new Prisma.Decimal(countedQuantity);

    if (countedQty.isNegative()) {
      const error: any = new Error('Counted quantity cannot be negative.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    return await this.prisma.$transaction(async (tx) => {
      // Check idempotency
      const existingMovement = await tx.stockMovement.findUnique({
        where: { idempotencyKey },
      });
      if (existingMovement) {
        const balance = await tx.inventoryBalance.findUnique({
          where: { storeId_productId: { storeId, productId } },
        });
        return {
          success: true,
          productId,
          previousQuantity: balance ? balance.quantityOnHand.toString() : '0',
          newQuantity: balance ? balance.quantityOnHand.toString() : '0',
          difference: existingMovement.quantityDelta.toString(),
          movementId: existingMovement.id,
        };
      }

      const product = await tx.product.findFirst({
        where: { id: productId, storeId },
        include: { inventoryBalance: true },
      });

      if (!product) {
        const error: any = new Error('Product not found in this store.');
        error.code = 'NOT_FOUND';
        error.status = 404;
        throw error;
      }

      let currentQty = new Prisma.Decimal(0);
      let balanceId = product.inventoryBalance?.id;

      if (product.inventoryBalance) {
        currentQty = product.inventoryBalance.quantityOnHand;
      } else {
        const newBal = await tx.inventoryBalance.create({
          data: {
            storeId,
            productId,
            quantityOnHand: new Prisma.Decimal(0),
          },
        });
        balanceId = newBal.id;
      }

      const diff = countedQty.minus(currentQty);

      await tx.inventoryBalance.update({
        where: { id: balanceId },
        data: { quantityOnHand: countedQty },
      });

      const movement = await tx.stockMovement.create({
        data: {
          storeId,
          productId,
          movementType: StockMovementType.MANUAL_ADJUSTMENT,
          quantityDelta: diff,
          unit: product.stockUnit,
          reason: note ? `${reason}: ${note}` : reason,
          referenceType: 'STOCKTAKE',
          idempotencyKey,
          actorType: 'OWNER',
          actorId,
        },
      });

      return {
        success: true,
        productId,
        previousQuantity: currentQty.toString(),
        newQuantity: countedQty.toString(),
        difference: diff.toString(),
        movementId: movement.id,
      };
    });
  }

  /**
   * List inventory balances with filters and pagination
   */
  async listBalances(
    storeId: string,
    options: {
      search?: string;
      categoryId?: string;
      lowStockOnly?: boolean;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));

    const where: Prisma.ProductWhereInput = {
      storeId,
      isActive: true,
    };

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

    const items = products.map((p) => {
      const onHand = p.inventoryBalance ? p.inventoryBalance.quantityOnHand : new Prisma.Decimal(0);
      const isLowStock = onHand.lessThanOrEqualTo(p.reorderLevel);
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        category: p.category.name,
        categoryId: p.categoryId,
        stockUnit: p.stockUnit,
        barcodes: p.barcodes.map((b) => b.barcode),
        sellingPrice: p.sellingPrice.toFixed(2),
        mrp: p.mrp ? p.mrp.toFixed(2) : null,
        reorderLevel: p.reorderLevel.toString(),
        quantityOnHand: onHand.toString(),
        isLowStock,
        updatedAt: p.inventoryBalance?.updatedAt?.toISOString() || p.updatedAt.toISOString(),
      };
    });

    const filteredItems = options.lowStockOnly ? items.filter((i) => i.isLowStock) : items;

    return {
      items: filteredItems,
      pagination: {
        page,
        pageSize,
        total: options.lowStockOnly ? filteredItems.length : total,
      },
    };
  }

  /**
   * Low Stock query for AI Agent & Alerts
   */
  async getLowStock(storeId: string): Promise<LowStockResult[]> {
    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        isActive: true,
      },
      include: {
        category: true,
        barcodes: true,
        inventoryBalance: true,
      },
      orderBy: { name: 'asc' },
    });

    const lowStockItems: LowStockResult[] = [];

    for (const p of products) {
      const onHand = p.inventoryBalance ? p.inventoryBalance.quantityOnHand : new Prisma.Decimal(0);
      if (onHand.lessThanOrEqualTo(p.reorderLevel)) {
        lowStockItems.push({
          productId: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category.name,
          barcodes: p.barcodes.map((b) => b.barcode),
          stockUnit: p.stockUnit,
          quantityOnHand: onHand.toString(),
          reorderLevel: p.reorderLevel.toString(),
          sellingPrice: p.sellingPrice.toFixed(2),
          updatedAt: p.inventoryBalance?.updatedAt?.toISOString() || p.updatedAt.toISOString(),
        });
      }
    }

    return lowStockItems;
  }

  /**
   * Get single product balance and reorder info
   */
  async getProductBalance(storeId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      include: {
        category: true,
        barcodes: true,
        inventoryBalance: true,
      },
    });

    if (!product) {
      const error: any = new Error('Product not found in this store.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    const onHand = product.inventoryBalance ? product.inventoryBalance.quantityOnHand : new Prisma.Decimal(0);

    return {
      productId: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category.name,
      stockUnit: product.stockUnit,
      barcodes: product.barcodes.map((b) => b.barcode),
      reorderLevel: product.reorderLevel.toString(),
      quantityOnHand: onHand.toString(),
      isLowStock: onHand.lessThanOrEqualTo(product.reorderLevel),
      updatedAt: product.inventoryBalance?.updatedAt?.toISOString() || product.updatedAt.toISOString(),
    };
  }

  /**
   * Append-only stock movement ledger history
   */
  async getMovements(
    storeId: string,
    productId: string,
    options: { page?: number; pageSize?: number }
  ) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
    });
    if (!product) {
      const error: any = new Error('Product not found in this store.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { storeId, productId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({
        where: { storeId, productId },
      }),
    ]);

    return {
      movements: movements.map((m) => ({
        id: m.id,
        movementType: m.movementType,
        quantityDelta: m.quantityDelta.toString(),
        unit: m.unit,
        reason: m.reason,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        actorType: m.actorType,
        createdAt: m.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  /**
   * Inventory summary counts for dashboard & analytics
   */
  async getInventoryHealth(storeId: string) {
    const products = await this.prisma.product.findMany({
      where: { storeId, isActive: true },
      include: { inventoryBalance: true },
    });

    let lowStockCount = 0;
    let stockoutCount = 0;

    for (const p of products) {
      const qty = p.inventoryBalance ? p.inventoryBalance.quantityOnHand : new Prisma.Decimal(0);
      if (qty.isZero() || qty.isNegative()) {
        stockoutCount++;
      } else if (qty.lessThanOrEqualTo(p.reorderLevel)) {
        lowStockCount++;
      }
    }

    return {
      totalProducts: products.length,
      lowStockCount,
      stockoutCount,
    };
  }
}
