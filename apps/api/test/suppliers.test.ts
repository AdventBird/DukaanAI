import test from 'node:test';
import assert from 'node:assert/strict';
import { SupplierRepository } from '../src/modules/suppliers/supplier.repository.js';
import { SupplierService } from '../src/modules/suppliers/supplier.service.js';

test('Supplier Directory - Create, Read, Update, Archive with Store Isolation', async () => {
  const repo = new SupplierRepository();
  const service = new SupplierService(repo);

  // 1. Create supplier
  const supplier = await service.createSupplier('store_alpha', {
    name: 'National Biscuit Distributors',
    legalName: 'National Biscuit Traders LLP',
    contactPerson: 'Karan Mehra',
    phone: '+919876543210',
    email: 'karan@nbtraders.in',
    preferredContactMethod: 'PORTAL',
    defaultLeadTimeDays: 2,
    defaultPaymentTerms: '7_DAYS',
  });

  assert.equal(supplier.storeId, 'store_alpha');
  assert.equal(supplier.name, 'National Biscuit Distributors');
  assert.equal(supplier.isActive, true);

  // 2. Store isolation: store_beta cannot access store_alpha's supplier
  const crossStoreResult = await service.getSupplier('store_beta', supplier.id);
  assert.equal(crossStoreResult, null);

  // 3. Update supplier
  const updated = await service.updateSupplier('store_alpha', supplier.id, {
    contactPerson: 'Amit Mehra',
    defaultLeadTimeDays: 3,
  });
  assert.equal(updated?.contactPerson, 'Amit Mehra');
  assert.equal(updated?.defaultLeadTimeDays, 3);

  // 4. Archive supplier (soft delete preserves history)
  const archived = await service.archiveSupplier('store_alpha', supplier.id);
  assert.equal(archived?.isActive, false);

  // 5. Query without includeArchived excludes it; with includeArchived includes it
  const activeList = await service.listSuppliers('store_alpha', { page: 1, pageSize: 20 });
  assert.equal(activeList.items.some(s => s.id === supplier.id), false);

  const allList = await service.listSuppliers('store_alpha', { includeArchived: true, page: 1, pageSize: 20 });
  assert.equal(allList.items.some(s => s.id === supplier.id), true);
});

test('Supplier Product Mapping - Pack conversions and MOQ', async () => {
  const repo = new SupplierRepository();
  const service = new SupplierService(repo);

  const supplier = await service.createSupplier('store_alpha', {
    name: 'Gujarat Oil Depot',
    phone: '+919988776655',
    preferredContactMethod: 'PHONE',
  });

  // Map product with 1 carton = 15 bottles
  const mapping = await service.mapProduct('store_alpha', supplier.id, {
    productId: 'prod_mustard_oil',
    supplierSku: 'GUJ-OIL-CTN-15',
    purchaseUnitLabel: 'carton',
    unitsPerPurchasePack: '15.000',
    minimumOrderQuantity: '2.000',
    lastQuotedPrice: '1800.00',
  });

  assert.equal(mapping.unitsPerPurchasePack, '15.000');
  assert.equal(mapping.minimumOrderQuantity, '2.000');
  assert.equal(mapping.purchaseUnitLabel, 'carton');

  // Verify finding suppliers for product
  const suppliersForProd = await service.getSuppliersForProduct('store_alpha', 'prod_mustard_oil');
  assert.equal(suppliersForProd.length, 1);
  assert.equal(suppliersForProd[0].supplier.id, supplier.id);
  assert.equal(suppliersForProd[0].mapping.unitsPerPurchasePack, '15.000');
});
