import React, { useRef } from 'react';
import { X, Printer, CheckCircle, ReceiptText, ShoppingBag } from 'lucide-react';
import type { SaleDto } from '@dukaanai/shared';

interface ReceiptModalProps {
  sale: SaleDto;
  onClose: () => void;
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI / Digital',
  CREDIT: 'Udhar (Credit)',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Paid',
  PENDING: 'Unpaid — Credit',
  FAILED: 'Failed',
};

function formatIST(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt ${sale.receiptNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; color: #111; }
            .receipt-store-name { font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 4px; }
            .receipt-sub { text-align: center; font-size: 10px; color: #666; margin-bottom: 12px; }
            .receipt-divider { border: none; border-top: 1px dashed #999; margin: 8px 0; }
            .receipt-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .receipt-item-name { flex: 1; }
            .receipt-item-total { white-space: nowrap; font-weight: 600; }
            .receipt-total-row { font-size: 14px; font-weight: 800; border-top: 2px solid #111; padding-top: 6px; margin-top: 6px; }
            .receipt-footer { text-align: center; font-size: 10px; color: #666; margin-top: 12px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const isCredit = sale.paymentMethod === 'CREDIT';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Sale Receipt">
      <div className="receipt-modal">
        {/* Header */}
        <div className="receipt-modal-header">
          <div className="receipt-success-badge">
            <CheckCircle size={18} className="receipt-success-icon" />
            <span>Sale Complete!</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close receipt">
            <X size={20} />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="receipt-body" ref={receiptRef}>
          <div className="receipt-store-name">Kirana Store</div>
          <div className="receipt-sub">DukaanAI POS · Demo Workspace</div>

          <hr className="receipt-divider" />

          <div className="receipt-meta">
            <div className="receipt-row">
              <span>Receipt #</span>
              <span className="receipt-value">{sale.receiptNumber}</span>
            </div>
            <div className="receipt-row">
              <span>Date &amp; Time</span>
              <span className="receipt-value">{formatIST(sale.createdAt)}</span>
            </div>
            {sale.customerLabel && (
              <div className="receipt-row">
                <span>Customer</span>
                <span className="receipt-value">{sale.customerLabel}</span>
              </div>
            )}
          </div>

          <hr className="receipt-divider" />

          {/* Items */}
          <div className="receipt-items">
            {sale.items.map((item) => (
              <div key={item.id} className="receipt-item-block">
                <div className="receipt-item-name">
                  <strong>{item.productNameSnapshot}</strong>
                  {item.barcodeSnapshot && (
                    <small className="receipt-barcode"> #{item.barcodeSnapshot}</small>
                  )}
                </div>
                <div className="receipt-row receipt-item-detail">
                  <span>
                    {item.quantity} {item.stockUnitSnapshot} × ₹{item.unitPriceSnapshot}
                  </span>
                  <span className="receipt-item-total">₹{item.lineTotal}</span>
                </div>
              </div>
            ))}
          </div>

          <hr className="receipt-divider" />

          {/* Totals */}
          <div className="receipt-totals">
            <div className="receipt-row">
              <span>Subtotal</span>
              <span>₹{sale.subtotal}</span>
            </div>
            {parseFloat(sale.discountTotal) > 0 && (
              <div className="receipt-row receipt-discount">
                <span>Discount</span>
                <span>−₹{sale.discountTotal}</span>
              </div>
            )}
            <div className="receipt-row receipt-total-row">
              <strong>Total</strong>
              <strong>₹{sale.total}</strong>
            </div>
          </div>

          <hr className="receipt-divider" />

          {/* Payment */}
          <div className="receipt-payment-section">
            <div className="receipt-row">
              <span>Payment</span>
              <span className={`receipt-payment-badge ${isCredit ? 'credit' : 'paid'}`}>
                {PAYMENT_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
              </span>
            </div>
            <div className="receipt-row">
              <span>Status</span>
              <span className={`receipt-status-text ${isCredit ? 'text-orange' : 'text-green'}`}>
                {PAYMENT_STATUS_LABEL[sale.paymentStatus] ?? sale.paymentStatus}
              </span>
            </div>
            {sale.paymentMethod === 'CASH' && parseFloat(sale.changeDue) > 0 && (
              <div className="receipt-row">
                <span>Change Returned</span>
                <span>₹{sale.changeDue}</span>
              </div>
            )}
            {isCredit && (
              <div className="receipt-credit-notice">
                Balance due: <strong>₹{sale.balanceDue}</strong>
              </div>
            )}
          </div>

          <div className="receipt-footer">
            <ReceiptText size={12} />
            <span>Thank you for shopping! · DukaanAI</span>
          </div>
        </div>

        {/* Actions */}
        <div className="receipt-actions">
          <button type="button" className="btn-secondary" onClick={handlePrint}>
            <Printer size={16} />
            <span>Print Receipt</span>
          </button>
          <button type="button" className="checkout-confirm-btn" onClick={onClose}>
            <ShoppingBag size={16} />
            <span>New Sale</span>
          </button>
        </div>
      </div>
    </div>
  );
}
