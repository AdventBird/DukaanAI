import test from 'node:test';
import assert from 'node:assert/strict';
import { ProcurementRepository } from '../src/modules/procurement/procurement.repository.js';
import { SupplierRepository } from '../src/modules/suppliers/supplier.repository.js';
import { ProcurementService } from '../src/modules/procurement/procurement.service.js';

test('Purchase Order Lifecycle - State machine, owner approval, revision checks, and idempotent submit', async () => {
  const procRepo = new ProcurementRepository();
  const supRepo = new SupplierRepository();
  const service = new ProcurementService(procRepo, supRepo);

  // 1. Create a draft PO from stored records
  const draft = await service.createPurchaseOrderDraft('demo-store', 'demo-owner', {
    supplierId: 'sup_metro',
    items: [
      {
        productId: 'prod_101',
        quantityInPurchasePacks: '3.000',
        unitPricePerPurchasePack: '216.00',
      },
    ],
    notes: 'Replenishment for Parle-G',
  });

  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.revision, 1);
  assert.equal(draft.estimatedTotal, '648.00'); // 3 * 216 = 648

  // 2. Cannot submit an unapproved order directly
  await assert.rejects(
    async () => {
      await service.submitPurchaseOrder('demo-store', draft.id, {
        expectedRevision: 1,
        idempotencyKey: 'idemp_sub_1',
      });
    },
    /Order cannot be submitted without OWNER approval/
  );

  // 3. Submit for approval
  const pending = await service.submitForApproval('demo-store', draft.id);
  assert.equal(pending.status, 'PENDING_APPROVAL');

  // 4. Non-owner cannot approve
  await assert.rejects(
    async () => {
      await service.approvePurchaseOrder('demo-store', draft.id, 'cashier_user', 'CASHIER', {
        expectedRevision: 1,
        decisionNote: 'Cashier trying to approve',
      });
    },
    /Only a verified store OWNER can approve financial commitments/
  );

  // 5. Revision mismatch rejected
  await assert.rejects(
    async () => {
      await service.approvePurchaseOrder('demo-store', draft.id, 'demo-owner', 'OWNER', {
        expectedRevision: 99,
        decisionNote: 'Wrong revision',
      });
    },
    /Revision mismatch/
  );

  // 6. Successful owner approval
  const approved = await service.approvePurchaseOrder('demo-store', draft.id, 'demo-owner', 'OWNER', {
    expectedRevision: 1,
    decisionNote: 'Approved 3 cartons of Parle-G after quote comparison',
  });
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.approvedById, 'demo-owner');

  // 7. Submit approved order
  const submitted = await service.submitPurchaseOrder('demo-store', draft.id, {
    expectedRevision: 1,
    idempotencyKey: 'idemp_sub_unique_101',
  });
  assert.equal(submitted.status, 'SUBMITTED');
  assert.ok(submitted.supplierReference);

  // 8. Idempotent re-submission returns original order with same supplier reference
  const reSubmitted = await service.submitPurchaseOrder('demo-store', draft.id, {
    expectedRevision: 1,
    idempotencyKey: 'idemp_sub_unique_101',
  });
  assert.equal(reSubmitted.supplierReference, submitted.supplierReference);
  assert.equal(reSubmitted.status, 'SUBMITTED');
});
