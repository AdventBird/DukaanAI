import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import type { CreateSaleInput, SalesAnalyticsSummary, TopSellingProductResult } from '@dukaanai/shared';

export class SalesService {
  constructor(private readonly prisma: PrismaClient) {}

  async listSales(
    storeId: string,
    params: {
      page?: number;
      pageSize?: number;
      paymentMethod?: string;
      search?: string;
      from?: Date;
      to?: Date;
    } = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.SaleWhereInput = {
      storeId,
      ...(params.paymentMethod ? { paymentMethod: params.paymentMethod as any } : {}),
      ...(params.search
        ? {
            OR: [
              { receiptNumber: { contains: params.search, mode: 'insensitive' } },
              { customerLabel: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [sales, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: {
          items: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      items: sales.map((sale) => ({
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        status: sale.status,
        subtotal: sale.subtotal.toFixed(2),
        discountTotal: sale.discountTotal.toFixed(2),
        total: sale.total.toFixed(2),
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus,
        amountPaid: sale.amountPaid.toFixed(2),
        changeDue: sale.changeDue.toFixed(2),
        balanceDue: sale.balanceDue.toFixed(2),
        customerLabel: sale.customerLabel,
        itemCount: sale.items.length,
        items: sale.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productNameSnapshot,
          barcode: item.barcodeSnapshot,
          stockUnit: item.stockUnitSnapshot,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPriceSnapshot.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
        createdAt: sale.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getSaleById(storeId: string, idOrReceipt: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        storeId,
        OR: [{ id: idOrReceipt }, { receiptNumber: idOrReceipt }],
      },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!sale) return null;

    return {
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      status: sale.status,
      subtotal: sale.subtotal.toFixed(2),
      discountTotal: sale.discountTotal.toFixed(2),
      total: sale.total.toFixed(2),
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      amountPaid: sale.amountPaid.toFixed(2),
      changeDue: sale.changeDue.toFixed(2),
      balanceDue: sale.balanceDue.toFixed(2),
      customerLabel: sale.customerLabel,
      itemCount: sale.items.length,
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productNameSnapshot,
        barcode: item.barcodeSnapshot,
        stockUnit: item.stockUnitSnapshot,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPriceSnapshot.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount.toFixed(2),
        status: p.status,
        reference: p.reference,
        occurredAt: p.occurredAt.toISOString(),
      })),
      createdAt: sale.createdAt.toISOString(),
    };
  }

  async createSale(storeId: string, actorId: string, input: CreateSaleInput) {
    const idempotencyKey = input.idempotencyKey || `sale-${randomUUID()}`;

    // Check idempotency
    const existing = await this.prisma.sale.findUnique({
      where: { idempotencyKey },
      include: { items: true, payments: true },
    });
    if (existing) {
      return this.getSaleById(storeId, existing.id);
    }

    // Load products
    const productIds = input.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, storeId },
      include: { barcodes: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      if (!productMap.has(item.productId)) {
        throw new Error(`Product not found: ${item.productId}`);
      }
    }

    // Build line items
    let subtotal = new Prisma.Decimal(0);
    const lineItemData: Array<{
      productId: string;
      productNameSnapshot: string;
      barcodeSnapshot: string | null;
      stockUnitSnapshot: string;
      quantity: Prisma.Decimal;
      unitPriceSnapshot: Prisma.Decimal;
      unitCostSnapshot: Prisma.Decimal | null;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const qty = new Prisma.Decimal(item.quantity);
      const priceStr = (item as any).expectedSellingPrice || (item as any).unitPrice;
      const unitPrice = priceStr ? new Prisma.Decimal(priceStr) : product.sellingPrice;
      const primaryBarcode = product.barcodes.find((b) => b.isPrimary)?.barcode || product.barcodes[0]?.barcode || null;
      const lineTotal = unitPrice.mul(qty);

      subtotal = subtotal.add(lineTotal);
      lineItemData.push({
        productId: product.id,
        productNameSnapshot: product.name,
        barcodeSnapshot: primaryBarcode,
        stockUnitSnapshot: product.stockUnit,
        quantity: qty,
        unitPriceSnapshot: unitPrice,
        unitCostSnapshot: product.purchaseCost,
        lineTotal,
      });
    }

    const discountTotal = new Prisma.Decimal(0);
    const total = subtotal.sub(discountTotal);

    const paymentMethod = (input as any).payment?.method || (input as any).paymentMethod || 'CASH';
    const amountTenderedStr = (input as any).payment?.amountTendered || (input as any).amountPaid;
    const paymentRef = (input as any).payment?.reference || null;

    const amountPaid = amountTenderedStr ? new Prisma.Decimal(amountTenderedStr) : (paymentMethod === 'CREDIT' ? new Prisma.Decimal(0) : total);
    const changeDue = amountPaid.gt(total) ? amountPaid.sub(total) : new Prisma.Decimal(0);
    const balanceDue = total.gt(amountPaid) ? total.sub(amountPaid) : new Prisma.Decimal(0);

    const paymentStatus = balanceDue.isZero() ? 'COMPLETED' : 'PENDING';

    // Generate readable receipt number
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replace(/-/g, '');
    const countToday = await this.prisma.sale.count({
      where: {
        storeId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
    const seq = String(countToday + 1).padStart(4, '0');
    const receiptNumber = `BILL-${dateStr}-${seq}`;

    // Execute transaction: create sale, create sale items, deduct stock, log movement, record payment
    const sale = await this.prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({
        data: {
          storeId,
          receiptNumber,
          status: 'COMPLETED',
          subtotal,
          discountTotal,
          total,
          paymentStatus: paymentStatus as any,
          paymentMethod: paymentMethod as any,
          amountPaid,
          changeDue,
          balanceDue,
          customerLabel: input.customerLabel || null,
          idempotencyKey,
          createdBy: actorId,
          items: {
            create: lineItemData,
          },
          payments: {
            create: {
              storeId,
              method: paymentMethod as any,
              amount: amountPaid,
              status: paymentStatus as any,
              reference: paymentRef || (paymentMethod === 'UPI' ? `UPI-${dateStr}-${seq}` : null),
              recordedBy: actorId,
            },
          },
        },
        include: { items: true, payments: true },
      });

      // Stock deduction & movement tracking
      for (const item of lineItemData) {
        await tx.inventoryBalance.upsert({
          where: { storeId_productId: { storeId, productId: item.productId } },
          create: {
            storeId,
            productId: item.productId,
            quantityOnHand: item.quantity.negated(),
          },
          update: {
            quantityOnHand: { decrement: item.quantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: item.productId,
            movementType: 'SALE',
            quantityDelta: item.quantity.negated(),
            unit: item.stockUnitSnapshot,
            referenceType: 'SALE',
            referenceId: createdSale.id,
            actorType: 'STAFF',
            actorId,
            idempotencyKey: `stock-sale-${createdSale.id}-${item.productId}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          storeId,
          actorId,
          action: 'sale.completed',
          entityType: 'sale',
          entityId: createdSale.id,
          metadata: {
            receiptNumber: createdSale.receiptNumber,
            total: createdSale.total.toString(),
            paymentMethod: createdSale.paymentMethod,
            customerLabel: createdSale.customerLabel,
            itemCount: lineItemData.length,
          },
        },
      });

      return createdSale;
    });

    return this.getSaleById(storeId, sale.id);
  }

  async getDashboardSummary(storeId: string, period: 'today' | '7d' | '30d' = 'today') {
    const now = new Date();
    let startDate: Date;

    if (period === 'today') {
      const todayKolkata = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
      startDate = new Date(`${todayKolkata}T00:00:00.000+05:30`);
    } else if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const sales = await this.prisma.sale.findMany({
      where: {
        storeId,
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      include: { items: true },
    });

    if (sales.length === 0) {
      return {
        sales: '0.00',
        transactions: 0,
        averageBasket: '0.00',
        grossProfit: '0.00',
      };
    }

    let totalRevenue = new Prisma.Decimal(0);
    let totalCogs = new Prisma.Decimal(0);

    for (const sale of sales) {
      totalRevenue = totalRevenue.add(sale.total);
      for (const item of sale.items) {
        if (item.unitCostSnapshot) {
          totalCogs = totalCogs.add(item.unitCostSnapshot.mul(item.quantity));
        }
      }
    }

    const transactions = sales.length;
    const averageBasket = totalRevenue.div(transactions).toFixed(2);
    const grossProfit = totalRevenue.sub(totalCogs).toFixed(2);

    return {
      sales: totalRevenue.toFixed(2),
      transactions,
      averageBasket,
      grossProfit,
    };
  }

  async getSalesAnalytics(storeId: string, days: number = 7): Promise<SalesAnalyticsSummary> {
    const now = new Date();
    const startDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const sales = await this.prisma.sale.findMany({
      where: {
        storeId,
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const dayMap = new Map<
      string,
      {
        revenue: Prisma.Decimal;
        transactions: number;
        cash: Prisma.Decimal;
        upi: Prisma.Decimal;
        credit: Prisma.Decimal;
        cogs: Prisma.Decimal;
      }
    >();

    // Initialize past N days
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      dayMap.set(dateKey, {
        revenue: new Prisma.Decimal(0),
        transactions: 0,
        cash: new Prisma.Decimal(0),
        upi: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
        cogs: new Prisma.Decimal(0),
      });
    }

    let overallRevenue = new Prisma.Decimal(0);
    let overallCash = new Prisma.Decimal(0);
    let overallUpi = new Prisma.Decimal(0);
    let overallCredit = new Prisma.Decimal(0);
    let overallCogs = new Prisma.Decimal(0);

    for (const sale of sales) {
      const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(sale.createdAt);
      let dayData = dayMap.get(dateKey);
      if (!dayData) {
        dayData = {
          revenue: new Prisma.Decimal(0),
          transactions: 0,
          cash: new Prisma.Decimal(0),
          upi: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(0),
          cogs: new Prisma.Decimal(0),
        };
        dayMap.set(dateKey, dayData);
      }

      dayData.revenue = dayData.revenue.add(sale.total);
      dayData.transactions += 1;
      overallRevenue = overallRevenue.add(sale.total);

      if (sale.paymentMethod === 'CASH') {
        dayData.cash = dayData.cash.add(sale.total);
        overallCash = overallCash.add(sale.total);
      } else if (sale.paymentMethod === 'UPI') {
        dayData.upi = dayData.upi.add(sale.total);
        overallUpi = overallUpi.add(sale.total);
      } else if (sale.paymentMethod === 'CREDIT') {
        dayData.credit = dayData.credit.add(sale.total);
        overallCredit = overallCredit.add(sale.total);
      }

      for (const item of sale.items) {
        if (item.unitCostSnapshot) {
          const itemCost = item.unitCostSnapshot.mul(item.quantity);
          dayData.cogs = dayData.cogs.add(itemCost);
          overallCogs = overallCogs.add(itemCost);
        }
      }
    }

    const points = Array.from(dayMap.entries()).map(([date, d]) => ({
      date,
      revenue: d.revenue.toFixed(2),
      transactions: d.transactions,
      cashTotal: d.cash.toFixed(2),
      upiTotal: d.upi.toFixed(2),
      creditTotal: d.credit.toFixed(2),
    }));

    const totalTransactions = sales.length;
    const averageBasket = totalTransactions > 0 ? overallRevenue.div(totalTransactions).toFixed(2) : '0.00';
    const grossProfit = overallRevenue.sub(overallCogs);
    const grossMarginPercent = overallRevenue.gt(0)
      ? grossProfit.div(overallRevenue).mul(100).toFixed(1) + '%'
      : '0.0%';

    return {
      period: `${days}d`,
      totalRevenue: overallRevenue.toFixed(2),
      totalTransactions,
      averageBasket,
      grossProfit: grossProfit.toFixed(2),
      grossMarginPercent,
      cashTotal: overallCash.toFixed(2),
      upiTotal: overallUpi.toFixed(2),
      creditTotal: overallCredit.toFixed(2),
      points,
    };
  }

  async getTopSellingProducts(storeId: string, limit: number = 5): Promise<TopSellingProductResult[]> {
    const items = await this.prisma.saleItem.groupBy({
      by: ['productId', 'productNameSnapshot', 'stockUnitSnapshot'],
      where: { sale: { storeId, status: 'COMPLETED' } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });

    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => {
      const prod = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: item.productNameSnapshot,
        brand: prod?.brand || null,
        category: prod?.category?.name || 'General Kirana',
        stockUnit: item.stockUnitSnapshot,
        unitsSold: item._sum.quantity?.toString() ?? '0',
        revenue: item._sum.lineTotal?.toFixed(2) ?? '0.00',
      };
    });
  }

  async getFinanceSummary(storeId: string, from: Date, to: Date) {
    const [sales, expenseAggregate] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          storeId,
          status: 'COMPLETED',
          createdAt: { gte: from, lte: to },
        },
        include: { items: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          storeId,
          occurredAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    let revenue = new Prisma.Decimal(0);
    let costOfGoodsSold = new Prisma.Decimal(0);

    for (const sale of sales) {
      revenue = revenue.add(sale.total);
      for (const item of sale.items) {
        if (item.unitCostSnapshot) {
          costOfGoodsSold = costOfGoodsSold.add(item.unitCostSnapshot.mul(item.quantity));
        }
      }
    }

    const recordedExpenses = expenseAggregate._sum.amount ?? new Prisma.Decimal(0);
    const expenseCount = expenseAggregate._count._all;

    const grossProfit = revenue.sub(costOfGoodsSold);
    const estimatedOperatingResult = grossProfit.sub(recordedExpenses);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      currency: 'INR',
      revenue: revenue.toFixed(2),
      costOfGoodsSold: costOfGoodsSold.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      recordedExpenses: recordedExpenses.toFixed(2),
      expenseCount,
      estimatedOperatingResult: estimatedOperatingResult.toFixed(2),
      dataAvailable: true,
      unavailable: [],
    };
  }
}
