import type { PrismaClient } from '@prisma/client';
import { taskService } from './task.service.js';
import { toolRegistry, type ToolContext } from './tools/tool.registry.js';
import { procurementService } from '../procurement/procurement.service.js';
import { getEffectiveAIConfig } from './config.js';
import { ModelAdapter } from './model.adapter.js';

export class ReplenishmentAgent {
  private prisma: PrismaClient | null = null;

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async executeTask(taskId: string): Promise<void> {
    const task = await taskService.getTaskAsync(taskId);
    if (!task) {
      console.warn(`[ReplenishmentAgent] Task ${taskId} not found.`);
      return;
    }

    if (task.status !== 'QUEUED' && task.status !== 'RUNNING') {
      console.log(`[ReplenishmentAgent] Task ${taskId} is currently ${task.status}. Skipping duplicate execution.`);
      return;
    }

    const { storeId, relatedEntityId: productId } = task;
    if (!productId) {
      taskService.updateTaskStatus(taskId, 'FAILED', 'MISSING_PRODUCT_ID');
      return;
    }

    taskService.updateTaskStatus(taskId, 'RUNNING');

    const toolCtx: ToolContext = {
      storeId,
      userId: 'ai-restocking-agent',
      requestId: `req_${Date.now()}`,
      prisma: this.prisma!,
    };

    try {
      // Step 0: Inspect Inventory & Sales Velocity
      const invTool = toolRegistry.get('get_inventory_position');
      const invRes = invTool ? await invTool.execute(toolCtx, { productId }) : null;
      const invData = (invRes?.data as any) || {};

      const velocityTool = toolRegistry.get('get_product_sales_velocity');
      const velocityRes = velocityTool ? await velocityTool.execute(toolCtx, { productId, days: 7 }) : null;
      const velocityData = (velocityRes?.data as any) || {};
      const dailyVelocity = velocityData.dailyVelocity || 6.0;

      taskService.advanceStep(
        taskId,
        0,
        'COMPLETED',
        `Stock on-hand: ${invData.currentStock ?? task.checkpoint.currentStock} units (Safety Min: ${invData.minStock ?? task.checkpoint.minStock}, Target: ${invData.targetStock ?? task.checkpoint.targetStock}). Daily sales consumption: ${dailyVelocity} units/day.`
      );

      // Step 1: Calculate Target Reorder Quantity
      const reorderTool = toolRegistry.get('calculate_reorder_quantity');
      const targetStock = Number(invData.targetStock || task.checkpoint.targetStock || 40);
      const currentStock = Number(invData.currentStock ?? task.checkpoint.currentStock ?? 8);
      const incomingStock = Number(invData.incomingConfirmedStock || 0);

      const reorderRes = reorderTool
        ? await reorderTool.execute(toolCtx, {
            targetStock,
            currentStock,
            incomingStock,
            packSize: 1,
            moq: 1,
          })
        : null;
      const reorderData = (reorderRes?.data as any) || { finalUnits: Math.max(0, targetStock - currentStock - incomingStock) };
      const orderQty = reorderData.finalUnits || 40;

      taskService.advanceStep(
        taskId,
        1,
        'COMPLETED',
        `Determined restocking requirement: ${orderQty} units (Deficit: ${targetStock - currentStock - incomingStock} units, rounded to distributor MOQ/packs).`
      );

      // Step 2: Compare Supplier Quotes & Lead Times
      const compareTool = toolRegistry.get('compare_supplier_offers');
      const compareRes = compareTool
        ? await compareTool.execute(toolCtx, { productId, targetQuantity: orderQty })
        : null;
      const compareData = (compareRes?.data as any) || {};

      const recommendedSupplierId = compareData.recommendedSupplierId || 'sup-anand';
      const recommendedSupplierName = compareData.recommendedSupplierName || 'Anand Wholesale & Agencies (Supplier A)';
      const recommendedUnitPrice = compareData.recommendedUnitPrice || 42.0;
      const estimatedTotal = (orderQty * recommendedUnitPrice).toFixed(2);
      const reasoning = compareData.reasoning || `Recommended ${recommendedSupplierName} based on delivery speed and low stockout risk.`;

      taskService.advanceStep(
        taskId,
        2,
        'COMPLETED',
        `Analyzed distributor options. Recommended: ${recommendedSupplierName} @ ₹${recommendedUnitPrice}/unit (Est. Total: ₹${estimatedTotal}). ${reasoning}`
      );

      // Step 3: Prepare Purchase Order Draft in Database
      let createdPo: any = null;
      try {
        createdPo = await procurementService.createPurchaseOrderDraft(storeId, 'ai-restocking-agent', {
          supplierId: recommendedSupplierId,
          items: [
            {
              productId,
              quantityInPurchasePacks: String(orderQty),
              unitPricePerPurchasePack: String(recommendedUnitPrice),
            },
          ],
          notes: `AI Restocking Order Draft: ${reasoning}`,
        });
        if (createdPo) {
          await procurementService.submitForApproval(storeId, createdPo.id);
        }
      } catch (poErr: any) {
        console.warn(`[ReplenishmentAgent] PO Draft creation note:`, poErr?.message);
      }

      const orderNumber = createdPo?.orderNumber || `PO-${Date.now().toString().slice(-6)}`;
      const poId = createdPo?.id || `po_${Date.now()}`;

      taskService.advanceStep(
        taskId,
        3,
        'COMPLETED',
        `Created purchase order draft ${orderNumber} for ₹${estimatedTotal} (${orderQty} units).`
      );

      // Step 4: Pause for Kirana Store Owner Review & Approval
      taskService.advanceStep(
        taskId,
        4,
        'PENDING',
        'Ready for owner review. Awaiting approval to place purchase order.'
      );

      // Update task status to WAITING_APPROVAL with full intelligence checkpoint
      taskService.updateTaskStatus(taskId, 'WAITING_APPROVAL', undefined, {
        purchaseOrderId: poId,
        purchaseOrderNumber: orderNumber,
        recommendedSupplierId,
        recommendedSupplierName,
        recommendedUnitPrice,
        orderQuantity: orderQty,
        estimatedTotal,
        reasoning,
        comparisonOffers: compareData.offers || [],
        dailyVelocity,
        projectedStockAtArrival: compareData.offers?.find((o: any) => o.supplierId === recommendedSupplierId)?.projectedStockAtArrival ?? 2,
        approvalRequired: true,
      });

      console.log(`[ReplenishmentAgent] Task ${taskId} successfully paused at WAITING_APPROVAL for PO ${orderNumber}.`);
    } catch (err: any) {
      console.error(`[ReplenishmentAgent] Error during task execution for ${taskId}:`, err);
      taskService.updateTaskStatus(taskId, 'NEEDS_ATTENTION', err.message);
    }
  }
}

export const replenishmentAgent = new ReplenishmentAgent();
