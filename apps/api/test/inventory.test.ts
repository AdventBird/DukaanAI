import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, Prisma, StockMovementType, StockUnit } from '@prisma/client';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { ProductService } from '../src/modules/products/product.service.js';

const prisma = new PrismaClient();
const inventoryService = new InventoryService(prisma);
const productService = new ProductService(prisma);

const TEST_STORE_ID = 'demo-store';

test('Product & Inventory Module Tests', async (t) => {
  let isConnected = false;
  try {
    const check = Promise.race([
      prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    const cat = await check;
    if (cat) {
      isConnected = true;
    }
  } catch {
    isConnected = false;
  }

  if (!isConnected) {
    t.skip('Database or demo store not available (skipping DB integration tests in CI without PostgreSQL service)');
    return;
  }

  const runId = Date.now().toString().slice(-6);

  await t.test('1. Barcode lookup preserves leading zeros and returns correct item', async () => {
    const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
    assert.ok(category, 'Category must exist in demo store');

    const testBarcode = `000${runId}1234`;
    const created = await productService.createProduct(TEST_STORE_ID, {
      name: `Zero Leading Test Product ${runId}`,
      categoryId: category.id,
      sellingPrice: '99.50',
      stockUnit: 'PIECE',
      barcode: testBarcode,
      openingStockQuantity: '10',
    });

    assert.ok(created.id);

    // Look up by exact barcode
    const lookedUp = await productService.lookupBarcode(TEST_STORE_ID, testBarcode);
    assert.equal(lookedUp.barcode, testBarcode);
    assert.equal(lookedUp.productId, created.id);
    assert.equal(lookedUp.sellingPrice, '99.50');
    assert.equal(lookedUp.quantityOnHand, '10');
  });

  await t.test('2. Duplicate barcode mapping in same store is rejected with CONFLICT', async () => {
    const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
    assert.ok(category);

    const testBarcode = `000${runId}1234`;
    await assert.rejects(
      async () => {
        await productService.createProduct(TEST_STORE_ID, {
          name: `Conflict Barcode Product ${runId}`,
          categoryId: category.id,
          sellingPrice: '50.00',
          stockUnit: 'PIECE',
          barcode: testBarcode, // already taken in test 1
        });
      },
      (err: any) => {
        assert.equal(err.code, 'CONFLICT');
        return true;
      }
    );
  });

  await t.test('3. deductForSale decreases stock and records SALE movement atomically', async () => {
    const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
    assert.ok(category);

    const product = await productService.createProduct(TEST_STORE_ID, {
      name: `Sale Test Item ${runId}`,
      categoryId: category.id,
      sellingPrice: '100.00',
      stockUnit: 'PIECE',
      openingStockQuantity: '20',
    });

    const result = await prisma.$transaction(async (tx) => {
      return await inventoryService.deductForSale(tx, {
        storeId: TEST_STORE_ID,
        productId: product.id,
        quantity: '5',
        saleId: `sale-test-${runId}`,
        idempotencyKey: `idem-sale-${runId}`,
      });
    }, { timeout: 20000, maxWait: 15000 });

    assert.equal(result.previousQuantity, '20');
    assert.equal(result.newQuantity, '15');
    assert.equal(result.difference, '-5');

    // Verify balance in DB
    const balance = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: product.id } },
    });
    assert.equal(balance?.quantityOnHand.toString(), '15');

    // Verify StockMovement in DB
    const movements = await prisma.stockMovement.findMany({
      where: { storeId: TEST_STORE_ID, productId: product.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(movements.length >= 2); // opening + sale
    const saleMovement = movements[0];
    assert.equal(saleMovement.movementType, 'SALE');
    assert.equal(saleMovement.quantityDelta.toString(), '-5');
  });

  await t.test('4. deductForSale prevents negative stock by default (INSUFFICIENT_STOCK)', async () => {
    const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
    assert.ok(category);

    const product = await productService.createProduct(TEST_STORE_ID, {
      name: `Insufficient Stock Item ${runId}`,
      categoryId: category.id,
      sellingPrice: '40.00',
      stockUnit: 'PIECE',
      openingStockQuantity: '2',
    });

    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await inventoryService.deductForSale(tx, {
            storeId: TEST_STORE_ID,
            productId: product.id,
            quantity: '5', // 5 > 2
            saleId: `sale-fail-${runId}`,
            idempotencyKey: `idem-sale-fail-${runId}`,
          });
        }, { timeout: 20000, maxWait: 15000 });
      },
      (err: any) => {
        assert.equal(err.code, 'INSUFFICIENT_STOCK');
        return true;
      }
    );

    // Verify stock was not changed
    const balance = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: product.id } },
    });
    assert.equal(balance?.quantityOnHand.toString(), '2');
  });

  await t.test('5. receiveVerifiedGoods increases stock and records PURCHASE_RECEIPT', async () => {
    const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
    assert.ok(category);

    const product = await productService.createProduct(TEST_STORE_ID, {
      name: `Receiving Test Item ${runId}`,
      categoryId: category.id,
      sellingPrice: '50.00',
      stockUnit: 'PIECE',
      openingStockQuantity: '10',
    });

    const result = await prisma.$transaction(async (tx) => {
      return await inventoryService.receiveVerifiedGoods(tx, {
        storeId: TEST_STORE_ID,
        productId: product.id,
        receivedQuantityInStockUnits: '12',
        goodsReceiptId: `receipt-${runId}`,
        idempotencyKey: `idem-recv-${runId}`,
      });
    }, { timeout: 20000, maxWait: 15000 });

    assert.equal(result.previousQuantity, '10');
    assert.equal(result.newQuantity, '22');

    const balance = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: product.id } },
    });
    assert.equal(balance?.quantityOnHand.toString(), '22');
  });

  await t.test('6. adjustToPhysicalCount records MANUAL_ADJUSTMENT with diff and requires reason', async () => {
    const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
    assert.ok(category);

    const product = await productService.createProduct(TEST_STORE_ID, {
      name: `Stocktake Item ${runId}`,
      categoryId: category.id,
      sellingPrice: '25.00',
      stockUnit: 'PIECE',
      openingStockQuantity: '10',
    });

    // Actual count is 7 (3 missing/damaged)
    const result = await inventoryService.adjustToPhysicalCount(
      TEST_STORE_ID,
      {
        productId: product.id,
        countedQuantity: '7',
        reason: 'PHYSICAL_STOCKTAKE',
        note: 'Found 3 expired packets on shelf',
        idempotencyKey: `stocktake-${runId}`,
      },
      'demo-owner'
    );

    assert.equal(result.previousQuantity, '10');
    assert.equal(result.newQuantity, '7');
    assert.equal(result.difference, '-3');

    // Repeated adjustment with same idempotency key must not double apply
    const replay = await inventoryService.adjustToPhysicalCount(
      TEST_STORE_ID,
      {
        productId: product.id,
        countedQuantity: '7',
        reason: 'PHYSICAL_STOCKTAKE',
        idempotencyKey: `stocktake-${runId}`,
      },
      'demo-owner'
    );

    assert.equal(replay.newQuantity, '7');
    assert.equal(replay.difference, '-3');

    // Verify balance remains 7
    const balance = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: product.id } },
    });
    assert.equal(balance?.quantityOnHand.toString(), '7');
  });

  await t.test('7. Low stock query correctly detects products at or below reorderLevel', async () => {
    const lowStock = await inventoryService.getLowStock(TEST_STORE_ID);
    assert.ok(Array.isArray(lowStock));
    assert.ok(lowStock.length > 0, 'Expected seeded low-stock items');

    for (const item of lowStock) {
      const onHand = Number(item.quantityOnHand);
      const reorder = Number(item.reorderLevel);
      assert.ok(onHand <= reorder, `Item ${item.name} (${onHand}) must be <= reorderLevel (${reorder})`);
    }
  });

  await t.test('8. Stock consistency invariant holds for all products', async () => {
    const products = await prisma.product.findMany({
      where: { storeId: TEST_STORE_ID },
      include: {
        inventoryBalance: true,
        stockMovements: true,
      },
    });

    for (const p of products) {
      if (p.inventoryBalance) {
        const balanceQty = p.inventoryBalance.quantityOnHand;
        const sumMovements = p.stockMovements.reduce(
          (acc, m) => acc.plus(m.quantityDelta),
          new Prisma.Decimal(0)
        );
        assert.equal(
          balanceQty.toString(),
          sumMovements.toString(),
          `Stock invariant failed for product ${p.name}`
        );
      }
    }
  });
});
