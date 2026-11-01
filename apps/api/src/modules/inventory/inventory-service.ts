export interface ReceiveVerifiedGoodsInput {
  storeId: string;
  productId: string;
  receivedQuantityInStockUnits: string; // Decimal string
  goodsReceiptId: string;
  idempotencyKey: string;
}

export interface StockChangeResult {
  success: boolean;
  productId: string;
  newBalance: string;
  movementId: string;
  isDuplicate: boolean;
}

export interface InventoryDomainService {
  receiveVerifiedGoods(
    tx: unknown,
    input: ReceiveVerifiedGoodsInput
  ): Promise<StockChangeResult>;
  getStockBalance(storeId: string, productId: string): Promise<string>;
}

export function createPrismaInventoryDomainService(
  prisma: import('@prisma/client').PrismaClient,
  inventory: import('./inventory.service.js').InventoryService,
): InventoryDomainService {
  return {
    async receiveVerifiedGoods(_ignored, input) {
      return prisma.$transaction(async (tx) => {
        const duplicate = await tx.stockMovement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        const result = await inventory.receiveVerifiedGoods(tx, input);
        const balance = await tx.inventoryBalance.findUnique({
          where: { storeId_productId: { storeId: input.storeId, productId: input.productId } },
        });
        if (!balance) throw new Error('Inventory balance was not created for the received product.');
        return {
          success: true,
          productId: input.productId,
          newBalance: balance.quantityOnHand.toString(),
          movementId: result.movementId,
          isDuplicate: Boolean(duplicate),
        };
      });
    },
    async getStockBalance(storeId, productId) {
      const balance = await prisma.inventoryBalance.findUnique({ where: { storeId_productId: { storeId, productId } } });
      return balance?.quantityOnHand.toString() ?? '0.000';
    },
  };
}

/**
 * Dev 1 Domain Service Adapter & In-Memory Test Double.
 * Ensures strict atomicity, prevents duplicate stock movements,
 * and maintains an auditable stock ledger without procurement touching InventoryBalance directly.
 */
class InMemoryInventoryService implements InventoryDomainService {
  private balances = new Map<string, number>(); // key: `${storeId}:${productId}`
  private executedReceipts = new Map<string, StockChangeResult>(); // key: idempotencyKey
  private stockMovements: Array<{
    movementId: string;
    storeId: string;
    productId: string;
    quantity: number;
    reference: string;
    timestamp: string;
  }> = [];

  constructor() {
    // Seed initial stock balances for demo store
    this.balances.set('demo-store:prod_101', 5); // Parle-G Biscuit 250g (Low stock!)
    this.balances.set('demo-store:prod_102', 12); // Fortune Sunlite Sunflower Oil 1L
    this.balances.set('demo-store:prod_103', 4);  // Tata Salt 1kg
    this.balances.set('demo-store:prod_104', 20); // Aashirvaad Shudh Chakki Atta 5kg
  }

  async receiveVerifiedGoods(
    _tx: unknown,
    input: ReceiveVerifiedGoodsInput
  ): Promise<StockChangeResult> {
    const { storeId, productId, receivedQuantityInStockUnits, goodsReceiptId, idempotencyKey } = input;

    // Idempotency check: if already processed for this idempotency key, return original result
    const existing = this.executedReceipts.get(idempotencyKey);
    if (existing) {
      return { ...existing, isDuplicate: true };
    }

    const qty = parseFloat(receivedQuantityInStockUnits);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid stock quantity to receive: ${receivedQuantityInStockUnits}`);
    }

    const balanceKey = `${storeId}:${productId}`;
    const current = this.balances.get(balanceKey) ?? 0;
    const updated = current + qty;
    this.balances.set(balanceKey, updated);

    const movementId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.stockMovements.push({
      movementId,
      storeId,
      productId,
      quantity: qty,
      reference: goodsReceiptId,
      timestamp: new Date().toISOString(),
    });

    const result: StockChangeResult = {
      success: true,
      productId,
      newBalance: updated.toFixed(3),
      movementId,
      isDuplicate: false,
    };

    this.executedReceipts.set(idempotencyKey, result);
    return result;
  }

  async getStockBalance(storeId: string, productId: string): Promise<string> {
    return (this.balances.get(`${storeId}:${productId}`) ?? 0).toFixed(3);
  }

  getStockMovements() {
    return [...this.stockMovements];
  }
}

export const inventoryDomainService = new InMemoryInventoryService();
