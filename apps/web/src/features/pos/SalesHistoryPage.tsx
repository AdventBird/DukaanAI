import React, { useState, useEffect, useCallback } from 'react';
import { ReceiptText, Search, RefreshCw, Eye, Banknote, Smartphone, CreditCard, Clock, CheckCircle } from 'lucide-react';
import type { SaleSummaryDto, PaymentMethod } from '@dukaanai/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote size={14} />,
  UPI: <Smartphone size={14} />,
  CREDIT: <CreditCard size={14} />,
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT: 'Udhar',
};

function formatIST(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

export function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });
      if (search.trim()) params.set('search', search.trim());
      if (paymentFilter) params.set('paymentMethod', paymentFilter);

      const res = await fetch(`${API_BASE}/sales?${params.toString()}`);
      const json = await res.json();

      if (res.ok && Array.isArray(json.data)) {
        setSales(json.data);
        if (json.meta?.pagination) {
          setTotalPages(json.meta.pagination.totalPages ?? 1);
          setTotalCount(json.meta.pagination.total ?? 0);
        }
      } else {
        setError('Failed to load sales history.');
      }
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentFilter]);

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  // Debounce search to avoid firing on every keystroke
  useEffect(() => {
    setPage(1);
  }, [search, paymentFilter]);

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SALES HISTORY</p>
          <h1>Sales Records</h1>
          <p className="subhead">View and search completed and credit sales transactions.</p>
        </div>
        <button className="btn-secondary" onClick={() => void fetchSales()}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="sales-filter-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by receipt # or customer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sales-filter-pills">
          {(['', 'CASH', 'UPI', 'CREDIT'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`filter-pill ${paymentFilter === m ? 'active' : ''}`}
              onClick={() => setPaymentFilter(m)}
            >
              {m === '' ? 'All' : PAYMENT_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="panel sales-list-panel">
        <div className="panel-header" style={{ padding: '14px 16px' }}>
          <div>
            <h2>Transactions</h2>
            {!loading && <p>{totalCount} records found</p>}
          </div>
        </div>

        {loading && (
          <div className="sales-loading">
            <RefreshCw size={20} className="spin-animation" />
            <span>Loading sales…</span>
          </div>
        )}

        {error && !loading && (
          <div className="error-banner" style={{ margin: '16px' }}>
            <span>{error}</span>
            <button onClick={() => void fetchSales()}>Retry</button>
          </div>
        )}

        {!loading && !error && sales.length === 0 && (
          <div className="sales-empty">
            <ReceiptText size={32} />
            <b>No sales found</b>
            <span>Sales processed through POS will appear here.</span>
          </div>
        )}

        {!loading && sales.length > 0 && (
          <table className="proc-table sales-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date &amp; Time</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const isCredit = sale.paymentMethod === 'CREDIT';
                const isPending = sale.paymentStatus === 'PENDING';
                return (
                  <tr key={sale.id}>
                    <td>
                      <span className="sales-receipt-num">{sale.receiptNumber}</span>
                    </td>
                    <td className="sales-date">{formatIST(sale.createdAt)}</td>
                    <td>{sale.itemCount} item{sale.itemCount !== 1 ? 's' : ''}</td>
                    <td>
                      <span className={`sales-payment-tag ${sale.paymentMethod.toLowerCase()}`}>
                        {PAYMENT_ICONS[sale.paymentMethod]}
                        <span>{PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</span>
                      </span>
                      {sale.customerLabel && (
                        <div className="sales-customer-label">{sale.customerLabel}</div>
                      )}
                    </td>
                    <td>
                      {isPending ? (
                        <span className="proc-badge pending">
                          <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                          Unpaid
                        </span>
                      ) : (
                        <span className="proc-badge received">
                          <CheckCircle size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <strong>₹{sale.total}</strong>
                    </td>
                    <td className="text-right">
                      {isCredit && parseFloat(sale.balanceDue) > 0 ? (
                        <span className="balance-due-amount">₹{sale.balanceDue}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <a
                        href={`/sales/${sale.id}`}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10 }}
                      >
                        <Eye size={12} />
                        View
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="sales-pagination">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="pagination-info">Page {page} of {totalPages}</span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
