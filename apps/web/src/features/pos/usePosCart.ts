import { useState, useEffect, useCallback } from 'react';
import type { CartItem, BarcodeLookupResult } from '@dukaanai/shared';

const CART_STORAGE_KEY = 'dukaanai_pos_draft_cart';

export function usePosCart() {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore localStorage parse errors
    }
    return [];
  });

  // Persist draft cart whenever items change
  useEffect(() => {
    try {
      if (items.length > 0) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch {
      // Storage quota or private browsing fallback
    }
  }, [items]);

  const calculateLineTotal = (priceStr: string, qtyStr: string): string => {
    const p = parseFloat(priceStr) || 0;
    const q = parseFloat(qtyStr) || 0;
    return (p * q).toFixed(2);
  };

  const addItem = useCallback((product: BarcodeLookupResult | any, addQty = '1') => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((it) => it.productId === (product.productId || product.id));
      const pId = product.productId || product.id;
      const unit = product.stockUnit || 'PIECE';
      const isWeight = ['KG', 'LITRE', 'GRAM', 'MILLILITRE'].includes(unit);

      if (existingIndex >= 0) {
        // Increment quantity
        const existing = prev[existingIndex]!;
        const currentQty = parseFloat(existing.quantity) || 0;
        const addAmount = parseFloat(addQty) || (isWeight ? 0.5 : 1);
        const newQtyNum = currentQty + addAmount;
        const newQtyStr = isWeight ? newQtyNum.toFixed(3) : Math.round(newQtyNum).toString();

        const updated: CartItem = {
          ...existing,
          quantity: newQtyStr,
          lineTotal: calculateLineTotal(existing.sellingPrice, newQtyStr),
        };

        const copy = [...prev];
        copy[existingIndex] = updated;
        return copy;
      }

      // Add new item to front of cart
      const sellingPrice = (product.sellingPrice || '0.00').toString();
      const initialQty = isWeight && parseFloat(addQty) < 1 ? addQty : isWeight ? '1.000' : '1';
      const newItem: CartItem = {
        productId: pId,
        name: product.name,
        brand: product.brand || null,
        barcode: product.barcode || (product.barcodes?.[0]?.barcode ?? null),
        stockUnit: unit,
        sellingPrice,
        mrp: product.mrp ? product.mrp.toString() : null,
        quantityOnHand: (product.quantityOnHand || '0').toString(),
        quantity: initialQty,
        lineTotal: calculateLineTotal(sellingPrice, initialQty),
      };

      return [newItem, ...prev];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, newQuantityStr: string) => {
    setItems((prev) => {
      const num = parseFloat(newQuantityStr);
      if (isNaN(num) || num <= 0) return prev;

      return prev.map((item) => {
        if (item.productId !== productId) return item;
        const isWeight = ['KG', 'LITRE', 'GRAM', 'MILLILITRE'].includes(item.stockUnit);
        const formattedQty = isWeight ? num.toFixed(3) : Math.round(num).toString();
        return {
          ...item,
          quantity: formattedQty,
          lineTotal: calculateLineTotal(item.sellingPrice, formattedQty),
        };
      });
    });
  }, []);

  const incrementQuantity = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const isWeight = ['KG', 'LITRE', 'GRAM', 'MILLILITRE'].includes(item.stockUnit);
        const step = isWeight ? 0.5 : 1;
        const current = parseFloat(item.quantity) || 0;
        const newQty = isWeight ? (current + step).toFixed(3) : Math.round(current + step).toString();
        return {
          ...item,
          quantity: newQty,
          lineTotal: calculateLineTotal(item.sellingPrice, newQty),
        };
      })
    );
  }, []);

  const decrementQuantity = useCallback((productId: string) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const isWeight = ['KG', 'LITRE', 'GRAM', 'MILLILITRE'].includes(item.stockUnit);
          const step = isWeight ? 0.5 : 1;
          const current = parseFloat(item.quantity) || 0;
          const newNum = current - step;
          if (newNum <= 0) return null; // Remove line if decremented to 0
          const newQty = isWeight ? newNum.toFixed(3) : Math.round(newNum).toString();
          return {
            ...item,
            quantity: newQty,
            lineTotal: calculateLineTotal(item.sellingPrice, newQty),
          };
        })
        .filter((item): item is CartItem => item !== null)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Price calculations
  const subtotal = items
    .reduce((sum, item) => sum + (parseFloat(item.lineTotal) || 0), 0)
    .toFixed(2);

  const totalMrp = items
    .reduce((sum, item) => {
      const mrp = parseFloat(item.mrp || item.sellingPrice) || 0;
      const qty = parseFloat(item.quantity) || 0;
      return sum + mrp * qty;
    }, 0)
    .toFixed(2);

  const totalSavings = Math.max(0, parseFloat(totalMrp) - parseFloat(subtotal)).toFixed(2);

  const itemCount = items.length;

  const totalUnits = items
    .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)
    .toFixed(1);

  return {
    items,
    subtotal,
    totalMrp,
    totalSavings,
    itemCount,
    totalUnits,
    addItem,
    updateQuantity,
    incrementQuantity,
    decrementQuantity,
    removeItem,
    clearCart,
    setItems,
  };
}
