import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, PieChart, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface SalesPoint {
  date: string;
  revenue: string;
  transactions: number;
  cashTotal: string;
  upiTotal: string;
  creditTotal: string;
}

interface AnalyticsData {
  points: SalesPoint[];
  summary: {
    totalRevenue: string;
    totalTransactions: number;
    averageBasket: string;
    grossProfit: string;
    grossMarginPercent: string;
    cashTotal: string;
    upiTotal: string;
    creditTotal: string;
  };
}

interface TopProduct {
  productId: string;
  name: string;
  brand: string | null;
  category: string;
  stockUnit: string;
  unitsSold: string;
  revenue: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export function AnalyticsPage() {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<SalesPoint | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/analytics/sales?days=${days}`).then((r) => r.json()),
      fetch(`${apiBase}/analytics/products/top-selling?limit=5`).then((r) => r.json()),
    ])
      .then(([salesRes, productsRes]) => {
        if (salesRes.data) setData(salesRes.data);
        if (productsRes.data?.items) setTopProducts(productsRes.data.items);
      })
      .catch((err) => console.error('Failed to load analytics', err))
      .finally(() => setLoading(false));
  }, [days]);

  const maxRevenue = data?.points ? Math.max(...data.points.map((p) => Number(p.revenue)), 1) : 1;

  const totalRev = Number(data?.summary?.totalRevenue || 0);
  const upiPercent = totalRev > 0 ? (Number(data?.summary?.upiTotal || 0) / totalRev) * 100 : 0;
  const cashPercent = totalRev > 0 ? (Number(data?.summary?.cashTotal || 0) / totalRev) * 100 : 0;
  const creditPercent = totalRev > 0 ? (Number(data?.summary?.creditTotal || 0) / totalRev) * 100 : 0;

  return (
    <div className="analytics-page">
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">STORE PERFORMANCE</p>
          <h1>Sales & Finance Analytics</h1>
          <p className="subhead">Live revenue trends, gross margin calculations, payment breakdowns, and fastest-selling FMCG inventory.</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: days === d ? '1px solid var(--green)' : '1px solid var(--line)',
                background: days === d ? '#eaf4ef' : '#fff',
                color: days === d ? 'var(--green)' : 'var(--muted)',
              }}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="kpi-grid" style={{ marginBottom: '20px' }}>
        <article className="panel metric">
          <div className="metric-top">
            <span>Period Revenue</span>
            <span className="metric-icon"><TrendingUp size={16} /></span>
          </div>
          <strong>₹{Number(data?.summary?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          <small>{data?.summary?.totalTransactions || 0} customer bills</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Average Basket (AOV)</span>
            <span className="metric-icon"><ShoppingBag size={16} /></span>
          </div>
          <strong>₹{Number(data?.summary?.averageBasket || 0).toFixed(2)}</strong>
          <small>Per customer transaction</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Estimated Gross Profit</span>
            <span className="metric-icon"><DollarSign size={16} /></span>
          </div>
          <strong>₹{Number(data?.summary?.grossProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
          <small>Margin: <b>{data?.summary?.grossMarginPercent || '0%'}</b></small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>UPI Adoption</span>
            <span className="metric-icon"><PieChart size={16} /></span>
          </div>
          <strong>{upiPercent.toFixed(0)}%</strong>
          <small>₹{Number(data?.summary?.upiTotal || 0).toLocaleString('en-IN')} via QR & UPI</small>
        </article>
      </section>

      {/* Charts & Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Left: 7-Day Revenue Bar Chart */}
        <section className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px' }}>Daily Sales Trend</h2>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                Recorded sales revenue across the last {days} days
              </p>
            </div>
            {hoveredPoint && (
              <div style={{ fontSize: '11px', background: '#f0fdf4', border: '1px solid #86efac', padding: '4px 8px', borderRadius: '4px', color: '#166534' }}>
                <b>{hoveredPoint.date}</b>: ₹{Number(hoveredPoint.revenue).toFixed(2)} ({hoveredPoint.transactions} bills)
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '12px' }}>
              Loading sales trends...
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px', paddingTop: '20px', borderBottom: '1px solid var(--line)' }}>
              {data?.points.map((pt) => {
                const heightPercent = maxRevenue > 0 ? (Number(pt.revenue) / maxRevenue) * 100 : 0;
                const d = new Date(pt.date);
                const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(d);
                const dateNum = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d);

                return (
                  <div
                    key={pt.date}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px', fontWeight: 600 }}>
                      {Number(pt.revenue) > 0 ? `₹${Math.round(Number(pt.revenue))}` : '—'}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '42px',
                        height: `${Math.max(4, heightPercent)}%`,
                        background: Number(pt.revenue) > 0 ? 'var(--green)' : '#e2e8f0',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease, background 0.2s',
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--muted)', lineHeight: '1.2' }}>
                      <div style={{ fontWeight: 700, color: '#334155' }}>{dayName}</div>
                      <div>{dateNum}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Payment Modes Distribution */}
        <section className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '16px' }}>Payment Modes Share</h2>
          <p style={{ margin: '0 0 16px', fontSize: '11px', color: 'var(--muted)' }}>
            Digital UPI vs Physical Cash vs Kirana Khata
          </p>

          {/* Stacked Progress Bar */}
          <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', marginBottom: '18px' }}>
            <div style={{ width: `${upiPercent}%`, background: '#0284c7', transition: 'width 0.4s' }} title={`UPI: ${upiPercent.toFixed(1)}%`} />
            <div style={{ width: `${cashPercent}%`, background: '#16a34a', transition: 'width 0.4s' }} title={`Cash: ${cashPercent.toFixed(1)}%`} />
            <div style={{ width: `${creditPercent}%`, background: '#d97706', transition: 'width 0.4s' }} title={`Khata: ${creditPercent.toFixed(1)}%`} />
          </div>

          {/* Breakdown Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f0f9ff', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>UPI / QR (Google Pay, PhonePe)</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>₹{Number(data?.summary?.upiTotal || 0).toFixed(2)}</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>{upiPercent.toFixed(1)}%</small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f0fdf4', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Cash Till Collections</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>₹{Number(data?.summary?.cashTotal || 0).toFixed(2)}</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>{cashPercent.toFixed(1)}%</small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fffbeb', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Customer Khata (Credit Ledger)</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>₹{Number(data?.summary?.creditTotal || 0).toFixed(2)}</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>{creditPercent.toFixed(1)}%</small>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Section: Top-Selling FMCG Products */}
      <section className="panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Top-Selling FMCG Products</h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
              Highest velocity inventory by units sold and revenue contribution
            </p>
          </div>
          <a href="/products" className="text-link">Manage Catalog <span>→</span></a>
        </div>

        <table className="proc-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Rank</th>
              <th>Product Name</th>
              <th>Brand</th>
              <th>Category</th>
              <th style={{ textAlign: 'center' }}>Units Sold</th>
              <th style={{ textAlign: 'right' }}>Revenue Generated</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, idx) => (
              <tr key={p.productId}>
                <td style={{ fontWeight: 800, color: 'var(--muted)' }}>#{idx + 1}</td>
                <td style={{ fontWeight: 700 }}>{p.name}</td>
                <td style={{ color: 'var(--muted)' }}>{p.brand || '—'}</td>
                <td><span className="proc-badge draft">{p.category}</span></td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.unitsSold} {p.stockUnit.toLowerCase()}s</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)', fontSize: '13px' }}>
                  ₹{Number(p.revenue).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
