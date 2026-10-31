import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteComparisonService } from '../src/modules/procurement/quote-comparison.service.js';

test('Quote Comparison - Normalises different pack sizes and discounts to base stock unit', () => {
  // Supplier A: 1 carton = 24 packets @ Rs 216 / carton -> Rs 9.00 / packet
  // Supplier B: 1 box = 12 packets @ Rs 114 / box -> Rs 9.50 / packet
  const comparison = QuoteComparisonService.compare([
    {
      quoteId: 'quote_a',
      supplierId: 'sup_a',
      supplierName: 'Metro Cash',
      productId: 'prod_biscuit',
      productName: 'Parle-G Biscuit 250g',
      quotedQuantityInPurchasePacks: '2.000',
      purchaseUnitLabel: 'carton',
      unitsPerPack: '24.000',
      unitPricePerPurchasePack: '216.00',
      lineDiscount: '0.00',
      freeStockUnits: '0.000',
      deliveryCharge: '0.00',
      otherCharges: '0.00',
      validUntil: '2026-12-31T00:00:00Z',
      leadTimeDays: 2,
      isAvailable: true,
      moqInPacks: '2.000',
    },
    {
      quoteId: 'quote_b',
      supplierId: 'sup_b',
      supplierName: 'Anand Wholesale',
      productId: 'prod_biscuit',
      productName: 'Parle-G Biscuit 250g',
      quotedQuantityInPurchasePacks: '4.000',
      purchaseUnitLabel: 'box',
      unitsPerPack: '12.000',
      unitPricePerPurchasePack: '114.00',
      lineDiscount: '0.00',
      freeStockUnits: '0.000',
      deliveryCharge: '10.00', // Delivery charge adds to total
      otherCharges: '0.00',
      validUntil: '2026-12-31T00:00:00Z',
      leadTimeDays: 1,
      isAvailable: true,
      moqInPacks: '2.000',
    },
  ]);

  assert.equal(comparison.lines.length, 2);
  const lineA = comparison.lines.find(l => l.quoteId === 'quote_a')!;
  const lineB = comparison.lines.find(l => l.quoteId === 'quote_b')!;

  assert.equal(lineA.effectiveCostPerStockUnit, '9.00');
  // Line B: (4 * 114 + 10) / 48 = 466 / 48 = 9.71
  assert.equal(lineB.effectiveCostPerStockUnit, '9.71');

  // Supplier A is cheaper per base stock unit
  assert.equal(comparison.recommendedQuoteId, 'quote_a');
  assert.match(comparison.recommendationReason, /Best offer: Metro Cash at ₹9.00\/unit/);
});

test('Quote Comparison - Flags stock shortage and shifts recommendation', () => {
  // When Supplier A has insufficient stock (isAvailable: false), Supplier B becomes recommended
  const comparison = QuoteComparisonService.compare([
    {
      quoteId: 'quote_a',
      supplierId: 'sup_a',
      supplierName: 'Metro Cash',
      productId: 'prod_biscuit',
      productName: 'Parle-G Biscuit 250g',
      quotedQuantityInPurchasePacks: '2.000',
      purchaseUnitLabel: 'carton',
      unitsPerPack: '24.000',
      unitPricePerPurchasePack: '216.00',
      lineDiscount: '0.00',
      freeStockUnits: '0.000',
      deliveryCharge: '0.00',
      otherCharges: '0.00',
      validUntil: '2026-12-31T00:00:00Z',
      leadTimeDays: 2,
      isAvailable: false, // Out of stock!
      moqInPacks: '2.000',
    },
    {
      quoteId: 'quote_b',
      supplierId: 'sup_b',
      supplierName: 'Anand Wholesale',
      productId: 'prod_biscuit',
      productName: 'Parle-G Biscuit 250g',
      quotedQuantityInPurchasePacks: '4.000',
      purchaseUnitLabel: 'box',
      unitsPerPack: '12.000',
      unitPricePerPurchasePack: '114.00',
      lineDiscount: '0.00',
      freeStockUnits: '0.000',
      deliveryCharge: '0.00',
      otherCharges: '0.00',
      validUntil: '2026-12-31T00:00:00Z',
      leadTimeDays: 1,
      isAvailable: true,
      moqInPacks: '2.000',
    },
  ]);

  assert.equal(comparison.recommendedQuoteId, 'quote_b');
  assert.match(comparison.recommendationReason, /Best offer: Anand Wholesale/);
});

test('Quote Comparison - Discloses assumptions when freight or validity is unknown', () => {
  const comparison = QuoteComparisonService.compare([
    {
      quoteId: 'quote_unknown',
      supplierId: 'sup_x',
      supplierName: 'Generic Supplier',
      productId: 'prod_rice',
      productName: 'Kolam Rice 25kg',
      quotedQuantityInPurchasePacks: '1.000',
      purchaseUnitLabel: 'bag',
      unitsPerPack: '25.000',
      unitPricePerPurchasePack: '1500.00',
      lineDiscount: '0.00',
      freeStockUnits: '0.000',
      deliveryCharge: '0.00',
      otherCharges: '0.00',
      validUntil: null, // Unknown validity!
      leadTimeDays: null,
      isAvailable: true,
      moqInPacks: '1.000',
    },
  ]);

  const line = comparison.lines[0];
  assert.equal(line.isIncomplete, true);
  assert.equal(line.assumptions.length >= 2, true);
  assert.match(line.assumptions.join(' '), /No quote validity date specified/);
});
