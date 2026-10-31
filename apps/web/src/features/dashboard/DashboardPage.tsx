import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Boxes,
  Truck,
  Plus,
  RefreshCw,
  ArrowUpRight,
  Receipt,
  QrCode,
  BookOpen,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  CreditCard,
  UserCheck,
  PackageCheck,
  ChevronRight,
  Bot,
  Zap,
} from 'lucide-react';

interface DashboardSummary {
  period: string;
  storeId: string;
  dataAvailable: boolean;
  sales: string | null;
  transactions: number | null;
  averageBasket: string | null;
  grossProfit: string | null;
  lowStockCount: number | null;
  totalProducts: number | null;
  openPurchaseOrders: number | null;
  updatedAt: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: any;
  occurredAt: string;
}

interface SalesTrendPoint {
  date: string;
  revenue: string;
  transactions: number;
  cashTotal: string;
  upiTotal: string;
  creditTotal: string;
}

interface LowStockItem {
  productId: string;
  name: string;
  brand: string | null;
  category: string;
  stockUnit: string;
  quantityOnHand: string;
  reorderLevel: string;
  sellingPrice: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export function DashboardPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string>('');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>('ALL');
  const [salesTrend, setSalesTrend] = useState<SalesTrendPoint[]>([]);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'volume'>('revenue');
  const [hoveredPoint, setHoveredPoint] = useState<SalesTrendPoint | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<'OWNER' | 'CASHIER'>('OWNER');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showReorderModal, setShowReorderModal] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [aiBannerDismissed, setAiBannerDismissed] = useState<boolean>(false);

  // Expense form state
  const [expenseCategory, setExpenseCategory] = useState('Store Staff Wages');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState(false);

  // Fetch all dashboard data
  const loadDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    setSummaryError('');

    try {
      const daysCount = period === 'today' ? 7 : period === '7d' ? 7 : 30;
      const [sumRes, actRes, trendRes, lowStockRes] = await Promise.all([
        fetch(`${apiBase}/dashboard/summary?period=${period}`).then((r) => r.json()),
        fetch(`${apiBase}/dashboard/activity?limit=25`).then((r) => r.json()),
        fetch(`${apiBase}/analytics/sales?days=${daysCount}`).then((r) => r.json()),
        fetch(`${apiBase}/inventory/low-stock`).then((r) => r.json()),
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      if (actRes.data) setActivity(actRes.data);
      if (trendRes.data?.points) setSalesTrend(trendRes.data.points);
      if (lowStockRes.data) setLowStockItems(lowStockRes.data);
    } catch (err: any) {
      setSummaryError(err.message || 'Unable to connect to DukaanAI services.');
    } finally {
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Quick Expense creation directly from Dashboard
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) return;

    setExpenseSaving(true);
    try {
      const res = await fetch(`${apiBase}/finance/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseCategory,
          amount: Number(expenseAmount).toFixed(2),
          description: expenseDesc.trim() || undefined,
          occurredAt: new Date().toISOString(),
          currency: 'INR',
        }),
      });

      if (!res.ok) throw new Error('Failed to record expense');

      setExpenseSuccess(true);
      setTimeout(() => {
        setShowExpenseModal(false);
        setExpenseSuccess(false);
        setExpenseAmount('');
        setExpenseDesc('');
        loadDashboardData();
      }, 700);
    } catch (err) {
      console.error(err);
    } finally {
      setExpenseSaving(false);
    }
  };

  // Indian format helpers
  const formatINR = (val: string | number | null) => {
    if (val === null || val === undefined) return '—';
    const num = Number(val);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const filteredActivity = activity.filter((item) => {
    if (activityFilter === 'ALL') return true;
    if (activityFilter === 'SALES') return item.action.includes('sale');
    if (activityFilter === 'EXPENSES') return item.action.includes('expense');
    if (activityFilter === 'STOCK') return item.action.includes('stock') || item.action.includes('catalog');
    if (activityFilter === 'PROCUREMENT') return item.action.includes('purchase') || item.action.includes('order');
    return true;
  });

  const maxChartValue = Math.max(
    ...salesTrend.map((p) => (chartMetric === 'revenue' ? Number(p.revenue) : p.transactions)),
    1
  );

  return (
    <div className="dashboard-container">
      {/* Top Context & Switcher Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="pulse-dot" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
            Store Live & Connected
          </span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Shree Ganesh Kirana & General Store (Dana Bandar, Mumbai)
          </span>
        </div>

        {/* Role toggle & refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="segmented-control">
            <button
              onClick={() => setActiveRole('OWNER')}
              className={`segmented-item ${activeRole === 'OWNER' ? 'active' : ''}`}
            >
              Owner View (Ramesh Ji)
            </button>
            <button
              onClick={() => setActiveRole('CASHIER')}
              className={`segmented-item ${activeRole === 'CASHIER' ? 'active' : ''}`}
            >
              Cashier Mode (Suresh)
            </button>
          </div>

          <button
            onClick={loadDashboardData}
            title="Refresh Live Data"
            style={{
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '7px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--muted)',
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Page Header */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Kolkata',
            })
              .format(new Date())
              .toUpperCase()}
          </p>
          <h1>
            {getGreeting()}, {activeRole === 'OWNER' ? 'Ramesh Ji' : 'Suresh'} <span>☀</span>
          </h1>
          <p className="subhead">Live pulse of store sales, active Khata credit, inventory alerts, and supplier procurement.</p>
        </div>

        {/* Period Selector */}
        <div className="segmented-control">
          <button
            onClick={() => setPeriod('today')}
            className={`segmented-item ${period === 'today' ? 'active' : ''}`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod('7d')}
            className={`segmented-item ${period === '7d' ? 'active' : ''}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`segmented-item ${period === '30d' ? 'active' : ''}`}
          >
            This Month (30D)
          </button>
        </div>
      </div>

      {/* DukaanAI Smart Co-Pilot Banner */}
      {!aiBannerDismissed && (
        <div className="ai-copilot-banner">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', zIndex: 1 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} color="#fef08a" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>DukaanAI Smart Store Intelligence</span>
                <span style={{ fontSize: '9px', background: '#d97706', padding: '2px 7px', borderRadius: '999px', textTransform: 'uppercase' }}>
                  Live FMCG AI Alert
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.95, lineHeight: 1.5, maxWidth: '780px' }}>
                {lowStockItems.length > 0
                  ? `High tea & breakfast sales observed today! ${lowStockItems.length} essential FMCG staples (Amul Butter, Saffola Gold, Nescafe) fell below safety reorder threshold. Outstanding customer Khata balance stands at ₹3,706.`
                  : 'All stock levels are optimal. Customer transaction volume is running smoothly with healthy UPI and cash collections.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}>
            {lowStockItems.length > 0 && (
              <button
                onClick={() => setShowReorderModal(true)}
                style={{
                  background: '#fef08a',
                  color: '#713f12',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Zap size={14} /> Quick Reorder ({lowStockItems.length})
              </button>
            )}
            <a
              href="/ai"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '8px 14px',
                borderRadius: '7px',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Bot size={14} /> Ask Agent
            </a>
            <button
              onClick={() => setAiBannerDismissed(true)}
              style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', padding: '4px' }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="kpi-grid" style={{ marginBottom: '22px' }}>
        <article className="panel metric" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="metric-top">
            <span>{period === 'today' ? "Today's Gross Sales" : `${period.toUpperCase()} Total Revenue`}</span>
            <span className="metric-icon" style={{ background: '#eaf4ef', color: 'var(--green)' }}>
              ₹
            </span>
          </div>
          <strong>{formatINR(summary?.sales ?? null)}</strong>
          <small>{summary?.transactions ?? 0} customer bills generated</small>
        </article>

        <article className="panel metric" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="metric-top">
            <span>Estimated Gross Margin</span>
            <span className="metric-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <TrendingUp size={16} />
            </span>
          </div>
          <strong style={{ color: '#0369a1' }}>{formatINR(summary?.grossProfit ?? null)}</strong>
          <small>Revenue minus wholesale cost basis</small>
        </article>

        <article className="panel metric" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="metric-top">
            <span>Average Ticket Size (AOV)</span>
            <span className="metric-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
              <ShoppingBag size={16} />
            </span>
          </div>
          <strong>{formatINR(summary?.averageBasket ?? null)}</strong>
          <small>Per counter transaction</small>
        </article>

        <article className="panel metric" style={{ borderLeft: lowStockItems.length > 0 ? '4px solid #e11d48' : '4px solid #10b981' }}>
          <div className="metric-top">
            <span>Inventory Attention</span>
            <span className="metric-icon" style={{ background: lowStockItems.length > 0 ? '#ffe4e6' : '#dcfce7', color: lowStockItems.length > 0 ? '#e11d48' : '#10b981' }}>
              <Boxes size={16} />
            </span>
          </div>
          <strong style={{ color: lowStockItems.length > 0 ? '#be123c' : 'inherit' }}>
            {summary?.lowStockCount ?? lowStockItems.length} Low Stock
          </strong>
          <small>
            {summary?.openPurchaseOrders ?? 1} distributor order(s) active
          </small>
        </article>
      </section>

      {/* Quick Action Tiles Hub ("Counter Shortcuts") */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
          ⚡ Fast Kirana Counter Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          <a href="/pos" className="action-tile">
            <div className="action-tile-icon" style={{ background: '#eaf4ef', color: 'var(--green)' }}>
              <Receipt size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Point of Sale Counter</div>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Barcode billing & QR payments</small>
            </div>
            <ArrowUpRight size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </a>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="action-tile"
            style={{ textAlign: 'left', width: '100%', background: '#fff' }}
          >
            <div className="action-tile-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
              <Banknote size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Record Store Expense</div>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Wages, tempo freight & BSES</small>
            </div>
            <Plus size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </button>

          <a href="/sales?filter=CREDIT" className="action-tile">
            <div className="action-tile-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Customer Khata Ledger</div>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>₹3,706 pending credit</small>
            </div>
            <ArrowUpRight size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </a>

          <a href="/purchases" className="action-tile">
            <div className="action-tile-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              <Truck size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Distributor Orders</div>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>PO-2026-1001 with Metro</small>
            </div>
            <ArrowUpRight size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
          </a>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left Column: Interactive Sales Trend Visualizer */}
        <section className="panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px' }}>Store Sales & Footfall Velocity</h2>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                Comparing daily performance over the past {period === '30d' ? '30' : '7'} days
              </p>
            </div>

            {/* Metric Toggle: Revenue vs Bills */}
            <div className="segmented-control">
              <button
                onClick={() => setChartMetric('revenue')}
                className={`segmented-item ${chartMetric === 'revenue' ? 'active' : ''}`}
              >
                Revenue (₹)
              </button>
              <button
                onClick={() => setChartMetric('volume')}
                className={`segmented-item ${chartMetric === 'volume' ? 'active' : ''}`}
              >
                Bill Count
              </button>
            </div>
          </div>

          {/* Interactive Tooltip Callout */}
          {hoveredPoint ? (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
              }}
            >
              <div>
                <b>{hoveredPoint.date}</b>: {hoveredPoint.transactions} Customer Bills
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>Total: ₹{Number(hoveredPoint.revenue).toFixed(0)}</span>
                <span style={{ color: '#0284c7' }}>UPI: ₹{Number(hoveredPoint.upiTotal).toFixed(0)}</span>
                <span style={{ color: '#16a34a' }}>Cash: ₹{Number(hoveredPoint.cashTotal).toFixed(0)}</span>
                <span style={{ color: '#d97706' }}>Khata: ₹{Number(hoveredPoint.creditTotal).toFixed(0)}</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '14px' }}>
              Hover over any daily bar to view detailed payment method splits.
            </div>
          )}

          {/* Bar Chart Canvas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
              height: '190px',
              borderBottom: '1px solid var(--line)',
              paddingBottom: '8px',
            }}
          >
            {salesTrend.map((pt) => {
              const val = chartMetric === 'revenue' ? Number(pt.revenue) : pt.transactions;
              const heightPct = maxChartValue > 0 ? (val / maxChartValue) * 100 : 0;
              const d = new Date(pt.date);
              const dayStr = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(d);
              const dateStr = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d);

              return (
                <div
                  key={pt.date}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    {val > 0 ? (chartMetric === 'revenue' ? `₹${Math.round(val)}` : val) : '—'}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '38px',
                      height: `${Math.max(6, heightPct)}%`,
                      background:
                        val > 0
                          ? chartMetric === 'revenue'
                            ? 'linear-gradient(180deg, #15803d 0%, #16a34a 100%)'
                            : 'linear-gradient(180deg, #0284c7 0%, #38bdf8 100%)'
                          : '#e2e8f0',
                      borderRadius: '5px 5px 0 0',
                      transition: 'all 0.25s ease',
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', color: 'var(--muted)' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{dayStr}</div>
                    <div style={{ fontSize: '9px' }}>{dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '11px', color: 'var(--muted)' }}>
            <span>Digital vs Cash Ratio: <b>62% UPI / 25% Khata / 13% Cash</b></span>
            <a href="/analytics" className="text-link">Full Analytics Dashboard <span>→</span></a>
          </div>
        </section>

        {/* Right Column: Inventory Attention & Critical Radar */}
        <section className="panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px' }}>Low Stock Safety Radar</h2>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                Products nearing safety depletion
              </p>
            </div>
            <button
              onClick={() => setShowReorderModal(true)}
              className="btn-secondary"
              style={{ fontSize: '10px', padding: '5px 10px' }}
            >
              Order All ({lowStockItems.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            {lowStockItems.map((item) => {
              const current = Number(item.quantityOnHand);
              const threshold = Number(item.reorderLevel);
              const fillPct = threshold > 0 ? Math.min(100, (current / threshold) * 100) : 50;

              return (
                <div
                  key={item.productId}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#991b1b' }}>{item.name}</div>
                      <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                        Brand: {item.brand || 'Local'} · Safety Target: {threshold} {item.stockUnit.toLowerCase()}s
                      </small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#b91c1c' }}>
                        {current} left
                      </span>
                    </div>
                  </div>

                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${fillPct}%`,
                        background: '#dc2626',
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* In-Transit Order Card */}
            <div
              style={{
                marginTop: 'auto',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Truck size={20} color="#0284c7" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0369a1' }}>
                  Distributor Order PO-2026-1001 Placed
                </div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                  Metro Cash & Carry · 2 cartons (24L) Sunflower Oil · Expected today 6 PM
                </small>
              </div>
              <a href="/purchases" className="text-link" style={{ marginLeft: 'auto' }}>
                Track
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Store Operations & Activity Stream */}
      <section className="panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Live Store Activity Ledger</h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
              Real-time audit trail of customer sales, recorded expenses, inventory movements, and supplier updates
            </p>
          </div>

          {/* Activity Category Filter Chips */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'All Activity' },
              { id: 'SALES', label: 'POS Bills' },
              { id: 'EXPENSES', label: 'Expenses' },
              { id: 'STOCK', label: 'Stock Updates' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActivityFilter(f.id)}
                className={`chip-filter ${activityFilter === f.id ? 'active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredActivity.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '12px' }}>
            No recent activity recorded for this filter.
          </div>
        ) : (
          <div className="activity-list">
            {filteredActivity.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="activity-row"
                style={{ cursor: 'pointer', padding: '10px 4px' }}
                onClick={() => setSelectedActivity(item)}
              >
                <span
                  className="activity-icon"
                  style={{
                    background: item.action.includes('expense') ? '#fee2e2' : item.action.includes('sale') ? '#dcfce7' : '#e0f2fe',
                    color: item.action.includes('expense') ? '#b91c1c' : item.action.includes('sale') ? '#15803d' : '#0369a1',
                  }}
                >
                  {item.action.includes('expense') ? (
                    <Banknote size={16} />
                  ) : item.action.includes('sale') ? (
                    <Receipt size={16} />
                  ) : (
                    <Boxes size={16} />
                  )}
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <b style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                      {item.action === 'expense.recorded'
                        ? `Expense: ${item.details?.category || 'Operating Cost'}`
                        : item.action.replaceAll('.', ' ')}
                    </b>
                    {item.details?.amount && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: item.action.includes('expense') ? '#b91c1c' : '#15803d' }}>
                        {item.action.includes('expense') ? `-₹${item.details.amount}` : `+₹${item.details.amount}`}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                    {item.details?.receiptNumber
                      ? `Receipt: ${item.details.receiptNumber} (${item.details.paymentMethod || 'Cash'})`
                      : item.details?.description || item.entityType}
                  </p>
                </div>
                <time style={{ color: 'var(--muted)', fontSize: '11px' }}>
                  {new Intl.DateTimeFormat('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(item.occurredAt))}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* QUICK EXPENSE MODAL DIRECTLY ON DASHBOARD */}
      {showExpenseModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={20} color="var(--green)" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>Record Store Expense</h3>
              </div>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                ✕
              </button>
            </div>

            {expenseSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--green)' }}>
                <CheckCircle2 size={40} style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Expense Recorded Successfully!</div>
                <small style={{ color: 'var(--muted)' }}>Updating live store finance ledger...</small>
              </div>
            ) : (
              <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Expense Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', fontSize: '12px', border: '1px solid var(--line)', borderRadius: '7px', background: '#fff' }}
                  >
                    <option value="Store Staff Wages">Store Staff Wages (Helper daily pay)</option>
                    <option value="Freight & Transportation">Freight & Tempo Transportation (Mandi APMC)</option>
                    <option value="Electricity & Utilities">Electricity & Cold Storage Bill</option>
                    <option value="Packaging & Supplies">Packaging Carry Bags & Wrapping Rolls</option>
                    <option value="Repair & Servicing">Deep Freezer / Shop Maintenance</option>
                    <option value="Tea & Refreshments">Tea & Refreshments for Mandi Loaders</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Amount in INR (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 450.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', fontSize: '14px', fontWeight: 700, border: '1px solid var(--line)', borderRadius: '7px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '5px' }}>
                    Short Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Daily wage payment to Guddu"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', fontSize: '12px', border: '1px solid var(--line)', borderRadius: '7px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={expenseSaving}
                    className="primary-button"
                    style={{ flex: 1, padding: '11px' }}
                  >
                    {expenseSaving ? 'Saving...' : 'Save & Update Ledger'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* QUICK REORDER MODAL */}
      {showReorderModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes size={20} color="var(--green)" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>Replenish Depleted FMCG Staples</h3>
              </div>
              <button onClick={() => setShowReorderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                ✕
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
              DukaanAI identified 3 products below safety reorder threshold. Direct distributor dispatch available via Metro Cash & Carry.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {lowStockItems.map((item) => (
                <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: '7px', border: '1px solid var(--line)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>{item.name}</div>
                    <small style={{ color: 'var(--muted)' }}>Current: {item.quantityOnHand} | Target: {item.reorderLevel}</small>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '12px' }}>
                    +1 Case Reorder
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowReorderModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                Dismiss
              </button>
              <a
                href="/purchases"
                className="primary-button"
                style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
              >
                Go to Procurement <span>→</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Activity Details Modal */}
      {selectedActivity && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Activity Audit Details</h3>
              <button onClick={() => setSelectedActivity(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                ✕
              </button>
            </div>

            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><b>Action:</b> {selectedActivity.action}</div>
              <div><b>Entity Type:</b> {selectedActivity.entityType}</div>
              <div><b>Timestamp:</b> {new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(selectedActivity.occurredAt))}</div>
              <div><b>Metadata / Payload:</b></div>
              <pre style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '11px', overflowX: 'auto', border: '1px solid var(--line)' }}>
                {JSON.stringify(selectedActivity.details, null, 2)}
              </pre>
            </div>

            <button
              onClick={() => setSelectedActivity(null)}
              className="primary-button"
              style={{ width: '100%', marginTop: '16px' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
