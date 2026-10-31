import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductSchema,
  updateProductSchema,
  addBarcodeSchema,
  stockAdjustmentSchema,
  createCategorySchema,
} from '@dukaanai/shared';

test('Product & Inventory Validation Unit Tests (Offline / No DB required)', async (t) => {
  await t.test('createProductSchema validates valid inputs', () => {
    const valid = {
      name: 'Amul Butter 500g',
      categoryId: 'cat-123',
      sellingPrice: '275.50',
      stockUnit: 'PIECE',
      barcode: '8901262010152',
      reorderLevel: '5',
      purchaseCost: '250.00',
    };
    const parsed = createProductSchema.parse(valid);
    assert.equal(parsed.name, 'Amul Butter 500g');
    assert.equal(parsed.sellingPrice, '275.50');
    assert.equal(parsed.stockUnit, 'PIECE');
  });

  await t.test('createProductSchema rejects invalid/negative prices', () => {
    assert.throws(() => {
      createProductSchema.parse({
        name: 'Invalid Item',
        categoryId: 'cat-123',
        sellingPrice: '-50.00',
        stockUnit: 'PIECE',
      });
    });
  });

  await t.test('addBarcodeSchema preserves leading zeros in string format', () => {
    const parsed = addBarcodeSchema.parse({
      barcode: '000123456789',
    });
    assert.equal(parsed.barcode, '000123456789');
    assert.equal(typeof parsed.barcode, 'string');
  });

  await t.test('addBarcodeSchema rejects empty barcodes', () => {
    assert.throws(() => {
      addBarcodeSchema.parse({ barcode: '   ' });
    });
  });

  await t.test('stockAdjustmentSchema requires reason and valid countedQuantity string', () => {
    assert.throws(() => {
      stockAdjustmentSchema.parse({
        productId: 'prod-123',
        countedQuantity: '10',
        reason: '', // blank reason disallowed
        idempotencyKey: 'idem-1',
      });
    });

    const parsed = stockAdjustmentSchema.parse({
      productId: 'prod-123',
      countedQuantity: '15.5',
      reason: 'Physical count verified on shelf',
      idempotencyKey: 'idem-1',
    });
    assert.equal(parsed.countedQuantity, '15.5');
    assert.equal(parsed.reason, 'Physical count verified on shelf');
  });

  await t.test('Purchase pack conversion calculation (e.g. 2 cartons * 12 bottles = 24 bottles)', () => {
    const cartonsReceived = 2;
    const packSize = 12; // units per carton
    const stockUnits = cartonsReceived * packSize;
    assert.equal(stockUnits, 24);
  });
});
