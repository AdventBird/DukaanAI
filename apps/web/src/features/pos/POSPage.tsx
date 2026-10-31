import React, { useEffect, useState } from 'react';
import { ShoppingCart, Barcode, Trash2, Plus, Minus, CheckCircle, Receipt, QrCode, CreditCard, Banknote, BookOpen, AlertCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  brand: string | null;
  sellingPrice: string;
  stockUnit: string;
  barcodes?: Array<{ barcode: string }>;
  quantityOnHand?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface SaleResult {
  id: string;
  receiptNumber: string;
  total: string;
  subtotal: string;
  discountTotal: string;
  paymentMethod: string;
  amountPaid: string;
  changeDue: string;
  customerLabel: string | null;
  items: Array<{
    productName: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
    stockUnit: string;
  }>;
  createdAt: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [customerLabel, setCustomerLabel] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [completedSale, setCompletedSale] = useState<SaleResult | null>(null);

  // Load catalog
  useEffect(() => {
    fetch(`${apiBase}/products?pageSize=50`)
      .then((res) => res.json())
      .then((body) => {
        if (body.data) setProducts(body.data);
      })
      .catch((err) => console.error('Failed to load products for POS', err));
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [...prev, { product, quantity: 1, unitPrice: Number(product.sellingPrice) }];
    });
    setSearch('');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = 0;
  const grandTotal = Math.max(0, subtotal - discount);

  const tendered = Number(tenderedAmount) || 0;
  const changeDue = paymentMethod === 'CASH' && tendered >= grandTotal ? tendered - grandTotal : 0;

  const filteredProducts = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.brand?.toLowerCase().includes(search.toLowerCase()) ||
          p.barcodes?.some((b) => b.barcode.includes(search))
      )
    : [];

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setError('Please add at least one item to the cart.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        customerLabel: customerLabel.trim() || undefined,
        paymentMethod,
        amountPaid: paymentMethod === 'CREDIT' ? '0.00' : (tendered > 0 ? tendered.toFixed(2) : grandTotal.toFixed(2)),
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toFixed(2),
        })),
      };

      const res = await fetch(`${apiBase}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed to record sale');
      }

      setCompletedSale(body.data);
      setCart([]);
      setTenderedAmount('');
      setCustomerLabel('');
    } catch (err: any) {
      setError(err.message || 'Sale could not be processed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pos-page" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
      {/* Left Column: Product Selection & Catalog */}
      <section className="pos-catalog panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ShoppingCart size={22} color="var(--green)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Billing Counter & Scanner</h2>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Scan barcodes or quick-pick fastest moving grocery items
            </p>
          </div>
        </div>

        {/* Barcode Search Input */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '2px solid var(--green)', borderRadius: '8px', padding: '6px 12px', background: '#fff' }}>
            <Barcode size={20} color="var(--green)" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Scan EAN-13 barcode or type product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                ✕
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {search.trim() && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                zIndex: 10,
                maxHeight: '260px',
                overflowY: 'auto',
                marginTop: '4px',
              }}
            >
              {filteredProducts.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                  No matching products found.
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f5fbf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {p.brand} · Barcode: {p.barcodes?.[0]?.barcode || '—'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px' }}>
                      ₹{Number(p.sellingPrice).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Quick Pick Kirana Staples */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            ⚡ Frequent Kirana Items
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {products.slice(0, 9).map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                style={{
                  background: '#f8faf9',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '75px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--green)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1d2a26', lineClamp: 2, overflow: 'hidden' }}>
                  {p.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>{p.stockUnit}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
                    ₹{Number(p.sellingPrice).toFixed(0)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Right Column: Active Cart & Checkout */}
      <section className="pos-cart panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Current Bill ({cart.reduce((n, i) => n + i.quantity, 0)} items)</h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Items List */}
        <div style={{ flex: 1, minHeight: '180px', maxHeight: '280px', overflowY: 'auto', borderBottom: '1px solid var(--line)', marginBottom: '14px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '40px 0' }}>
              <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <div>Cart is empty.</div>
              <small>Scan barcodes or tap products to build customer bill.</small>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.product.id} style={{ borderBottom: '1px solid #f0f3f1' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>
                      <div>{item.product.name}</div>
                      <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                        ₹{item.unitPrice.toFixed(2)} / {item.product.stockUnit}
                      </small>
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff' }}>
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer' }}
                        >
                          <Minus size={11} />
                        </button>
                        <span style={{ fontWeight: 700, padding: '0 6px', minWidth: '20px' }}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          style={{ border: 'none', background: 'none', padding: '4px 6px', cursor: 'pointer' }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>
                      ₹{(item.quantity * item.unitPrice).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 0 8px 6px', textAlign: 'right' }}>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Customer / Khata Selection */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
            Customer Name / Ledger Khata (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Sharmaji (Flat 302) or Gupta Khata #42"
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid var(--line)', borderRadius: '6px' }}
          />
        </div>

        {/* Payment Methods */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
            Payment Method
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setPaymentMethod('CASH')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: paymentMethod === 'CASH' ? '2px solid var(--green)' : '1px solid var(--line)',
                background: paymentMethod === 'CASH' ? '#eaf4ef' : '#fff',
                color: paymentMethod === 'CASH' ? 'var(--green)' : 'inherit',
              }}
            >
              <Banknote size={15} /> Cash
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: paymentMethod === 'UPI' ? '2px solid #0284c7' : '1px solid var(--line)',
                background: paymentMethod === 'UPI' ? '#e0f2fe' : '#fff',
                color: paymentMethod === 'UPI' ? '#0284c7' : 'inherit',
              }}
            >
              <QrCode size={15} /> UPI QR
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('CREDIT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: paymentMethod === 'CREDIT' ? '2px solid #d97706' : '1px solid var(--line)',
                background: paymentMethod === 'CREDIT' ? '#fef3c7' : '#fff',
                color: paymentMethod === 'CREDIT' ? '#b45309' : 'inherit',
              }}
            >
              <BookOpen size={15} /> Khata
            </button>
          </div>

          {/* Cash Tender Calculation */}
          {paymentMethod === 'CASH' && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#f8faf9', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Cash Tendered:</span>
                <input
                  type="number"
                  placeholder={grandTotal > 0 ? grandTotal.toFixed(0) : '0'}
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  style={{ width: '90px', padding: '4px 8px', fontSize: '13px', fontWeight: 700, textAlign: 'right', border: '1px solid var(--line)', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTenderedAmount(amt.toString())}
                    style={{ flex: 1, padding: '3px 0', fontSize: '10px', background: '#fff', border: '1px solid var(--line)', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
              {changeDue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--green)' }}>
                  <span>Change to Return:</span>
                  <span>₹{changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* UPI QR Display */}
          {paymentMethod === 'UPI' && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd', textAlign: 'center', fontSize: '11px', color: '#0369a1' }}>
              Scan Store UPI: <b>ganeshkirana@okhdfcbank</b>
            </div>
          )}

          {/* Khata Notice */}
          {paymentMethod === 'CREDIT' && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '11px', color: '#92400e' }}>
              Bill will be charged to the customer ledger khata book.
            </div>
          )}
        </div>

        {/* Bill Grand Total & Action */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>
            <span>Total to Collect:</span>
            <span style={{ color: 'var(--green)' }}>₹{grandTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || isSubmitting}
            className="primary-button"
            style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <CheckCircle size={18} /> {isSubmitting ? 'Recording Sale...' : 'Complete Sale & Print Bill (₹' + grandTotal.toFixed(2) + ')'}
          </button>
        </div>
      </section>

      {/* Invoice Modal on Completion */}
      {completedSale && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div className="panel" style={{ width: '380px', padding: '24px', background: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.3px' }}>SHREE GANESH KIRANA STORE</div>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Dana Bandar, Mumbai · Ph: +91 9820556677</small>
              <div style={{ margin: '8px 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--green)' }}>
                ✓ SALE COMPLETED
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {completedSale.receiptNumber} · {new Intl.DateTimeFormat('en-IN', { timeStyle: 'short', dateStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(completedSale.createdAt))}
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: '14px', maxHeight: '180px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '4px' }}>Item</th>
                    <th style={{ paddingBottom: '4px', textAlign: 'center' }}>Qty</th>
                    <th style={{ paddingBottom: '4px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSale.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8faf9' }}>
                      <td style={{ padding: '4px 0' }}>{item.productName}</td>
                      <td style={{ padding: '4px 0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>₹{Number(item.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px' }}>
                <span>Grand Total:</span>
                <span>₹{Number(completedSale.total).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '11px' }}>
                <span>Paid via {completedSale.paymentMethod}:</span>
                <span>₹{Number(completedSale.amountPaid).toFixed(2)}</span>
              </div>
              {Number(completedSale.changeDue) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)', fontSize: '11px', fontWeight: 700 }}>
                  <span>Change Given:</span>
                  <span>₹{Number(completedSale.changeDue).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.print()}
                className="btn-secondary"
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <Receipt size={14} /> Print
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="primary-button"
                style={{ flex: 1 }}
              >
                Start Next Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
