import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, Prisma } from '@prisma/client';
import { ReplenishmentTriggerService } from '../src/modules/ai/replenishment-trigger.service.js';
import { taskService } from '../src/modules/ai/task.service.js';
import { toolRegistry } from '../src/modules/ai/tools/tool.registry.js';
import { replenishmentAgent } from '../src/modules/ai/replenishment.agent.js';
import { procurementService } from '../src/modules/procurement/procurement.service.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';

const prisma = new PrismaClient();
const inventoryService = new InventoryService(prisma);
procurementService.configurePersistence(prisma, inventoryService);
taskService.setPrisma(prisma);
replenishmentAgent.setPrisma(prisma);

test('Autonomous Restocking Employee - Complete Hackathon Workflow', async (t) => {
  const isConnected = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  if (!isConnected) {
    t.skip('Database unavailable, skipping cloud integration tests');
    return;
  }

  const runId = Date.now().toString().slice(-6);
  const STORE_A = `test-restock-store-a-${runId}`;
  const STORE_B = `test-restock-store-b-${runId}`;

  // Provision Store A and Store B
  await prisma.store.createMany({
    data: [
      { id: STORE_A, name: `Restock Test Kirana A ${runId}`, currency: 'INR' },
      { id: STORE_B, name: `Restock Test Kirana B ${runId}`, currency: 'INR' },
    ],
  });

  const catA = await prisma.category.create({
    data: { storeId: STORE_A, name: `Snacks ${runId}` },
  });

  // Provision Parle-G 100g scenario in Store A:
  // Current stock: 8, Min stock: 10, Target stock: 40
  const productA = await prisma.product.create({
    data: {
      id: `prod-parleg-${runId}`,
      storeId: STORE_A,
      name: 'Parle-G 100g Glucose Biscuits',
      sku: `PARLE-G-${runId}`,
      categoryId: catA.id,
      stockUnit: 'PACKET',
      sellingPrice: new Prisma.Decimal('10.00'),
      purchaseCost: new Prisma.Decimal('8.00'),
      reorderLevel: new Prisma.Decimal('10.00'), // Min threshold: 10
      targetStockLevel: new Prisma.Decimal('40.00'), // Target: 40
      inventoryBalance: {
        create: {
          storeId: STORE_A,
          quantityOnHand: new Prisma.Decimal('8.000'), // Stock: 8 <= 10
        },
      },
    },
  });

  // Provision Supplier A (₹42, 1-day lead time) and Supplier B (₹40, 3-day lead time)
  const supplierA = await prisma.supplier.create({
    data: {
      storeId: STORE_A,
      name: `Anand Wholesale (Supplier A) ${runId}`,
      phone: '+91 98201 11222',
      defaultLeadTimeDays: 1,
      defaultPaymentTerms: 'NET_7',
    },
  });

  const supplierB = await prisma.supplier.create({
    data: {
      storeId: STORE_A,
      name: `Balaji Traders (Supplier B) ${runId}`,
      phone: '+91 98202 33444',
      defaultLeadTimeDays: 3,
      defaultPaymentTerms: 'NET_15',
    },
  });

  await prisma.supplierProduct.createMany({
    data: [
      {
        storeId: STORE_A,
        supplierId: supplierA.id,
        productId: productA.id,
        purchaseUnitLabel: 'Packet',
        unitsPerPurchasePack: new Prisma.Decimal('1.000'),
        minimumOrderQuantity: new Prisma.Decimal('1.000'),
        lastQuotedPrice: new Prisma.Decimal('42.00'),
        leadTimeDays: 1,
      },
      {
        storeId: STORE_A,
        supplierId: supplierB.id,
        productId: productA.id,
        purchaseUnitLabel: 'Packet',
        unitsPerPurchasePack: new Prisma.Decimal('1.000'),
        minimumOrderQuantity: new Prisma.Decimal('1.000'),
        lastQuotedPrice: new Prisma.Decimal('40.00'),
        leadTimeDays: 3,
      },
    ],
  });

  const triggerService = new ReplenishmentTriggerService(prisma);

  let createdTaskId: string;

  await t.test('1. Automatic Low-Stock Trigger detects stock <= min threshold and creates durable task', async () => {
    const res = await triggerService.evaluateProductReorder(STORE_A, productA.id, {
      triggerSource: 'SALE_CHECKOUT',
      autoExecute: false, // Don't execute yet, check task creation first
    });

    assert.equal(res.triggered, true);
    assert.ok(res.taskId);
    createdTaskId = res.taskId!;

    const task = await taskService.getTaskAsync(createdTaskId);
    assert.ok(task);
    assert.equal(task.status, 'QUEUED');
    assert.equal(task.taskType, 'REPLENISHMENT');
    assert.equal(task.checkpoint.currentStock, '8');
    assert.equal(task.checkpoint.minStock, '10');
    assert.equal(task.checkpoint.targetStock, '40');
  });

  await t.test('2. Trigger Deduplication: subsequent sales update existing task context without creating duplicates', async () => {
    const dupRes = await triggerService.evaluateProductReorder(STORE_A, productA.id, {
      triggerSource: 'SALE_CHECKOUT_REPEAT',
      autoExecute: false,
    });

    assert.equal(dupRes.triggered, false);
    assert.equal(dupRes.taskId, createdTaskId);
    assert.ok(dupRes.reason.includes('already exists'));

    // Check that there is still only 1 task
    const allTasks = await taskService.listTasksAsync(STORE_A);
    const productTasks = allTasks.filter((t) => t.relatedEntityId === productA.id);
    assert.equal(productTasks.length, 1);
  });

  await t.test('3. Deterministic Tools - Reorder quantity and supplier trade-off calculation', async () => {
    const toolCtx = {
      storeId: STORE_A,
      userId: 'test-agent',
      requestId: `req-${runId}`,
      prisma,
    };

    // Calculate Reorder Quantity: Target (40) - Current (8) - Incoming (0) = 32 units
    const reorderTool = toolRegistry.get('calculate_reorder_quantity')!;
    const reorderRes = await reorderTool.execute(toolCtx, {
      targetStock: 40,
      currentStock: 8,
      incomingStock: 0,
      packSize: 1,
      moq: 1,
    });
    const reorderData = reorderRes.data as any;
    assert.equal(reorderData.finalUnits, 32);

    // Compare Supplier Offers:
    // Supplier A: ₹42, 1-day lead time -> Low stockout risk
    // Supplier B: ₹40, 3-day lead time -> High stockout risk (stock runs out before delivery)
    const compareTool = toolRegistry.get('compare_supplier_offers')!;
    const compareRes = await compareTool.execute(toolCtx, {
      productId: productA.id,
      targetQuantity: 32,
    });
    const compareData = compareRes.data as any;
    assert.equal(compareData.offers.length, 2);
    // Supplier A should be recommended for fast lead time
    assert.equal(compareData.recommendedSupplierId, supplierA.id);
    assert.ok(compareData.reasoning.includes(supplierA.name));
  });

  let purchaseOrderId: string;

  await t.test('4. AI Agent Workflow execution creates PO draft and pauses at WAITING_APPROVAL', async () => {
    await replenishmentAgent.executeTask(createdTaskId);

    const task = await taskService.getTaskAsync(createdTaskId);
    assert.ok(task);
    assert.equal(task.status, 'WAITING_APPROVAL');
    assert.ok(task.checkpoint.purchaseOrderId);
    purchaseOrderId = task.checkpoint.purchaseOrderId as string;

    // Verify PO Draft created in Database and advanced to PENDING_APPROVAL for owner
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    });
    assert.ok(po);
    assert.equal(po.status, 'PENDING_APPROVAL');
    assert.equal(po.supplierId, supplierA.id);
    assert.equal(po.items.length, 1);
    assert.equal(po.items[0]!.productId, productA.id);
  });

  await t.test('5. Store Owner Approval Requirement - Moves PO to APPROVED and task advances', async () => {
    // Non-owner cannot approve
    await assert.rejects(
      async () => {
        await procurementService.approvePurchaseOrder(STORE_A, purchaseOrderId, 'cashier-1', 'CASHIER', {
          expectedRevision: 1,
          decisionNote: 'Cashier trying to approve',
        });
      },
      /Only a verified store OWNER can approve/
    );

    // Owner approves successfully
    const approvedPo = await procurementService.approvePurchaseOrder(STORE_A, purchaseOrderId, 'owner-1', 'OWNER', {
      expectedRevision: 1,
      decisionNote: 'Authorized restock order by owner',
    });
    assert.equal(approvedPo.status, 'APPROVED');

    // Place order with supplier (SUBMITTED)
    const submittedPo = await procurementService.submitPurchaseOrder(STORE_A, purchaseOrderId, {
      expectedRevision: approvedPo.revision,
      idempotencyKey: `submit-${runId}`,
      submissionChannel: 'DIRECT',
    });
    assert.equal(submittedPo.status, 'SUBMITTED');

    taskService.advanceStep(createdTaskId, 4, 'COMPLETED', 'Approved by owner and placed with supplier.');
    taskService.updateTaskStatus(createdTaskId, 'WAITING_EXTERNAL');
  });

  await t.test('6. Goods Receipt with Discrepancy - Inventory increases only by verified saleable stock', async () => {
    // Reorder quantity was calculated as 32 units.
    // Owner records receipt of 32 ordered units:
    // 28 saleable received, 2 damaged, 2 missing (28 + 2 + 2 = 32)
    const poItem = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId } });
    assert.ok(poItem);

    const receiptDraft = await procurementService.createGoodsReceiptDraft(STORE_A, purchaseOrderId, {
      purchaseOrderId,
      items: [
        {
          purchaseOrderItemId: poItem.id,
          productId: productA.id,
          deliveredQuantityInPurchasePacks: '32.000',
          acceptedQuantityInStockUnits: '28.000', // Only 28 saleable!
          damagedQuantityInStockUnits: '2.000',
          shortQuantityInStockUnits: '2.000',
          notes: '2 damaged in transit, 2 missing from carton',
        },
      ],
    });

    assert.ok(receiptDraft.id);

    // Confirm receipt
    const confirmResult = await procurementService.confirmGoodsReceipt(
      STORE_A,
      receiptDraft.id,
      'owner-1',
      'OWNER',
      { idempotencyKey: `confirm-${runId}` }
    );

    assert.equal(confirmResult.goodsReceipt.status, 'CONFIRMED');

    // Check inventory balance:
    // Initial 8 + 28 saleable received = 36! (Not 32+8=40, damaged and missing are excluded)
    const updatedBalance = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: STORE_A, productId: productA.id } },
    });
    assert.equal(updatedBalance?.quantityOnHand.toString(), '36');

    // Check idempotency: second confirmation with same key does not double-increment stock
    const duplicateConfirm = await procurementService.confirmGoodsReceipt(
      STORE_A,
      receiptDraft.id,
      'owner-1',
      'OWNER',
      { idempotencyKey: `confirm-${runId}` }
    );
    assert.equal(duplicateConfirm.goodsReceipt.status, 'CONFIRMED');
    const balanceAfterDuplicate = await prisma.inventoryBalance.findUnique({
      where: { storeId_productId: { storeId: STORE_A, productId: productA.id } },
    });
    assert.equal(balanceAfterDuplicate?.quantityOnHand.toString(), '36');
  });

  await t.test('7. Cross-Store Isolation - Store B cannot read Store A products or suppliers', async () => {
    const toolCtxB = {
      storeId: STORE_B,
      userId: 'agent-b',
      requestId: `req-b-${runId}`,
      prisma,
    };

    const invTool = toolRegistry.get('get_inventory_position')!;
    const invResB = await invTool.execute(toolCtxB, { productId: productA.id });
    assert.ok(invResB.summary.includes('not found'));

    const suppTool = toolRegistry.get('get_supplier_options')!;
    const suppResB = await suppTool.execute(toolCtxB, { productId: productA.id });
    const suppDataB = suppResB.data as any[];
    assert.equal(suppDataB.length, 0);
  });
});
