import {
  type CreateQuoteRequestInput,
  type RecordSupplierQuoteInput,
  type CreatePurchaseOrderDraftInput,
  type ApprovePurchaseOrderInput,
  type RejectPurchaseOrderInput,
  type SubmitPurchaseOrderInput,
  type CancelPurchaseOrderInput,
  type CreateGoodsReceiptDraftInput,
  type ConfirmGoodsReceiptInput,
  type AttachInvoiceInput,
  type ReconciliationReport,
  type ProcurementAnalyticsSummary,
  allowedPoTransitions,
  PurchaseOrderStatus,
} from '@dukaanai/shared';
import {
  procurementRepository,
  ProcurementRepository,
  StoredPurchaseOrder,
  StoredGoodsReceipt,
} from './procurement.repository.js';
import { supplierRepository, SupplierRepository } from '../suppliers/supplier.repository.js';
import { QuoteComparisonService, RawQuoteForComparison } from './quote-comparison.service.js';
import { inventoryDomainService, InventoryDomainService } from '../inventory/inventory-service.js';

export class ProcurementService {
  constructor(
    private procRepo: ProcurementRepository = procurementRepository,
    private supRepo: SupplierRepository = supplierRepository,
    private invService: InventoryDomainService = inventoryDomainService
  ) {}

  // --- Quote Requests ---
  async createQuoteRequest(storeId: string, requestedById: string, input: CreateQuoteRequestInput) {
    return this.procRepo.createQuoteRequest(storeId, requestedById, {
      supplierIds: input.supplierIds,
      notes: input.notes,
      items: input.items.map(it => ({
        productId: it.productId,
        productName: it.productName,
        requestedQuantityInPurchasePacks: it.requestedQuantityInPurchasePacks,
        requestedPurchaseUnitLabel: it.requestedPurchaseUnitLabel,
        unitsPerPackSnapshot: it.unitsPerPackSnapshot,
        notes: it.notes,
      })),
    });
  }

  async listQuoteRequests(storeId: string) {
    return this.procRepo.findQuoteRequests(storeId);
  }

  async getQuoteRequest(storeId: string, id: string) {
    return this.procRepo.findQuoteRequestById(storeId, id);
  }

  // --- Supplier Quotes ---
  async recordSupplierQuote(storeId: string, input: RecordSupplierQuoteInput) {
    const supplier = await this.supRepo.findSupplierById(storeId, input.supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${input.supplierId} not found`);
    }

    return this.procRepo.recordSupplierQuote(storeId, supplier.name, {
      supplierId: input.supplierId,
      quoteRequestId: input.quoteRequestId ?? null,
      quoteReference: input.quoteReference ?? null,
      source: input.source,
      sourceReference: input.sourceReference ?? null,
      deliveryCharge: input.deliveryCharge,
      otherCharges: input.otherCharges,
      discountAmount: input.discountAmount,
      quotedAt: new Date().toISOString(),
      validUntil: input.validUntil ?? null,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      leadTimeDays: input.leadTimeDays ?? supplier.defaultLeadTimeDays ?? null,
      notes: input.notes ?? null,
      items: input.items.map(it => ({
        productId: it.productId,
        quotedProductNameSnapshot: it.quotedProductNameSnapshot,
        supplierSkuSnapshot: it.supplierSkuSnapshot ?? null,
        quotedQuantityInPurchasePacks: it.quotedQuantityInPurchasePacks,
        purchaseUnitLabelSnapshot: it.purchaseUnitLabelSnapshot,
        unitsPerPackSnapshot: it.unitsPerPackSnapshot,
        unitPricePerPurchasePack: it.unitPricePerPurchasePack,
        lineDiscount: it.lineDiscount,
        freeStockUnits: it.freeStockUnits,
        isAvailable: it.isAvailable,
      })),
    });
  }

  async listQuotes(storeId: string, supplierId?: string, productId?: string) {
    return this.procRepo.findQuotes(storeId, supplierId, productId);
  }

  async getQuote(storeId: string, id: string) {
    return this.procRepo.findQuoteById(storeId, id);
  }

  async compareQuotes(storeId: string, quoteIds: string[], targetProductId?: string) {
    const rawQuotes: RawQuoteForComparison[] = [];

    for (const qId of quoteIds) {
      const q = await this.procRepo.findQuoteById(storeId, qId);
      if (!q) continue;

      const supplierProducts = await this.supRepo.findProductsBySupplier(storeId, q.supplierId);

      for (const it of q.items) {
        if (targetProductId && it.productId !== targetProductId) continue;

        const sp = supplierProducts.find(p => p.productId === it.productId);
        const moqInPacks = sp ? sp.minimumOrderQuantity : '1.000';

        rawQuotes.push({
          quoteId: q.id,
          quoteReference: q.quoteReference,
          supplierId: q.supplierId,
          supplierName: q.supplierName,
          productId: it.productId,
          productName: it.quotedProductNameSnapshot,
          quotedQuantityInPurchasePacks: it.quotedQuantityInPurchasePacks,
          purchaseUnitLabel: it.purchaseUnitLabelSnapshot,
          unitsPerPack: it.unitsPerPackSnapshot,
          unitPricePerPurchasePack: it.unitPricePerPurchasePack,
          lineDiscount: it.lineDiscount,
          freeStockUnits: it.freeStockUnits,
          deliveryCharge: q.deliveryCharge,
          otherCharges: q.otherCharges,
          validUntil: q.validUntil,
          leadTimeDays: q.leadTimeDays,
          isAvailable: it.isAvailable,
          moqInPacks,
        });
      }
    }

    return QuoteComparisonService.compare(rawQuotes);
  }

  // --- Purchase Orders ---
  async createPurchaseOrderDraft(storeId: string, createdById: string, input: CreatePurchaseOrderDraftInput) {
    const supplier = await this.supRepo.findSupplierById(storeId, input.supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${input.supplierId} not found`);
    }

    const supplierProducts = await this.supRepo.findProductsBySupplier(storeId, input.supplierId);

    // If derived from quote, fetch quote
    let quote = input.supplierQuoteId ? await this.procRepo.findQuoteById(storeId, input.supplierQuoteId) : null;

    const itemsData = input.items.map(item => {
      const sp = supplierProducts.find(p => p.productId === item.productId);
      const quoteItem = quote?.items.find(qi => qi.productId === item.productId);

      const productName = quoteItem?.quotedProductNameSnapshot ?? sp?.supplierSku ?? `Product ${item.productId}`;
      const purchaseUnitLabel = quoteItem?.purchaseUnitLabelSnapshot ?? sp?.purchaseUnitLabel ?? 'pack';
      const unitsPerPack = quoteItem?.unitsPerPackSnapshot ?? sp?.unitsPerPurchasePack ?? '1.000';
      const unitPrice = item.unitPricePerPurchasePack ?? quoteItem?.unitPricePerPurchasePack ?? sp?.lastQuotedPrice ?? '100.00';

      return {
        productId: item.productId,
        productName,
        supplierSku: quoteItem?.supplierSkuSnapshot ?? sp?.supplierSku ?? null,
        quantityInPurchasePacks: item.quantityInPurchasePacks,
        purchaseUnitLabel,
        unitsPerPack,
        unitPricePerPurchasePack: unitPrice,
        lineDiscount: quoteItem?.lineDiscount ?? '0.00',
      };
    });

    return this.procRepo.createPurchaseOrder(
      storeId,
      createdById,
      supplier.id,
      supplier.name,
      input.supplierQuoteId ?? null,
      input.expectedDeliveryDate ?? null,
      input.paymentTerms ?? supplier.defaultPaymentTerms ?? null,
      input.notes ?? null,
      itemsData
    );
  }

  async listPurchaseOrders(storeId: string, status?: PurchaseOrderStatus, supplierId?: string) {
    return this.procRepo.findPurchaseOrders(storeId, status, supplierId);
  }

  async getPurchaseOrder(storeId: string, id: string) {
    const po = await this.procRepo.findPurchaseOrderById(storeId, id);
    if (!po) return null;
    const goodsReceipts = await this.procRepo.findGoodsReceiptsForPO(storeId, id);
    const invoices = await this.procRepo.findInvoicesForPO(storeId, id);
    return { ...po, goodsReceipts, invoices };
  }

  async submitForApproval(storeId: string, id: string): Promise<StoredPurchaseOrder> {
    const po = await this.procRepo.findPurchaseOrderById(storeId, id);
    if (!po) throw new Error('Purchase order not found');

    if (!['DRAFT', 'REJECTED'].includes(po.status)) {
      throw new Error(`Cannot submit for approval from status ${po.status}`);
    }

    const updated = await this.procRepo.updatePurchaseOrder(storeId, id, {
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
    });
    return updated!;
  }

  async approvePurchaseOrder(
    storeId: string,
    id: string,
    approvingUserId: string,
    role: string,
    input: ApprovePurchaseOrderInput
  ): Promise<StoredPurchaseOrder> {
    if (role !== 'OWNER') {
      throw new Error('Only a verified store OWNER can approve financial commitments.');
    }

    const po = await this.procRepo.findPurchaseOrderById(storeId, id);
    if (!po) throw new Error('Purchase order not found');

    if (po.status !== 'PENDING_APPROVAL') {
      throw new Error(`Order must be in PENDING_APPROVAL status to be approved (current: ${po.status})`);
    }

    if (po.revision !== input.expectedRevision) {
      throw new Error(`Revision mismatch: expected revision ${input.expectedRevision}, but order is at revision ${po.revision}. Approval cancelled.`);
    }

    const updated = await this.procRepo.updatePurchaseOrder(storeId, id, {
      status: 'APPROVED',
      approvedById: approvingUserId,
      approvedAt: new Date().toISOString(),
      approvalNote: input.decisionNote,
      rejectionReason: null,
    });
    return updated!;
  }

  async rejectPurchaseOrder(
    storeId: string,
    id: string,
    rejectingUserId: string,
    role: string,
    input: RejectPurchaseOrderInput
  ): Promise<StoredPurchaseOrder> {
    if (role !== 'OWNER') {
      throw new Error('Only a verified store OWNER can reject purchase orders.');
    }

    const po = await this.procRepo.findPurchaseOrderById(storeId, id);
    if (!po) throw new Error('Purchase order not found');

    if (po.status !== 'PENDING_APPROVAL') {
      throw new Error(`Only pending orders can be rejected (current: ${po.status})`);
    }

    if (po.revision !== input.expectedRevision) {
      throw new Error(`Revision mismatch: expected revision ${input.expectedRevision}, current ${po.revision}`);
    }

    const updated = await this.procRepo.updatePurchaseOrder(storeId, id, {
      status: 'REJECTED',
      rejectionReason: input.reason,
      approvedById: null,
      approvedAt: null,
    });
    return updated!;
  }

  async submitPurchaseOrder(storeId: string, id: string, input: SubmitPurchaseOrderInput): Promise<StoredPurchaseOrder> {
    const po = await this.procRepo.findPurchaseOrderById(storeId, id);
    if (!po) throw new Error('Purchase order not found');

    // Idempotency: repeated submission with same idempotencyKey returns existing order
    if (po.idempotencyKey && po.idempotencyKey === input.idempotencyKey && po.status !== 'APPROVED') {
      return po;
    }

    if (po.status !== 'APPROVED') {
      throw new Error(`Order cannot be submitted without OWNER approval (current status: ${po.status})`);
    }

    if (po.revision !== input.expectedRevision) {
      throw new Error(`Revision mismatch: expected revision ${input.expectedRevision}, current ${po.revision}`);
    }

    // Stable mock supplier reference
    const supplierRef = `DIST-ORD-${Date.now().toString().slice(-6)}-${po.orderNumber.replace(/[^0-9]/g, '')}`;

    const updated = await this.procRepo.updatePurchaseOrder(storeId, id, {
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      supplierReference: supplierRef,
      idempotencyKey: input.idempotencyKey,
    });
    return updated!;
  }

  async cancelPurchaseOrder(
    storeId: string,
    id: string,
    _cancellingUserId: string,
    input: CancelPurchaseOrderInput
  ): Promise<StoredPurchaseOrder> {
    const po = await this.procRepo.findPurchaseOrderById(storeId, id);
    if (!po) throw new Error('Purchase order not found');

    if (['RECEIVED', 'CANCELLED'].includes(po.status)) {
      throw new Error(`Cannot cancel an order in terminal status: ${po.status}`);
    }

    const updated = await this.procRepo.updatePurchaseOrder(storeId, id, {
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      cancellationReason: input.reason,
    });
    return updated!;
  }

  // --- Goods Receipt & Inventory Integration ---
  async createGoodsReceiptDraft(storeId: string, purchaseOrderId: string, input: CreateGoodsReceiptDraftInput) {
    const po = await this.procRepo.findPurchaseOrderById(storeId, purchaseOrderId);
    if (!po) throw new Error('Purchase order not found');

    if (!['SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new Error(`Cannot receive goods for order in status ${po.status}. Must be SUBMITTED or ACKNOWLEDGED.`);
    }

    const draft = await this.procRepo.createGoodsReceiptDraft(storeId, purchaseOrderId, input.deliveryNoteReference, input.notes);

    // Populate items
    const items = input.items.map((it, idx) => {
      const poItem = po.items.find(pi => pi.id === it.purchaseOrderItemId);
      const unitsPerPack = poItem?.unitsPerPackSnapshot ?? '1.000';
      const unitLabel = poItem?.purchaseUnitLabelSnapshot ?? 'pack';

      return {
        id: `gri_${Date.now()}_${idx}`,
        goodsReceiptId: draft.id,
        purchaseOrderItemId: it.purchaseOrderItemId,
        productId: it.productId,
        deliveredQuantityInPurchasePacks: it.deliveredQuantityInPurchasePacks,
        acceptedQuantityInStockUnits: it.acceptedQuantityInStockUnits,
        damagedQuantityInStockUnits: it.damagedQuantityInStockUnits,
        rejectedQuantityInStockUnits: it.rejectedQuantityInStockUnits,
        shortQuantityInStockUnits: it.shortQuantityInStockUnits,
        excessQuantityInStockUnits: it.excessQuantityInStockUnits,
        purchaseUnitLabelSnapshot: unitLabel,
        unitsPerPackSnapshot: unitsPerPack,
        discrepancyReason: it.discrepancyReason ?? null,
        condition: it.condition ?? null,
        notes: it.notes ?? null,
      };
    });

    const updated = await this.procRepo.updateGoodsReceipt(storeId, draft.id, { items });
    return updated!;
  }

  async confirmGoodsReceipt(
    storeId: string,
    receiptId: string,
    confirmingUserId: string,
    role: string,
    input: ConfirmGoodsReceiptInput
  ): Promise<{ goodsReceipt: StoredGoodsReceipt; purchaseOrder: StoredPurchaseOrder; stockUpdates: unknown[] }> {
    if (role !== 'OWNER') {
      throw new Error('Only a verified store OWNER can confirm goods receipt and authorize inventory updates.');
    }

    const receipt = await this.procRepo.findGoodsReceiptById(storeId, receiptId);
    if (!receipt) throw new Error('Goods receipt not found');

    // Idempotency check: if receipt already confirmed with this key, return original without double stock increment
    if (receipt.status === 'CONFIRMED' && receipt.idempotencyKey === input.idempotencyKey) {
      const po = (await this.procRepo.findPurchaseOrderById(storeId, receipt.purchaseOrderId))!;
      return { goodsReceipt: receipt, purchaseOrder: po, stockUpdates: [] };
    }

    if (receipt.status !== 'DRAFT' && receipt.status !== 'PENDING_VERIFICATION') {
      throw new Error(`Receipt cannot be confirmed from status ${receipt.status}`);
    }

    const po = await this.procRepo.findPurchaseOrderById(storeId, receipt.purchaseOrderId);
    if (!po) throw new Error('Linked purchase order not found');

    const stockUpdates: unknown[] = [];

    // Atomically execute stock updates for physically accepted stock units only
    for (const item of receipt.items) {
      const acceptedQty = parseFloat(item.acceptedQuantityInStockUnits);
      if (acceptedQty > 0) {
        const stockResult = await this.invService.receiveVerifiedGoods(null, {
          storeId,
          productId: item.productId,
          receivedQuantityInStockUnits: item.acceptedQuantityInStockUnits,
          goodsReceiptId: receipt.id,
          idempotencyKey: `${input.idempotencyKey}:${item.id}`,
        });
        stockUpdates.push(stockResult);

        // Update purchase order item received quantity
        const poi = po.items.find(p => p.id === item.purchaseOrderItemId);
        if (poi) {
          const currentRec = parseFloat(poi.receivedQuantityInStockUnits) || 0;
          poi.receivedQuantityInStockUnits = (currentRec + acceptedQty).toFixed(3);
        }
      }
    }

    // Determine updated purchase order status
    let allFulfilled = true;
    for (const poi of po.items) {
      const ordered = parseFloat(poi.orderedQuantityInStockUnits);
      const received = parseFloat(poi.receivedQuantityInStockUnits);
      if (received < ordered) {
        allFulfilled = false;
        break;
      }
    }

    const nextPoStatus: PurchaseOrderStatus = allFulfilled ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    const updatedPo = await this.procRepo.updatePurchaseOrder(storeId, po.id, {
      status: nextPoStatus,
      items: po.items,
      receivedAt: allFulfilled ? new Date().toISOString() : po.receivedAt,
    });

    const confirmedReceipt = await this.procRepo.updateGoodsReceipt(storeId, receipt.id, {
      status: 'CONFIRMED',
      verifiedAt: new Date().toISOString(),
      verifiedById: confirmingUserId,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      goodsReceipt: confirmedReceipt!,
      purchaseOrder: updatedPo!,
      stockUpdates,
    };
  }

  // --- Invoices & Reconciliation ---
  async attachInvoice(storeId: string, purchaseOrderId: string, input: AttachInvoiceInput) {
    const po = await this.procRepo.findPurchaseOrderById(storeId, purchaseOrderId);
    if (!po) throw new Error('Purchase order not found');

    return this.procRepo.attachInvoice(storeId, purchaseOrderId, input);
  }

  async getReconciliationReport(storeId: string, purchaseOrderId: string): Promise<ReconciliationReport> {
    const po = await this.procRepo.findPurchaseOrderById(storeId, purchaseOrderId);
    if (!po) throw new Error('Purchase order not found');

    const receipts = await this.procRepo.findGoodsReceiptsForPO(storeId, purchaseOrderId);
    const invoices = await this.procRepo.findInvoicesForPO(storeId, purchaseOrderId);
    const invoice = invoices[0] ?? null;

    const items: ReconciliationReport['items'] = [];
    const warnings: string[] = [];

    for (const poi of po.items) {
      // Find all confirmed receipt lines for this PO item
      const confirmedLines = receipts
        .filter(r => r.status === 'CONFIRMED')
        .flatMap(r => r.items)
        .filter(it => it.purchaseOrderItemId === poi.id);

      const acceptedTotal = confirmedLines.reduce((acc, l) => acc + (parseFloat(l.acceptedQuantityInStockUnits) || 0), 0);
      const damagedTotal = confirmedLines.reduce((acc, l) => acc + (parseFloat(l.damagedQuantityInStockUnits) || 0), 0);
      const receivedTotal = acceptedTotal + damagedTotal;

      const invoicedItem = invoice?.lineItems?.find(li => li.productId === poi.productId);

      const priceMismatch = invoicedItem
        ? parseFloat(invoicedItem.invoicedPricePerPack) !== parseFloat(poi.unitPricePerPurchasePack)
        : false;

      const orderedStockUnits = parseFloat(poi.orderedQuantityInStockUnits);
      const quantityMismatch = acceptedTotal < orderedStockUnits;

      if (priceMismatch) {
        warnings.push(`Price mismatch on ${poi.productNameSnapshot}: Invoiced ₹${invoicedItem?.invoicedPricePerPack}/pack vs PO ₹${poi.unitPricePerPurchasePack}/pack.`);
      }
      if (quantityMismatch) {
        warnings.push(`Short delivery on ${poi.productNameSnapshot}: ${acceptedTotal.toFixed(3)} accepted vs ${orderedStockUnits.toFixed(3)} ordered.`);
      }
      if (damagedTotal > 0) {
        warnings.push(`Damage recorded on ${poi.productNameSnapshot}: ${damagedTotal.toFixed(3)} stock units damaged.`);
      }

      items.push({
        productId: poi.productId,
        productName: poi.productNameSnapshot,
        orderedPacks: poi.orderedQuantityInPurchasePacks,
        orderedStockUnits: poi.orderedQuantityInStockUnits,
        orderedPricePerPack: poi.unitPricePerPurchasePack,
        receivedStockUnits: receivedTotal.toFixed(3),
        acceptedStockUnits: acceptedTotal.toFixed(3),
        damagedStockUnits: damagedTotal.toFixed(3),
        invoicedPacks: invoicedItem?.invoicedPacks ?? null,
        invoicedPricePerPack: invoicedItem?.invoicedPricePerPack ?? null,
        priceMismatch,
        quantityMismatch,
        discrepancyNotes: confirmedLines.map(l => l.discrepancyReason).filter(Boolean).join('; ') || null,
      });
    }

    const isFullyReconciled = warnings.length === 0 && Boolean(invoice);

    return {
      purchaseOrderId: po.id,
      orderNumber: po.orderNumber,
      supplierName: po.supplierName,
      orderStatus: po.status,
      hasInvoice: Boolean(invoice),
      invoiceNumber: invoice?.invoiceNumber ?? null,
      items,
      isFullyReconciled,
      warnings,
    };
  }

  // --- Analytics ---
  async getAnalyticsSummary(storeId: string): Promise<ProcurementAnalyticsSummary> {
    const all = await this.procRepo.findPurchaseOrders(storeId);
    const now = new Date();

    const openPurchaseOrders = all.filter(po =>
      ['APPROVED', 'SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(po.status)
    ).length;

    const pendingApprovals = all.filter(po => po.status === 'PENDING_APPROVAL').length;

    const overdueDeliveries = all.filter(po => {
      if (!['SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(po.status)) return false;
      if (!po.expectedDeliveryDate) return false;
      return new Date(po.expectedDeliveryDate) < now;
    }).length;

    const receipts = Array.from((await this.procRepo.findPurchaseOrders(storeId))).flatMap(po => po.items);
    const recentDeliveriesCount = receipts.filter(it => parseFloat(it.receivedQuantityInStockUnits) > 0).length;

    const totalSpent = all
      .filter(po => ['RECEIVED', 'PARTIALLY_RECEIVED'].includes(po.status))
      .reduce((sum, po) => sum + parseFloat(po.estimatedTotal), 0);

    return {
      dataAvailable: true,
      openPurchaseOrders,
      overdueDeliveries,
      pendingApprovals,
      recentDeliveriesCount,
      totalProcurementSpentMonth: totalSpent.toFixed(2),
    };
  }
}

export const procurementService = new ProcurementService();
