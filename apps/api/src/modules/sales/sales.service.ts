import { Prisma, PrismaClient, PaymentMethod, PaymentStatus, SaleStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  CreateSaleInput,
  SaleDto,
  SaleSummaryDto,
  SalesListFilter,
  SaleItemDto,
  PaymentDto,
} from '@dukaanai/shared';
import type { InventoryService } from '../inventory/inventory.service.js';

export class SalesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly inventoryService?: InventoryService
  ) {}

  /**
   * Helper to format a receipt number: REC-YYYYMMDD-XXXX
   */
  private generateReceiptNumber(): string {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `REC-${today}-${rand}`;
  }

  /**
   * Process and persist a new sale atomically:
   * 1. Idempotency guard: return original sale if key already processed.
   * 2. Load and validate active products and stale prices.
   * 3. Compute totals using Decimal-safe math.
   * 4. Validate payment rules (CASH, UPI, CREDIT).
   * 5. Atomically create Sale, SaleItem snapshots, Payment, and deduct stock via InventoryService.
   */
  async createSale(storeId: string, input: CreateSaleInput, userId = 'cashier'): Promise<SaleDto> {
    const { idempotencyKey, items, payment, customerLabel } = input;

    // 1. Check idempotency outside transaction first for fast path
    const existingSale = await this.prisma.sale.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
        payments: true,
      },
    });

    if (existingSale) {
      if (existingSale.storeId !== storeId) {
        const err: any = new Error('Sale belongs to another store context');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      return this.mapToSaleDto(existingSale);
    }

    // 2. Fetch products and primary barcodes for validation & snapshots
    const productIds = Array.from(new Set(items.map((it) => it.productId)));
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId,
        isActive: true,
      },
      include: {
        barcodes: {
          orderBy: { isPrimary: 'desc' },
          take: 1,
        },
        inventoryBalance: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check all products exist and are active
    for (const item of items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        const err: any = new Error(`Product not found or inactive: ${item.productId}`);
        err.status = 404;
        err.code = 'PRODUCT_NOT_FOUND';
        err.details = { productId: item.productId };
        throw err;
      }

      // Stale price guard
      const expectedPriceDec = new Prisma.Decimal(item.expectedSellingPrice);
      if (!prod.sellingPrice.equals(expectedPriceDec)) {
        const err: any = new Error(
          `Price for "${prod.name}" has changed. Expected ₹${expectedPriceDec.toFixed(2)}, current is ₹${prod.sellingPrice.toFixed(2)}.`
        );
        err.status = 409;
        err.code = 'PRICE_CHANGED';
        err.details = {
          productId: prod.id,
          productName: prod.name,
          expectedSellingPrice: expectedPriceDec.toFixed(2),
          currentSellingPrice: prod.sellingPrice.toFixed(2),
        };
        throw err;
      }
    }

    // Aggregate quantities by product for stock checking & deduction
    const aggregatedQuantities = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const qtyDec = new Prisma.Decimal(item.quantity);
      const currentAgg = aggregatedQuantities.get(item.productId) ?? new Prisma.Decimal(0);
      aggregatedQuantities.set(item.productId, currentAgg.plus(qtyDec));
    }

    // Validate stock availability
    for (const [pId, totalNeeded] of aggregatedQuantities.entries()) {
      const prod = productMap.get(pId)!;
      const currentStock = prod.inventoryBalance?.quantityOnHand ?? new Prisma.Decimal(0);
      if (currentStock.lessThan(totalNeeded)) {
        const err: any = new Error(
          `Insufficient stock for "${prod.name}". Available: ${currentStock.toString()}, Requested: ${totalNeeded.toString()}`
        );
        err.status = 409;
        err.code = 'INSUFFICIENT_STOCK';
        err.details = {
          productId: prod.id,
          productName: prod.name,
          availableQuantity: currentStock.toString(),
          requestedQuantity: totalNeeded.toString(),
        };
        throw err;
      }
    }

    // Calculate line totals and subtotal with Decimal precision
    let subtotalDec = new Prisma.Decimal(0);
    const lineCalculations = items.map((line) => {
      const prod = productMap.get(line.productId)!;
      const qtyDec = new Prisma.Decimal(line.quantity);
      const unitPriceDec = prod.sellingPrice;
      const lineTotalDec = qtyDec.times(unitPriceDec);
      subtotalDec = subtotalDec.plus(lineTotalDec);

      return {
        productId: prod.id,
        productNameSnapshot: prod.name,
        barcodeSnapshot: prod.barcodes[0]?.barcode ?? null,
        stockUnitSnapshot: prod.stockUnit,
        quantity: qtyDec,
        unitPriceSnapshot: unitPriceDec,
        unitCostSnapshot: prod.purchaseCost,
        lineTotal: lineTotalDec,
      };
    });

    const totalDec = subtotalDec; // MVP has 0 discount unless specified

    // Payment validation
    let amountPaidDec = new Prisma.Decimal(0);
    let changeDueDec = new Prisma.Decimal(0);
    let balanceDueDec = new Prisma.Decimal(0);
    let paymentStatus: PaymentStatus = PaymentStatus.COMPLETED;
    const paymentMethod = payment.method as PaymentMethod;

    if (paymentMethod === PaymentMethod.CASH) {
      if (!payment.amountTendered) {
        const err: any = new Error('Amount tendered is required for cash payments');
        err.status = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      const tenderedDec = new Prisma.Decimal(payment.amountTendered);
      if (tenderedDec.lessThan(totalDec)) {
        const err: any = new Error(
          `Amount tendered (₹${tenderedDec.toFixed(2)}) is less than total amount (₹${totalDec.toFixed(2)})`
        );
        err.status = 400;
        err.code = 'INSUFFICIENT_TENDERED_AMOUNT';
        throw err;
      }
      amountPaidDec = totalDec;
      changeDueDec = tenderedDec.minus(totalDec);
      balanceDueDec = new Prisma.Decimal(0);
      paymentStatus = PaymentStatus.COMPLETED;
    } else if (paymentMethod === PaymentMethod.UPI) {
      amountPaidDec = totalDec;
      changeDueDec = new Prisma.Decimal(0);
      balanceDueDec = new Prisma.Decimal(0);
      paymentStatus = PaymentStatus.COMPLETED;
    } else if (paymentMethod === PaymentMethod.CREDIT) {
      if (!customerLabel || customerLabel.trim().length === 0) {
        const err: any = new Error('Customer label/name is required for credit (Udhar) sales');
        err.status = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      amountPaidDec = new Prisma.Decimal(0);
      changeDueDec = new Prisma.Decimal(0);
      balanceDueDec = totalDec;
      paymentStatus = PaymentStatus.PENDING;
    }

    // 5. Execute atomic transaction
    const saleResult = await this.prisma.$transaction(async (tx) => {
      // Re-check idempotency inside transaction for strict race condition safety
      const doubleCheck = await tx.sale.findUnique({
        where: { idempotencyKey },
        include: { items: true, payments: true },
      });
      if (doubleCheck) {
        return doubleCheck;
      }

      const receiptNumber = this.generateReceiptNumber();

      // Create Sale
      const createdSale = await tx.sale.create({
        data: {
          storeId,
          receiptNumber,
          status: SaleStatus.COMPLETED,
          subtotal: subtotalDec,
          discountTotal: new Prisma.Decimal(0),
          total: totalDec,
          paymentStatus,
          paymentMethod,
          amountPaid: amountPaidDec,
          changeDue: changeDueDec,
          balanceDue: balanceDueDec,
          customerLabel: customerLabel ? customerLabel.trim() : null,
          idempotencyKey,
          createdBy: userId,
          completedAt: new Date(),
        },
      });

      // Create SaleItems
      for (const line of lineCalculations) {
        await tx.saleItem.create({
          data: {
            saleId: createdSale.id,
            productId: line.productId,
            productNameSnapshot: line.productNameSnapshot,
            barcodeSnapshot: line.barcodeSnapshot,
            stockUnitSnapshot: line.stockUnitSnapshot,
            quantity: line.quantity,
            unitPriceSnapshot: line.unitPriceSnapshot,
            unitCostSnapshot: line.unitCostSnapshot,
            lineTotal: line.lineTotal,
          },
        });
      }

      // Create Payment
      await tx.payment.create({
        data: {
          storeId,
          saleId: createdSale.id,
          method: paymentMethod,
          amount: paymentMethod === PaymentMethod.CASH && payment.amountTendered
            ? new Prisma.Decimal(payment.amountTendered)
            : totalDec,
          status: paymentStatus,
          reference: payment.reference ? payment.reference.trim() : null,
          recordedBy: userId,
        },
      });

      // Deduct inventory for each aggregated product via InventoryService
      if (this.inventoryService) {
        for (const [pId, qty] of aggregatedQuantities.entries()) {
          await this.inventoryService.deductForSale(tx, {
            storeId,
            productId: pId,
            quantity: qty.toString(),
            saleId: createdSale.id,
            idempotencyKey: `${idempotencyKey}:${pId}`,
            actorId: userId,
          });
        }
      }

      // Record outbox event and audit log
      const eventId = randomUUID();
      const eventPayload = {
        eventId,
        eventType: 'sale.completed',
        payloadVersion: 1,
        storeId,
        entityType: 'sale',
        entityId: createdSale.id,
        occurredAt: new Date().toISOString(),
        actor: { type: 'USER', id: userId },
        payload: {
          receiptNumber,
          total: totalDec.toFixed(2),
          paymentMethod,
          itemCount: items.length,
        },
      };

      await tx.outboxEvent.create({
        data: {
          id: eventId,
          storeId,
          eventType: 'sale.completed',
          payloadVersion: 1,
          entityType: 'sale',
          entityId: createdSale.id,
          payload: eventPayload,
        },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          actorId: userId,
          action: 'sale.completed',
          entityType: 'sale',
          entityId: createdSale.id,
          metadata: {
            receiptNumber,
            total: totalDec.toFixed(2),
            paymentMethod,
          },
        },
      });

      // Reload created sale with items and payments
      return await tx.sale.findUniqueOrThrow({
        where: { id: createdSale.id },
        include: { items: true, payments: true },
      });
    });

    return this.mapToSaleDto(saleResult);
  }

  /**
   * Retrieve a sale by ID with immutable item snapshots and payments
   */
  async getSaleById(storeId: string, saleId: string): Promise<SaleDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, storeId },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!sale) {
      const err: any = new Error(`Sale not found: ${saleId}`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return this.mapToSaleDto(sale);
  }

  /**
   * List paginated sales with optional filters
   */
  async listSales(
    storeId: string,
    filter: SalesListFilter = {}
  ): Promise<{ sales: SaleSummaryDto[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.SaleWhereInput = {
      storeId,
    };

    if (filter.paymentMethod) {
      where.paymentMethod = filter.paymentMethod;
    }

    if (filter.search) {
      const s = filter.search.trim();
      where.OR = [
        { receiptNumber: { contains: s, mode: 'insensitive' } },
        { customerLabel: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) {
        where.createdAt.gte = new Date(filter.from);
      }
      if (filter.to) {
        where.createdAt.lte = new Date(filter.to);
      }
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    const mapped: SaleSummaryDto[] = sales.map((s) => ({
      id: s.id,
      receiptNumber: s.receiptNumber,
      status: s.status,
      total: s.total.toFixed(2),
      paymentMethod: s.paymentMethod,
      paymentStatus: s.paymentStatus,
      amountPaid: s.amountPaid.toFixed(2),
      balanceDue: s.balanceDue.toFixed(2),
      customerLabel: s.customerLabel,
      itemCount: s._count.items,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      sales: mapped,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Helper to map Prisma Sale entity to SaleDto with strings for decimal representations
   */
  private mapToSaleDto(sale: any): SaleDto {
    return {
      id: sale.id,
      storeId: sale.storeId,
      receiptNumber: sale.receiptNumber,
      status: sale.status,
      subtotal: sale.subtotal.toFixed(2),
      discountTotal: sale.discountTotal.toFixed(2),
      total: sale.total.toFixed(2),
      paymentStatus: sale.paymentStatus,
      paymentMethod: sale.paymentMethod,
      amountPaid: sale.amountPaid.toFixed(2),
      changeDue: sale.changeDue.toFixed(2),
      balanceDue: sale.balanceDue.toFixed(2),
      customerLabel: sale.customerLabel,
      idempotencyKey: sale.idempotencyKey,
      createdBy: sale.createdBy,
      createdAt: sale.createdAt.toISOString(),
      completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
      items: (sale.items ?? []).map((it: any): SaleItemDto => ({
        id: it.id,
        saleId: it.saleId,
        productId: it.productId,
        productNameSnapshot: it.productNameSnapshot,
        barcodeSnapshot: it.barcodeSnapshot,
        stockUnitSnapshot: it.stockUnitSnapshot,
        quantity: it.quantity.toString(),
        unitPriceSnapshot: it.unitPriceSnapshot.toFixed(2),
        unitCostSnapshot: it.unitCostSnapshot ? it.unitCostSnapshot.toFixed(2) : null,
        lineTotal: it.lineTotal.toFixed(2),
      })),
      payments: (sale.payments ?? []).map((p: any): PaymentDto => ({
        id: p.id,
        saleId: p.saleId,
        method: p.method,
        amount: p.amount.toFixed(2),
        status: p.status,
        reference: p.reference,
        occurredAt: p.occurredAt.toISOString(),
        recordedBy: p.recordedBy,
      })),
    };
  }
}
