import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Smartphone,
  Banknote,
  User,
  ShoppingBag,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { CartItem, CreateSaleInput, SaleDto, PaymentMethod } from '@dukaanai/shared';

interface CheckoutModalProps {
  items: CartItem[];
  subtotal: string;
  idempotencyKey: string;
  apiBase: string;
  onClose: () => void;
  onSaleComplete: (sale: SaleDto) => void;
}

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: React.ReactNode; hint: string }[] = [
  { method: 'CASH', label: 'Cash', icon: <Banknote size={20} />, hint: 'Enter amount received from customer' },
  { method: 'UPI', label: 'UPI', icon: <Smartphone size={20} />, hint: 'Google Pay, PhonePe, Paytm, etc.' },
  { method: 'CREDIT', label: 'Udhar (Credit)', icon: <CreditCard size={20} />, hint: 'Record a credit sale — requires customer name' },
];

export function CheckoutModal({
  items,
  subtotal,
  idempotencyKey,
  apiBase,
  onClose,
  onSaleComplete,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const total = parseFloat(subtotal);
  const tendered = parseFloat(amountTendered) || 0;
  const change = paymentMethod === 'CASH' ? Math.max(0, tendered - total) : 0;
  const isCashValid = paymentMethod !== 'CASH' || tendered >= total;

  const canProceed =
    items.length > 0 &&
    isCashValid &&
    (paymentMethod !== 'CREDIT' || customerLabel.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed || loading) return;
    setLoading(true);
    setError('');

    const payload: CreateSaleInput = {
      idempotencyKey,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        expectedSellingPrice: item.sellingPrice,
      })),
      payment: {
        method: paymentMethod,
        amountTendered: paymentMethod === 'CASH' ? amountTendered || subtotal : undefined,
        reference: paymentMethod === 'UPI' && upiRef ? upiRef : undefined,
      },
      customerLabel: paymentMethod === 'CREDIT' ? customerLabel.trim() : undefined,
    };

    try {
      const res = await fetch(`${apiBase}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.ok && json.data) {
        onSaleComplete(json.data as SaleDto);
      } else {
        const msg = json.error?.message || 'Checkout failed. Please try again.';
        const code = json.error?.code;

        if (code === 'PRICE_CHANGED') {
          setError(`Price changed: ${msg} — Please remove the item and re-add it.`);
        } else if (code === 'INSUFFICIENT_STOCK') {
          setError(`Stock issue: ${msg}`);
        } else {
          setError(msg);
        }
      }
    } catch {
      setError('Network error. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="checkout-modal">
        {/* Header */}
        <div className="checkout-modal-header">
          <div className="checkout-modal-title">
            <ShoppingBag size={20} />
            <h2>Checkout</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close checkout"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form">
          {/* Order Summary */}
          <div className="checkout-order-summary">
            <h3>Order Summary</h3>
            <div className="checkout-items-list">
              {items.map((item) => (
                <div key={item.productId} className="checkout-item-row">
                  <span className="checkout-item-name">
                    {item.name}
                    {item.brand && <small> · {item.brand}</small>}
                  </span>
                  <span className="checkout-item-qty">
                    {item.quantity} × ₹{item.sellingPrice}
                  </span>
                  <span className="checkout-item-total">₹{item.lineTotal}</span>
                </div>
              ))}
            </div>
            <div className="checkout-total-row">
              <span>Total Payable</span>
              <strong className="checkout-grand-total">₹{subtotal}</strong>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="checkout-section">
            <h3>Payment Method</h3>
            <div className="payment-method-grid">
              {PAYMENT_OPTIONS.map(({ method, label, icon, hint }) => (
                <button
                  key={method}
                  type="button"
                  className={`payment-method-btn ${paymentMethod === method ? 'selected' : ''}`}
                  onClick={() => {
                    setPaymentMethod(method);
                    setError('');
                  }}
                >
                  {icon}
                  <span>{label}</span>
                  {paymentMethod === method && <small>{hint}</small>}
                </button>
              ))}
            </div>
          </div>

          {/* Cash: Amount Tendered */}
          {paymentMethod === 'CASH' && (
            <div className="checkout-section">
              <label className="checkout-field-label">
                Amount Tendered (₹)
                <input
                  type="number"
                  min={total}
                  step="0.50"
                  className={`checkout-input ${!isCashValid && amountTendered ? 'input-error' : ''}`}
                  placeholder={`Min ₹${subtotal}`}
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  autoFocus
                />
              </label>
              {amountTendered && parseFloat(amountTendered) >= total && (
                <div className="change-display">
                  <Banknote size={15} />
                  <span>Return Change: <strong>₹{change.toFixed(2)}</strong></span>
                </div>
              )}
              {amountTendered && !isCashValid && (
                <p className="field-error">Amount tendered must be ≥ ₹{subtotal}</p>
              )}
            </div>
          )}

          {/* UPI: Reference */}
          {paymentMethod === 'UPI' && (
            <div className="checkout-section">
              <label className="checkout-field-label">
                UPI Reference / Transaction ID <span className="optional-tag">Optional</span>
                <input
                  type="text"
                  className="checkout-input"
                  placeholder="e.g. T2312345678"
                  maxLength={100}
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  autoFocus
                />
              </label>
            </div>
          )}

          {/* Credit: Customer Name */}
          {paymentMethod === 'CREDIT' && (
            <div className="checkout-section">
              <label className="checkout-field-label">
                <User size={14} />
                Customer Name (required for Udhar)
                <input
                  type="text"
                  className="checkout-input"
                  placeholder="e.g. Ramesh Kumar"
                  maxLength={120}
                  value={customerLabel}
                  onChange={(e) => setCustomerLabel(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              <p className="credit-notice">
                ⚠ This sale will be recorded as unpaid credit. Customer will owe ₹{subtotal}.
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="checkout-error-banner" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <div className="checkout-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="checkout-confirm-btn"
              disabled={!canProceed || loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Processing…</span>
                </>
              ) : (
                <>
                  <span>Confirm Payment · ₹{subtotal}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
