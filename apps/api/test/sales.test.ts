import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, Prisma } from '@prisma/client';
import { SalesService } from '../src/modules/sales/sales.service.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { ProductService } from '../src/modules/products/product.service.js';

const prisma = new PrismaClient();
const inventoryService = new InventoryService(prisma);
const productService = new ProductService(prisma);
const salesService = new SalesService(prisma, inventoryService);

const TEST_STORE_ID = 'demo-store';

test('POS & Sales Module Integration Tests', async (t) => {
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
  const category = await prisma.category.findFirst({ where: { storeId: TEST_STORE_ID } });
  assert.ok(category);

  // Seed test products
  const productA = await productService.createProduct(TEST_STORE_ID, {
    name: `POS Sunflower Oil ${runId}`,
    categoryId: category.id,
    sellingPrice: '145.00',
    stockUnit: 'PIECE',
    barcode: `0890${runId}11`,
    openingStockQuantity: '20',
  });

  const productB = await productService.createProduct(TEST_STORE_ID, {
    name: `POS Loose Rice ${runId}`,
    categoryId: category.id,
    sellingPrice: '60.00',
    stockUnit: 'KG',
    barcode: `0890${runId}22`,
    openingStockQuantity: '50.000',
  });

  await t.test('1. Successful CASH sale creates Sale, SaleItems, Payment, and deducts inventory', async () => {
    const idempotencyKey = `pos-cash-${runId}`;

    const sale = await salesService.createSale(
      TEST_STORE_ID,
      {
        idempotencyKey,
        items: [
          { productId: productA.id, quantity: '2', expectedSellingPrice: '145.00' },
          { productId: productB.id, quantity: '1.500', expectedSellingPrice: '60.00' },
        ],
        payment: {
          method: 'CASH',
          amountTendered: '400.00',
        },
      },
      'demo-owner'
    );

    // Total = (2 * 145) + (1.5 * 60) = 290 + 90 = 380.00
    assert.equal(sale.subtotal, '380.00');
    assert.equal(sale.total, '380.00');
    assert.equal(sale.paymentMethod, 'CASH');
    assert.equal(sale.amountPaid, '380.00');
    assert.equal(sale.changeDue, '20.00'); // 400 - 380 = 20
    assert.equal(sale.balanceDue, '0.00');
    assert.equal(sale.items.length, 2);
    assert.equal(sale.payments.length, 1);
    assert.ok(sale.receiptNumber.startsWith('REC-'));

    // Check inventory balance deducted atomically
    const balanceA = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: productA.id } },
    });
    assert.equal(balanceA?.quantityOnHand.toString(), '18'); // 20 - 2 = 18

    const balanceB = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: productB.id } },
    });
    assert.equal(balanceB?.quantityOnHand.toString(), '48.5'); // 50 - 1.5 = 48.5
  });

  await t.test('2. Repeated checkout with same idempotency key returns original sale without duplicate deduction', async () => {
    const idempotencyKey = `pos-cash-${runId}`; // same key as test 1

    const duplicateSale = await salesService.createSale(
      TEST_STORE_ID,
      {
        idempotencyKey,
        items: [
          { productId: productA.id, quantity: '2', expectedSellingPrice: '145.00' },
          { productId: productB.id, quantity: '1.500', expectedSellingPrice: '60.00' },
        ],
        payment: {
          method: 'CASH',
          amountTendered: '400.00',
        },
      },
      'demo-owner'
    );

    assert.equal(duplicateSale.total, '380.00');

    // Balance should STILL be 18 and 48.5 (NOT deducted again!)
    const balanceA = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: TEST_STORE_ID, productId: productA.id } },
    });
    assert.equal(balanceA?.quantityOnHand.toString(), '18');
  });

  await t.test('3. Stale price detection returns 409 PRICE_CHANGED conflict', async () => {
    await assert.rejects(
      async () => {
        await salesService.createSale(TEST_STORE_ID, {
          idempotencyKey: `pos-stale-${runId}`,
          items: [
            { productId: productA.id, quantity: '1', expectedSellingPrice: '120.00' }, // Current is 145.00!
          ],
          payment: { method: 'CASH', amountTendered: '200.00' },
        });
      },
      (err: any) => {
        assert.equal(err.code, 'PRICE_CHANGED');
        assert.equal(err.status, 409);
        assert.equal(err.details.expectedSellingPrice, '120.00');
        assert.equal(err.details.currentSellingPrice, '145.00');
        return true;
      }
    );
  });

  await t.test('4. Insufficient stock returns 409 INSUFFICIENT_STOCK and rolls back transaction', async () => {
    await assert.rejects(
      async () => {
        await salesService.createSale(TEST_STORE_ID, {
          idempotencyKey: `pos-nostock-${runId}`,
          items: [
            { productId: productA.id, quantity: '500', expectedSellingPrice: '145.00' }, // Available is 18
          ],
          payment: { method: 'CASH', amountTendered: '100000.00' },
        });
      },
      (err: any) => {
        assert.equal(err.code, 'INSUFFICIENT_STOCK');
        assert.equal(err.status, 409);
        return true;
      }
    );

    // Verify no sale was created
    const noSale = await prisma.sale.findUnique({
      where: { idempotencyKey: `pos-nostock-${runId}` },
    });
    assert.equal(noSale, null);
  });

  await t.test('5. UPI sale records payment as COMPLETED with 0 change and 0 balance due', async () => {
    const sale = await salesService.createSale(TEST_STORE_ID, {
      idempotencyKey: `pos-upi-${runId}`,
      items: [
        { productId: productA.id, quantity: '1', expectedSellingPrice: '145.00' },
      ],
      payment: {
        method: 'UPI',
        reference: 'UPI-REF-9876543210',
      },
    });

    assert.equal(sale.paymentMethod, 'UPI');
    assert.equal(sale.paymentStatus, 'COMPLETED');
    assert.equal(sale.amountPaid, '145.00');
    assert.equal(sale.changeDue, '0.00');
    assert.equal(sale.balanceDue, '0.00');
    assert.equal(sale.payments[0]?.reference, 'UPI-REF-9876543210');
  });

  await t.test('6. CREDIT sale requires customerLabel and sets balanceDue = total', async () => {
    const sale = await salesService.createSale(TEST_STORE_ID, {
      idempotencyKey: `pos-credit-${runId}`,
      items: [
        { productId: productA.id, quantity: '1', expectedSellingPrice: '145.00' },
      ],
      payment: {
        method: 'CREDIT',
      },
      customerLabel: 'Suresh Kirana Khata #42',
    });

    assert.equal(sale.paymentMethod, 'CREDIT');
    assert.equal(sale.paymentStatus, 'PENDING');
    assert.equal(sale.amountPaid, '0.00');
    assert.equal(sale.changeDue, '0.00');
    assert.equal(sale.balanceDue, '145.00');
    assert.equal(sale.customerLabel, 'Suresh Kirana Khata #42');
  });

  await t.test('7. Sales history list and detail retrieval reads persisted snapshots', async () => {
    const list = await salesService.listSales(TEST_STORE_ID, {
      pageSize: 10,
    });

    assert.ok(list.sales.length >= 3);
    assert.ok(list.pagination.total >= 3);

    const first = list.sales[0];
    assert.ok(first);

    const detailed = await salesService.getSaleById(TEST_STORE_ID, first.id);
    assert.equal(detailed.id, first.id);
    assert.ok(detailed.items.length > 0);
    assert.ok(detailed.items[0]!.productNameSnapshot.length > 0);
  });
});
