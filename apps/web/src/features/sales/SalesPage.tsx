import React, { useEffect, useState } from 'react';
import { ReceiptText, Search, Filter, Eye, QrCode, Banknote, BookOpen, Download } from 'lucide-react';

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  stockUnit: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

interface Sale {
  id: string;
  receiptNumber: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  paymentMethod: 'CASH' | 'UPI' | 'CREDIT';
  paymentStatus: string;
  amountPaid: string;
  changeDue: string;
  balanceDue: string;
  customerLabel: string | null;
  itemCount: number;
  items?: SaleItem[];
  createdAt: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (filterMethod !== 'ALL') query.set('paymentMethod', filterMethod);
    if (search.trim()) query.set('search', search.trim());
    query.set('pageSize', '50');

    fetch(`${apiBase}/sales?${query.toString()}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.data) setSales(body.data);
      })
      .catch((err) => console.error('Failed to load sales list', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSales();
  }, [filterMethod]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSales();
  };

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const cashSales = sales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + Number(s.total), 0);
  const upiSales = sales.filter((s) => s.paymentMethod === 'UPI').reduce((sum, s) => sum + Number(s.total), 0);
  const creditSales = sales.filter((s) => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="sales-page">
      {/* Header */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">SALES & TRANSACTIONS</p>
          <h1>Sales Register & Receipts</h1>
          <p className="subhead">Audited kirana point-of-sale bills, customer khata ledger entries, and payment records.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/pos" className="primary-button" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}>
            + New Sale Bill
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="kpi-grid" style={{ marginBottom: '20px' }}>
        <article className="panel metric">
          <div className="metric-top">
            <span>Period Sales Value</span>
            <span className="metric-icon">₹</span>
          </div>
          <strong>₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          <small>{sales.length} recorded bills</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>UPI Digital Payments</span>
            <span className="metric-icon"><QrCode size={16} /></span>
          </div>
          <strong>₹{upiSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          <small>GPay, PhonePe, Paytm</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Cash Till Collections</span>
            <span className="metric-icon"><Banknote size={16} /></span>
          </div>
          <strong>₹{cashSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          <small>Physical cash counter</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Khata (Customer Credit)</span>
            <span className="metric-icon"><BookOpen size={16} /></span>
          </div>
          <strong>₹{creditSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          <small>Outstanding balance ledger</small>
        </article>
      </section>

      {/* Controls & Filter Tabs */}
      <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Method Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'All Bills' },
              { id: 'CASH', label: 'Cash Only' },
              { id: 'UPI', label: 'UPI / QR' },
              { id: 'CREDIT', label: 'Khata Credit' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterMethod(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: filterMethod === tab.id ? '1px solid var(--green)' : '1px solid var(--line)',
                  background: filterMethod === tab.id ? '#eaf4ef' : '#fff',
                  color: filterMethod === tab.id ? 'var(--green)' : 'var(--muted)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: '6px', padding: '4px 8px', background: '#fff' }}>
              <Search size={14} color="var(--muted)" style={{ marginRight: '6px' }} />
              <input
                type="text"
                placeholder="Search Bill # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '12px' }}
              />
            </div>
            <button type="submit" className="btn-secondary" style={{ padding: '6px 12px' }}>
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Sales Register Table */}
      <div className="panel" style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: '12px' }}>
            Loading sales register...
          </div>
        ) : sales.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: '12px' }}>
            <ReceiptText size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <div>No sales records found for this filter.</div>
          </div>
        ) : (
          <table className="proc-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date & Time</th>
                <th>Customer / Khata</th>
                <th>Payment Mode</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--green)' }}>
                    {sale.receiptNumber}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    {new Intl.DateTimeFormat('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(sale.createdAt))}
                  </td>
                  <td style={{ fontWeight: 600 }}>{sale.customerLabel || 'Walk-in Counter'}</td>
                  <td>
                    <span
                      className={`proc-badge ${
                        sale.paymentMethod === 'UPI' ? 'submitted' : sale.paymentMethod === 'CREDIT' ? 'pending' : 'approved'
                      }`}
                    >
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{sale.itemCount} item(s)</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '13px' }}>
                    ₹{Number(sale.total).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => setSelectedSale(sale)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--green)',
                      }}
                    >
                      <Eye size={12} /> View Bill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bill Details Modal */}
      {selectedSale && (
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
          <div className="panel" style={{ width: '420px', padding: '24px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Invoice: {selectedSale.receiptNumber}</h3>
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                  {new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(selectedSale.createdAt))}
                </small>
              </div>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '12px' }}>
              <div><b>Customer:</b> {selectedSale.customerLabel || 'Walk-in Cash Customer'}</div>
              <div><b>Payment Mode:</b> {selectedSale.paymentMethod} ({selectedSale.paymentStatus})</div>
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '14px' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '6px' }}>Product</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'center' }}>Qty</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'right' }}>Rate</th>
                    <th style={{ paddingBottom: '6px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f8faf9' }}>
                      <td style={{ padding: '6px 0', fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ padding: '6px 0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>₹{Number(item.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                <span>Subtotal:</span>
                <span>₹{Number(selectedSale.subtotal).toFixed(2)}</span>
              </div>
              {Number(selectedSale.discountTotal) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Discount:</span>
                  <span>-₹{Number(selectedSale.discountTotal).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px', marginTop: '4px' }}>
                <span>Grand Total:</span>
                <span style={{ color: 'var(--green)' }}>₹{Number(selectedSale.total).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
              <button onClick={() => window.print()} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ReceiptText size={14} /> Print Bill
              </button>
              <button onClick={() => setSelectedSale(null)} className="primary-button" style={{ flex: 1 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
