import React, { useState, useCallback, useRef } from 'react';
import { BarcodeScanner } from './BarcodeScanner.js';
import { ManualSearch } from './ManualSearch.js';
import { Cart } from './Cart.js';
import { CheckoutModal } from './CheckoutModal.js';
import { ReceiptModal } from './ReceiptModal.js';
import { usePosCart } from './usePosCart.js';
import type { SaleDto } from '@dukaanai/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

type PageState = 'pos' | 'checkout' | 'receipt';

export function POSPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [pageState, setPageState] = useState<PageState>('pos');
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [barcodeError, setBarcodeError] = useState('');

  const cart = usePosCart();

  // Lookup barcode via Dev 1's endpoint
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      setBarcodeError('');
      try {
        const res = await fetch(`${API_BASE}/inventory/barcode/${encodeURIComponent(barcode)}`);
        const json = await res.json();
        if (res.ok && json.data) {
          cart.addItem(json.data);
        } else {
          setBarcodeError(`Barcode "${barcode}" not found in inventory.`);
          setTimeout(() => setBarcodeError(''), 4000);
        }
      } catch {
        setBarcodeError('Network error. Check your connection.');
        setTimeout(() => setBarcodeError(''), 4000);
      }
    },
    [cart]
  );

  const handleSaleComplete = useCallback(
    (sale: SaleDto) => {
      setCompletedSale(sale);
      cart.clearCart();
      setPageState('receipt');
    },
    [cart]
  );

  const handleNewSale = useCallback(() => {
    setCompletedSale(null);
    setPageState('pos');
  }, []);

  return (
    <div className="pos-page">
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">POINT OF SALE</p>
          <h1>Sell Products</h1>
          <p className="subhead">Scan barcodes or search to add products to the bill.</p>
        </div>
        {cart.itemCount > 0 && (
          <div className="pos-summary-pill">
            <span>{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}</span>
            <strong>₹{cart.subtotal}</strong>
          </div>
        )}
      </div>

      <div className="pos-layout">
        {/* Left panel: Scanner + Search */}
        <div className="pos-input-panel">
          {/* Barcode Scanner */}
          <div className="panel pos-scanner-card">
            <BarcodeScanner
              isScanning={isScanning}
              onToggleScanning={() => setIsScanning((s) => !s)}
              onScan={handleBarcodeScan}
            />
            {barcodeError && (
              <div className="barcode-error-toast" role="alert">
                ⚠ {barcodeError}
              </div>
            )}
          </div>

          {/* Manual Search */}
          <div className="panel pos-search-card">
            <div className="panel-header" style={{ padding: '14px 16px 0' }}>
              <div>
                <h2>Product Search</h2>
                <p>Type name, brand, or barcode to find a product</p>
              </div>
            </div>
            <div style={{ padding: '10px 16px 14px' }}>
              <ManualSearch
                apiBase={API_BASE}
                onSelectProduct={(prod) => cart.addItem(prod)}
              />
            </div>
          </div>
        </div>

        {/* Right panel: Cart */}
        <div className="pos-cart-section">
          <Cart
            items={cart.items}
            subtotal={cart.subtotal}
            totalSavings={cart.totalSavings}
            itemCount={cart.itemCount}
            totalUnits={cart.totalUnits}
            onIncrement={cart.incrementQuantity}
            onDecrement={cart.decrementQuantity}
            onUpdateQuantity={cart.updateQuantity}
            onRemoveItem={cart.removeItem}
            onClearCart={cart.clearCart}
            onProceedToCheckout={() => setPageState('checkout')}
          />
        </div>
      </div>

      {/* Checkout Modal */}
      {pageState === 'checkout' && (
        <CheckoutModal
          items={cart.items}
          subtotal={cart.subtotal}
          onClose={() => setPageState('pos')}
          onSaleComplete={handleSaleComplete}
          apiBase={API_BASE}
          idempotencyKey={idempotencyKeyRef.current}
        />
      )}

      {/* Receipt Modal */}
      {pageState === 'receipt' && completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={handleNewSale}
        />
      )}
    </div>
  );
}
