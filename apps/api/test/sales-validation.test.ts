import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  createSaleSchema,
  saleItemInputSchema,
  salePaymentInputSchema,
  type CreateSaleInput,
} from '@dukaanai/shared';

test('Dev 2 POS & Sales Offline Validation Unit Tests', async (t) => {
  await t.test('1. createSaleSchema accepts valid CASH sale payload', () => {
    const input: CreateSaleInput = {
      idempotencyKey: 'pos-test-001',
      items: [
        { productId: 'prod-01', quantity: '2', expectedSellingPrice: '145.00' },
        { productId: 'prod-02', quantity: '1.500', expectedSellingPrice: '40.00' },
      ],
      payment: {
        method: 'CASH',
        amountTendered: '400.00',
      },
    };

    const parsed = createSaleSchema.safeParse(input);
    assert.equal(parsed.success, true);
  });

  await t.test('2. createSaleSchema rejects empty items cart', () => {
    const input = {
      idempotencyKey: 'pos-test-002',
      items: [],
      payment: {
        method: 'CASH',
        amountTendered: '100.00',
      },
    };

    const parsed = createSaleSchema.safeParse(input);
    assert.equal(parsed.success, false);
    assert.match(parsed.error!.issues[0]!.message, /at least one item/i);
  });

  await t.test('3. saleItemInputSchema rejects zero or negative quantities', () => {
    const zeroQty = saleItemInputSchema.safeParse({
      productId: 'prod-01',
      quantity: '0',
      expectedSellingPrice: '10.00',
    });
    assert.equal(zeroQty.success, false);

    const negQty = saleItemInputSchema.safeParse({
      productId: 'prod-01',
      quantity: '-2',
      expectedSellingPrice: '10.00',
    });
    assert.equal(negQty.success, false);
  });

  await t.test('4. saleItemInputSchema enforces decimal quantity precision (max 3 decimal places)', () => {
    const valid3Decimals = saleItemInputSchema.safeParse({
      productId: 'prod-01',
      quantity: '1.250',
      expectedSellingPrice: '10.00',
    });
    assert.equal(valid3Decimals.success, true);

    const invalid4Decimals = saleItemInputSchema.safeParse({
      productId: 'prod-01',
      quantity: '1.2505',
      expectedSellingPrice: '10.00',
    });
    assert.equal(invalid4Decimals.success, false);
  });

  await t.test('5. createSaleSchema requires customerLabel when payment method is CREDIT', () => {
    const creditWithoutLabel = createSaleSchema.safeParse({
      idempotencyKey: 'pos-test-003',
      items: [{ productId: 'prod-01', quantity: '1', expectedSellingPrice: '50.00' }],
      payment: {
        method: 'CREDIT',
      },
      customerLabel: '',
    });
    assert.equal(creditWithoutLabel.success, false);
    assert.match(creditWithoutLabel.error!.issues[0]!.message, /Customer name or label is required/i);

    const creditWithLabel = createSaleSchema.safeParse({
      idempotencyKey: 'pos-test-004',
      items: [{ productId: 'prod-01', quantity: '1', expectedSellingPrice: '50.00' }],
      payment: {
        method: 'CREDIT',
      },
      customerLabel: 'Ramesh Sharma (Shop neighbor)',
    });
    assert.equal(creditWithLabel.success, true);
  });

  await t.test('6. Decimal money math avoids binary floating point errors', () => {
    // In JavaScript floating point, 0.1 + 0.2 = 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    assert.notEqual(floatSum, 0.3);

    // With Prisma.Decimal, math is exact
    const decA = new Prisma.Decimal('0.10');
    const decB = new Prisma.Decimal('0.20');
    const decSum = decA.plus(decB);
    assert.equal(decSum.toFixed(2), '0.30');

    // Fractional quantity * unit price
    const qty = new Prisma.Decimal('1.375'); // 1 kg 375 grams
    const unitPrice = new Prisma.Decimal('84.00'); // ₹84 / kg
    const lineTotal = qty.times(unitPrice);
    assert.equal(lineTotal.toFixed(2), '115.50');
  });

  await t.test('7. Cash change calculation and tendered validation', () => {
    const total = new Prisma.Decimal('342.50');
    const tendered = new Prisma.Decimal('500.00');

    assert.equal(tendered.greaterThanOrEqualTo(total), true);
    const changeDue = tendered.minus(total);
    assert.equal(changeDue.toFixed(2), '157.50');

    const insufficientTendered = new Prisma.Decimal('300.00');
    assert.equal(insufficientTendered.lessThan(total), true);
  });

  await t.test('8. Same-product cart line aggregation logic', () => {
    const lines = [
      { productId: 'prod-101', quantity: '2.000', expectedSellingPrice: '50.00' },
      { productId: 'prod-202', quantity: '1.000', expectedSellingPrice: '30.00' },
      { productId: 'prod-101', quantity: '3.500', expectedSellingPrice: '50.00' },
    ];

    const aggregated = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const q = new Prisma.Decimal(line.quantity);
      const curr = aggregated.get(line.productId) ?? new Prisma.Decimal(0);
      aggregated.set(line.productId, curr.plus(q));
    }

    assert.equal(aggregated.size, 2);
    assert.equal(aggregated.get('prod-101')!.toFixed(3), '5.500');
    assert.equal(aggregated.get('prod-202')!.toFixed(3), '1.000');
  });
});
