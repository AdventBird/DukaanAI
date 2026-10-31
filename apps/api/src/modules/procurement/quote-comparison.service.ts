import type {
  QuoteComparisonLine,
  QuoteComparisonSummary,
} from '@dukaanai/shared';

export interface RawQuoteForComparison {
  quoteId: string;
  quoteReference?: string | null;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  quotedQuantityInPurchasePacks: string;
  purchaseUnitLabel: string;
  unitsPerPack: string; // Decimal string
  unitPricePerPurchasePack: string; // Decimal string
  lineDiscount: string; // Decimal string
  freeStockUnits: string; // Decimal string
  deliveryCharge: string; // Decimal string
  otherCharges: string; // Decimal string
  validUntil?: string | null;
  leadTimeDays?: number | null;
  isAvailable: boolean;
  moqInPacks: string;
}

export class QuoteComparisonService {
  /**
   * Performs deterministic, mathematically sound normalisation of supplier quotes.
   * Compares offers based on effective cost per product stock unit:
   * effectiveCostPerStockUnit = (grossPackCost - lineDiscount + allocatedCharges) / (quotedPacks * unitsPerPack + freeStockUnits)
   */
  static compare(quotes: RawQuoteForComparison[]): QuoteComparisonSummary {
    const lines: QuoteComparisonLine[] = [];
    const now = new Date();

    for (const q of quotes) {
      const quotedPacks = parseFloat(q.quotedQuantityInPurchasePacks) || 0;
      const unitsPerPack = parseFloat(q.unitsPerPack) || 1;
      const pricePerPack = parseFloat(q.unitPricePerPurchasePack) || 0;
      const discount = parseFloat(q.lineDiscount) || 0;
      const freeUnits = parseFloat(q.freeStockUnits) || 0;
      const delivery = parseFloat(q.deliveryCharge) || 0;
      const other = parseFloat(q.otherCharges) || 0;
      const moq = parseFloat(q.moqInPacks) || 1;

      const totalStockUnits = quotedPacks * unitsPerPack + freeUnits;
      const grossCost = quotedPacks * pricePerPack;
      const netLineCost = Math.max(0, grossCost - discount);
      const allocatedCharges = delivery + other;
      const totalCostWithCharges = netLineCost + allocatedCharges;

      const effectiveCostPerUnit = totalStockUnits > 0
        ? totalCostWithCharges / totalStockUnits
        : 0;

      const isExpired = q.validUntil ? new Date(q.validUntil) < now : false;
      const isMoqMet = quotedPacks >= moq;

      const assumptions: string[] = [];
      let isIncomplete = false;

      if (delivery === 0) {
        assumptions.push('Delivery charges not specified by supplier (assumed ₹0.00 / free delivery).');
      }
      if (other === 0) {
        assumptions.push('Taxes / loading cess not itemised separately.');
      }
      if (!q.validUntil) {
        assumptions.push('No quote validity date specified; check with distributor prior to placing order.');
        isIncomplete = true;
      }
      if (!q.leadTimeDays) {
        assumptions.push('Delivery lead time not committed in quote.');
      }

      lines.push({
        quoteId: q.quoteId,
        quoteReference: q.quoteReference,
        supplierId: q.supplierId,
        supplierName: q.supplierName,
        productId: q.productId,
        productName: q.productName,
        quotedQuantityInPurchasePacks: quotedPacks.toFixed(3),
        purchaseUnitLabel: q.purchaseUnitLabel,
        unitsPerPack: unitsPerPack.toFixed(3),
        quotedPricePerPack: pricePerPack.toFixed(2),
        totalStockUnits: totalStockUnits.toFixed(3),
        totalLineCost: totalCostWithCharges.toFixed(2),
        allocatedCharges: allocatedCharges.toFixed(2),
        effectiveCostPerStockUnit: effectiveCostPerUnit.toFixed(2),
        moqInPacks: moq.toFixed(3),
        isMoqMet,
        leadTimeDays: q.leadTimeDays ?? null,
        isAvailable: q.isAvailable,
        isExpired,
        isIncomplete,
        assumptions,
      });
    }

    // Determine deterministic recommendation
    // Eligible candidates must be available, not expired, and meet MOQ
    const eligible = lines.filter(l => l.isAvailable && !l.isExpired && l.isMoqMet);

    let recommendedQuoteId: string | null = null;
    let recommendationReason = 'No eligible quotes available for recommendation.';

    if (eligible.length > 0) {
      // Sort primarily by effectiveCostPerStockUnit ascending, secondarily by leadTimeDays ascending
      eligible.sort((a, b) => {
        const costDiff = parseFloat(a.effectiveCostPerStockUnit) - parseFloat(b.effectiveCostPerStockUnit);
        if (Math.abs(costDiff) > 0.001) return costDiff;
        const leadA = a.leadTimeDays ?? 999;
        const leadB = b.leadTimeDays ?? 999;
        return leadA - leadB;
      });

      const best = eligible[0];
      recommendedQuoteId = best.quoteId;
      recommendationReason = `Best offer: ${best.supplierName} at ₹${best.effectiveCostPerStockUnit}/unit ` +
        `(${best.purchaseUnitLabel} of ${parseFloat(best.unitsPerPack)} units @ ₹${best.quotedPricePerPack}/pack` +
        `${best.leadTimeDays ? `, ~${best.leadTimeDays}d delivery` : ''}). Meets MOQ of ${parseFloat(best.moqInPacks)} packs.`;
    } else if (lines.length > 0) {
      const reasons: string[] = [];
      if (lines.some(l => !l.isAvailable)) reasons.push('stock shortage reported');
      if (lines.some(l => l.isExpired)) reasons.push('quote expired');
      if (lines.some(l => !l.isMoqMet)) reasons.push('requested quantity below supplier MOQ');
      recommendationReason = `Cannot recommend: ${reasons.join(', ')}. Manual owner override required.`;
    }

    return {
      lines,
      recommendedQuoteId,
      recommendationReason,
    };
  }
}
