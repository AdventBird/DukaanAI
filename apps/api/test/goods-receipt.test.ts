import test from 'node:test';
import assert from 'node:assert/strict';
import { ProcurementRepository } from '../src/modules/procurement/procurement.repository.js';
import { SupplierRepository } from '../src/modules/suppliers/supplier.repository.js';
import { ProcurementService } from '../src/modules/procurement/procurement.service.js';
import { inventoryDomainService } from '../src/modules/inventory/inventory-service.js';

test('Goods Receipt & Inventory Integration - Partial delivery, damage recording, stock ledger update and invoice isolation', async () => {
  const procRepo = new ProcurementRepository();
  const supRepo = new SupplierRepository();
  const service = new ProcurementService(procRepo, supRepo, inventoryDomainService);

  // Use the seeded submitted PO: 'po_demo_sample'
  // Ordered: 2 cartons of Fortune Sunflower Oil 1L = 24 stock units
  const initialStock = parseFloat(await inventoryDomainService.getStockBalance('demo-store', 'prod_102'));

  // 1. Create a Goods Receipt Draft with partial delivery:
  // 1 carton arrived (12 units), 10 accepted in sellable stock, 2 damaged!
  const draftReceipt = await service.createGoodsReceiptDraft('demo-store', 'po_demo_sample', {
    deliveryNoteReference: 'DN-METRO-4410',
    notes: 'Driver arrived, box was slightly wet on bottom.',
    items: [
      {
        purchaseOrderItemId: 'poi_101',
        productId: 'prod_102',
        deliveredQuantityInPurchasePacks: '1.000',
        acceptedQuantityInStockUnits: '10.000',
        damagedQuantityInStockUnits: '2.000',
        rejectedQuantityInStockUnits: '0.000',
        shortQuantityInStockUnits: '12.000', // 12 units short out of 24 ordered
        excessQuantityInStockUnits: '0.000',
        discrepancyReason: 'Partial delivery of 1 carton instead of 2; 2 pouches damaged due to leakage.',
      },
    ],
  });

  assert.equal(draftReceipt.status, 'DRAFT');

  // Stock has NOT changed yet (draft receipt does not update inventory)
  const stockBeforeConfirm = parseFloat(await inventoryDomainService.getStockBalance('demo-store', 'prod_102'));
  assert.equal(stockBeforeConfirm, initialStock);

  // 2. Owner confirms receipt
  const confirmResult = await service.confirmGoodsReceipt(
    'demo-store',
    draftReceipt.id,
    'demo-owner',
    'OWNER',
    {
      idempotencyKey: 'idemp_gr_confirm_001',
      verificationNote: 'Verified 10 good pouches accepted, 2 damaged set aside.',
    }
  );

  assert.equal(confirmResult.goodsReceipt.status, 'CONFIRMED');
  // Partial delivery: PO must transition to PARTIALLY_RECEIVED, not RECEIVED
  assert.equal(confirmResult.purchaseOrder.status, 'PARTIALLY_RECEIVED');

  // Inventory balance increases ONLY by accepted quantity (10 units), NOT damaged units (2 units)
  const stockAfterConfirm = parseFloat(await inventoryDomainService.getStockBalance('demo-store', 'prod_102'));
  assert.equal(stockAfterConfirm, initialStock + 10);

  // 3. Repeated confirmation with same idempotency key does not add duplicate stock
  const repeatConfirm = await service.confirmGoodsReceipt(
    'demo-store',
    draftReceipt.id,
    'demo-owner',
    'OWNER',
    {
      idempotencyKey: 'idemp_gr_confirm_001',
    }
  );
  const stockAfterRepeat = parseFloat(await inventoryDomainService.getStockBalance('demo-store', 'prod_102'));
  assert.equal(stockAfterRepeat, initialStock + 10); // No double count!

  // 4. Invoice upload does NOT increase stock
  await service.attachInvoice('demo-store', 'po_demo_sample', {
    invoiceNumber: 'INV-METRO-9988',
    invoiceDate: new Date().toISOString(),
    totalInvoicedAmount: '2880.00',
    notes: 'Distributor billed for full 2 cartons',
    lineItems: [
      {
        productId: 'prod_102',
        invoicedPacks: '2.000',
        invoicedPricePerPack: '1440.00',
        invoicedTotal: '2880.00',
      },
    ],
  });

  const stockAfterInvoice = parseFloat(await inventoryDomainService.getStockBalance('demo-store', 'prod_102'));
  assert.equal(stockAfterInvoice, initialStock + 10); // Stock strictly unchanged by invoice upload!

  // 5. Reconciliation report highlights discrepancies
  const reconciliation = await service.getReconciliationReport('demo-store', 'po_demo_sample');
  assert.equal(reconciliation.hasInvoice, true);
  assert.equal(reconciliation.isFullyReconciled, false);
  assert.ok(reconciliation.warnings.some(w => w.includes('Short delivery')));
  assert.ok(reconciliation.warnings.some(w => w.includes('Damage recorded')));
});
