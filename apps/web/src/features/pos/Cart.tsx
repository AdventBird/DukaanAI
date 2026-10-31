import React from 'react';
import { Trash2, Plus, Minus, ShoppingCart, Tag, ArrowRight } from 'lucide-react';
import type { CartItem } from '@dukaanai/shared';

interface CartProps {
  items: CartItem[];
  subtotal: string;
  totalSavings: string;
  itemCount: number;
  totalUnits: string;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: string) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}

export function Cart({
  items,
  subtotal,
  totalSavings,
  itemCount,
  totalUnits,
  onIncrement,
  onDecrement,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}: CartProps) {
  if (items.length === 0) {
    return (
      <div className="cart-empty-state">
        <div className="empty-cart-icon">
          <ShoppingCart size={36} />
        </div>
        <h3>Cart is empty</h3>
        <p>Scan product barcodes using the camera or search above to build the bill.</p>
      </div>
    );
  }

  return (
    <div className="pos-cart-panel">
      <div className="cart-header">
        <div className="cart-header-title">
          <h3>Current Bill</h3>
          <span className="cart-badge">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} ({totalUnits} units)
          </span>
        </div>
        <button type="button" className="clear-cart-btn" onClick={onClearCart} title="Clear entire cart">
          Clear
        </button>
      </div>

      {/* Cart Items List */}
      <div className="cart-items-scroll">
        {items.map((item) => {
          const isWeight = ['KG', 'LITRE', 'GRAM', 'MILLILITRE'].includes(item.stockUnit);

          return (
            <div key={item.productId} className="cart-item-row">
              <div className="cart-item-left">
                <div className="item-title">
                  <b>{item.name}</b>
                  {item.brand && <small className="item-brand">{item.brand}</small>}
                </div>
                <div className="item-price-unit">
                  <span>₹{item.sellingPrice} / {item.stockUnit}</span>
                  {item.barcode && <span className="item-barcode-small">#{item.barcode}</span>}
                </div>
              </div>

              {/* Quantity Stepper & Direct Edit */}
              <div className="cart-item-controls">
                <div className="qty-stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => onDecrement(item.productId)}
                    title="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    step={isWeight ? '0.1' : '1'}
                    min={isWeight ? '0.05' : '1'}
                    className="stepper-input"
                    value={item.quantity}
                    onChange={(e) => onUpdateQuantity(item.productId, e.target.value)}
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => onIncrement(item.productId)}
                    title="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="cart-item-total">
                  <strong>₹{item.lineTotal}</strong>
                </div>

                <button
                  type="button"
                  className="remove-line-btn"
                  onClick={() => onRemoveItem(item.productId)}
                  title="Remove from bill"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Summary & Checkout Footer */}
      <div className="cart-footer">
        {parseFloat(totalSavings) > 0 && (
          <div className="cart-savings-banner">
            <Tag size={14} />
            <span>Customer saves ₹{totalSavings} below MRP!</span>
          </div>
        )}

        <div className="cart-summary-breakdown">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          <div className="summary-row grand-total">
            <span>Total Payable</span>
            <span className="total-amount">₹{subtotal}</span>
          </div>
        </div>

        <button
          type="button"
          className="checkout-proceed-btn"
          onClick={onProceedToCheckout}
        >
          <span>Pay ₹{subtotal}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
