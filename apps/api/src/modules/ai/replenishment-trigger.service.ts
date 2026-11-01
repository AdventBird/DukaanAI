import type { PrismaClient } from '@prisma/client';
import { taskService } from './task.service.js';
import { replenishmentAgent } from './replenishment.agent.js';

export interface ReorderEvaluationResult {
  triggered: boolean;
  taskId?: string;
  reason: string;
  productName?: string;
  currentStock?: string;
  minStock?: string;
  targetStock?: string;
}

async function retryPrisma<T>(fn: () => Promise<T>, attempts = 3, delayMs = 300): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return fn();
}

export class ReplenishmentTriggerService {
  constructor(private prisma: PrismaClient) {}

  async evaluateProductReorder(
    storeId: string,
    productId: string,
    options: {
      triggerSource?: string;
      actorId?: string;
      autoExecute?: boolean;
    } = {}
  ): Promise<ReorderEvaluationResult> {
    const product = await retryPrisma(() =>
      this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventoryBalance: true,
        },
      })
    );

    if (!product || product.storeId !== storeId) {
      return { triggered: false, reason: 'Product not found or store mismatch' };
    }

    const currentStock = Number(product.inventoryBalance?.quantityOnHand ?? 0);
    const minStock = Number(product.reorderLevel ?? 0);
    const rawTarget = product.targetStockLevel ? Number(product.targetStockLevel) : 0;
    const targetStock = rawTarget > 0 ? rawTarget : (minStock > 0 ? minStock * 4 : 40);

    // 1. Condition check: stock must be at or below minimum threshold
    if (currentStock > minStock) {
      return {
        triggered: false,
        reason: `Current stock (${currentStock}) is above minimum threshold (${minStock}). No reorder required.`,
        productName: product.name,
        currentStock: currentStock.toString(),
        minStock: minStock.toString(),
      };
    }

    // 2. Incoming stock check: check confirmed open purchase orders
    const openPoLines = await this.prisma.purchaseOrderItem.findMany({
      where: {
        productId,
        purchaseOrder: {
          storeId,
          status: { in: ['APPROVED', 'SUBMITTED', 'PARTIALLY_RECEIVED'] },
        },
      },
      select: {
        orderedQuantityInStockUnits: true,
        receivedQuantityInStockUnits: true,
      },
    });

    const incomingConfirmedStock = openPoLines.reduce((acc, line) => {
      const remaining = Number(line.orderedQuantityInStockUnits) - Number(line.receivedQuantityInStockUnits);
      return acc + Math.max(0, remaining);
    }, 0);

    // If incoming confirmed stock brings total above min threshold, skip new order
    if (currentStock + incomingConfirmedStock > minStock) {
      return {
        triggered: false,
        reason: `Current stock (${currentStock}) + incoming confirmed PO stock (${incomingConfirmedStock}) satisfies safety threshold (${minStock}).`,
        productName: product.name,
        currentStock: currentStock.toString(),
        minStock: minStock.toString(),
      };
    }

    // 3. Deduplication: Only one open replenishment task should exist for the same store and product
    const existingTask = await taskService.findOpenReplenishmentTaskAsync(storeId, productId);
    if (existingTask) {
      taskService.updateTaskStatus(existingTask.id, existingTask.status, undefined, {
        latestStockChecked: currentStock.toString(),
        latestReevaluationAt: new Date().toISOString(),
        latestTriggerSource: options.triggerSource || 'SALE_CHECKOUT',
      });
      return {
        triggered: false,
        taskId: existingTask.id,
        reason: `Open replenishment task ${existingTask.id} already exists (${existingTask.status}). Task context updated.`,
        productName: product.name,
        currentStock: currentStock.toString(),
        minStock: minStock.toString(),
      };
    }

    // 4. Create durable replenishment task
    const task = taskService.createTask({
      storeId,
      taskType: 'REPLENISHMENT',
      inputSummary: `Autonomous replenishment for ${product.name} (Stock: ${currentStock} <= Min: ${minStock})`,
      relatedEntityType: 'PRODUCT',
      relatedEntityId: productId,
      steps: [
        { name: 'Analyze Inventory & Sales Velocity', toolName: 'get_inventory_position' },
        { name: 'Calculate Target Reorder Quantity', toolName: 'calculate_reorder_quantity' },
        { name: 'Compare Supplier Quotes & Lead Times', toolName: 'compare_supplier_offers' },
        { name: 'Prepare Purchase Order Draft', toolName: 'create_purchase_order_draft' },
        { name: 'Pause for Kirana Store Owner Approval', toolName: 'submit_order_for_approval' },
      ],
      initialCheckpoint: {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        stockUnit: product.stockUnit,
        currentStock: currentStock.toString(),
        minStock: minStock.toString(),
        targetStock: targetStock.toString(),
        incomingConfirmedStock: incomingConfirmedStock.toString(),
        triggerSource: options.triggerSource || 'SALE_CHECKOUT',
        triggeredAt: new Date().toISOString(),
      },
    });

    // 5. Asynchronously trigger AI agent execution
    if (options.autoExecute !== false) {
      setTimeout(() => {
        replenishmentAgent.executeTask(task.id).catch((err) => {
          console.warn(`[ReplenishmentTrigger] Autonomous execution failed for ${task.id}:`, err?.message);
        });
      }, 50);
    }

    return {
      triggered: true,
      taskId: task.id,
      reason: `Low stock detected! Created durable task ${task.id} for ${product.name}.`,
      productName: product.name,
      currentStock: currentStock.toString(),
      minStock: minStock.toString(),
      targetStock: targetStock.toString(),
    };
  }

  async reconcileAllLowStockProducts(storeId: string): Promise<ReorderEvaluationResult[]> {
    const products = await this.prisma.product.findMany({
      where: { storeId, isActive: true },
      include: { inventoryBalance: true },
    });

    const results: ReorderEvaluationResult[] = [];
    for (const p of products) {
      const onHand = Number(p.inventoryBalance?.quantityOnHand ?? 0);
      const minStock = Number(p.reorderLevel ?? 0);
      if (onHand <= minStock) {
        const res = await this.evaluateProductReorder(storeId, p.id, {
          triggerSource: 'SCHEDULED_RECONCILIATION',
          autoExecute: true,
        });
        results.push(res);
      }
    }
    return results;
  }
}
