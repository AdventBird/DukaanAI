import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Boxes, ReceiptText, Truck, Wallet, Bot, BarChart3 } from 'lucide-react';
import './styles.css';
import { ProductsPage } from './features/products/ProductsPage.js';
import { InventoryPage } from './features/inventory/InventoryPage.js';
import { SuppliersPage } from './features/suppliers/SuppliersPage.js';
import { POSPage } from './features/pos/POSPage.js';
import { SalesHistoryPage } from './features/pos/SalesHistoryPage.js';
import { AIPage } from './features/ai/AIPage.js';

const nav = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'POS', path: '/pos', icon: ShoppingCart },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Inventory', path: '/inventory', icon: Boxes },
  { label: 'Sales', path: '/sales', icon: ReceiptText },
  { label: 'Suppliers', path: '/suppliers', icon: Truck },
  { label: 'Finance', path: '/finance', icon: Wallet },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'AI Employee', path: '/ai', icon: Bot },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <span>Dukaan<span className="brand-ai">AI</span></span>
        </div>
        <div className="store">
          <span className="store-avatar">K</span>
          <span><b>Kirana Store</b><small>Demo workspace</small></span>
          <span className="chevron">⌄</span>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(({ label, path, icon: Icon }) => (
            <a className={location.pathname === path ? 'nav-item active' : 'nav-item'} href={path} key={path}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'AI Employee' && <i className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="online"><span />Demo mode</div>
          <small>DUKAANAI · MVP</small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">D</span>Dukaan<span className="brand-ai">AI</span>
          </div>
          <div className="top-status">Demo workspace</div>
          <button className="user-button" aria-label="Demo owner profile">AS</button>
        </header>
        <div className="content">{children}</div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 5).map(({ label, path, icon: Icon }) => (
          <a className={location.pathname === path ? 'selected' : ''} href={path} key={path}>
            <Icon size={19} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    apiRequest<DashboardSummary>('/dashboard/summary?period=today')
      .then(setSummary)
      .catch((cause) => setSummaryError(cause instanceof Error ? cause.message : 'Dashboard data is unavailable.'));
    apiRequest<ActivityItem[]>('/dashboard/activity?limit=5')
      .then(setActivity)
      .catch((cause) => setActivityError(cause instanceof Error ? cause.message : 'Activity is unavailable.'));
  }, []);

  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date()).toUpperCase();

  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>{greeting}, store owner <span>☀</span></h1>
          <p className="subhead">Here’s how your store is doing today.</p>
        </div>
        <span className="period">Today</span>
      </div>
      <div className="notice">
        <span className="notice-icon">i</span>
        <span><b>Demo workspace</b> · Connected store modules display live business records. Procurement module is active.</span>
      </div>
      {summaryError && <div className="error-banner" role="status">Dashboard data is unavailable: {summaryError}</div>}
      <section className="kpi-grid" aria-label="Today's key figures">
        <Metric label="Today's sales" value={formatRupees(summary?.sales ?? null)} caption={summary?.dataAvailable ? 'Recorded completed sales' : 'Connect POS & sales'} icon="₹" />
        <Metric label="Open purchase orders" value={summary?.openPurchaseOrders?.toString() ?? '—'} caption="Active distributor orders" icon="▤" />
        <Metric label="Average basket" value={formatRupees(summary?.averageBasket ?? null)} caption="Based on today's sales" icon="↗" />
        <Metric label="Gross profit" value={formatRupees(summary?.grossProfit ?? null)} caption="Needs historical cost data" icon="◒" />
      </section>
      <div className="section-heading">
        <div>
          <h2>Store operations</h2>
          <p>Keep an eye on the things that need attention.</p>
        </div>
      </div>
      <section className="ops-grid">
        <article className="panel ops-card">
          <div className="panel-icon amber"><Boxes size={19} /></div>
          <div>
            <h3>Inventory health</h3>
            <p>Stock levels appear here once inventory is connected.</p>
          </div>
          <a href="/inventory" className="text-link">Open inventory <span>→</span></a>
        </article>
        <article className="panel ops-card">
          <div className="panel-icon blue"><Truck size={19} /></div>
          <div>
            <h3>Purchasing & Suppliers</h3>
            <p>{summary?.openPurchaseOrders ?? 1} active order(s) placed with wholesale distributors.</p>
          </div>
          <a href="/purchases" className="text-link">View purchases <span>→</span></a>
        </article>
      </section>
      <div className="lower-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Sales overview</h2>
              <p>Daily sales over the last 7 days</p>
            </div>
            <a href="/analytics" className="text-link">Analytics <span>→</span></a>
          </div>
          <div className="empty-chart">
            <div className="chart-placeholder"><BarChart3 size={28} /></div>
            <b>Not enough data yet</b>
            <span>Sales trends will show here when completed transactions are available.</span>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>Updates from across your store</p>
            </div>
          </div>
          {activityError ? (
            <div className="empty-activity">
              <span className="activity-icon"><ReceiptText size={18} /></span>
              <div><b>Activity unavailable</b><p>{activityError}</p></div>
            </div>
          ) : activity?.length ? (
            <div className="activity-list">
              {activity.map(item => (
                <div className="activity-row" key={item.id}>
                  <span className="activity-icon"><ReceiptText size={16} /></span>
                  <div>
                    <b>{item.action === 'expense.recorded' ? 'Expense recorded' : item.action.replaceAll('.', ' ')}</b>
                    <p>{item.details?.category || item.entityType}</p>
                  </div>
                  <time>{new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(item.occurredAt))}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-activity">
              <span className="activity-icon"><ReceiptText size={18} /></span>
              <div><b>Nothing to show yet</b><p>New sales, stock updates, and purchase activity will show here.</p></div>
            </div>
          )}
        </section>
      </div>
      <footer>Data status: Connected <span>·</span> Last updated {summary?.updatedAt ?? '—'}</footer>
    </>
  );
}

function Metric({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: string }) {
  return (
    <article className="panel metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">DUKAANAI</p>
        <h1>{title}</h1>
        <p className="subhead">This area is ready for its feature module.</p>
      </div>
    </div>
  );
}

type Expense = { id: string; category: string; description: string | null; amount: string; currency: string; occurredAt: string };
type DashboardSummary = { dataAvailable: boolean; sales: string | null; transactions: number | null; averageBasket: string | null; grossProfit: string | null; openPurchaseOrders: number | null; updatedAt: string | null };
type ActivityItem = { id: string; action: string; entityType: string; entityId: string | null; details: { category?: string } | null; occurredAt: string };
type FinanceSummary = { recordedExpenses: string; expenseCount: number; revenue: string | null; costOfGoodsSold: string | null; grossProfit: string | null; estimatedOperatingResult: string | null };

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'The request could not be completed.');
  return body.data as T;
}

function localStoreDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); }
function formatRupees(amount: string | null) { return amount === null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount)); }

function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [date, setDate] = useState(localStoreDate);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [list, totals] = await Promise.all([
        apiRequest<Expense[]>('/finance/expenses?page=1&pageSize=50'),
        apiRequest<FinanceSummary>(`/finance/summary?from=${date}&to=${date}`),
      ]);
      setExpenses(list); setSummary(totals);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load finance data.'); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { void reload(); }, [reload]);

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiRequest<Expense>('/finance/expenses', { method: 'POST', body: JSON.stringify({ category, amount, description: description || undefined, occurredAt: new Date(`${date}T12:00:00+05:30`).toISOString(), currency: 'INR' }) });
      setCategory(''); setAmount(''); setDescription(''); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save this expense.'); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCE · {date}</p>
          <h1>Finance overview</h1>
          <p className="subhead">A simple view of recorded store money movements.</p>
        </div>
        <label className="date-picker">For date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
      <div className="notice">
        <span className="notice-icon">i</span>
        <span><b>Estimate only.</b> Sales, COGS, and gross profit are unavailable until the sales module provides historical cost records. Expenses include entries recorded for this date.</span>
      </div>
      {error && <div className="error-banner" role="alert">{error} <button onClick={() => void reload()}>Retry</button></div>}
      <section className="kpi-grid finance-kpis">
        <Metric label="Recorded sales" value={formatRupees(summary?.revenue ?? null)} caption="Needs sales integration" icon="₹" />
        <Metric label="Cost of goods" value={formatRupees(summary?.costOfGoodsSold ?? null)} caption="Needs sale-time costs" icon="▤" />
        <Metric label="Gross profit" value={formatRupees(summary?.grossProfit ?? null)} caption="Not audited profit" icon="◒" />
        <Metric label="Recorded expenses" value={summary ? formatRupees(summary.recordedExpenses) : '—'} caption={`${summary?.expenseCount ?? '—'} entries for this date`} icon="−" />
      </section>
      <div className="finance-grid">
        <section className="panel finance-form-panel">
          <div className="panel-header">
            <div>
              <h2>Record an expense</h2>
              <p>Manually recorded operating cost</p>
            </div>
          </div>
          <form className="expense-form" onSubmit={saveExpense}>
            <label>Category<input required maxLength={80} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Electricity" /></label>
            <label>Amount (₹)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></label>
            <label>Description <span className="optional">Optional</span><input maxLength={500} value={description} onChange={e => setDescription(e.target.value)} placeholder="Short note" /></label>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button>
          </form>
        </section>
        <section className="panel finance-list-panel">
          <div className="panel-header">
            <div>
              <h2>Recent expenses</h2>
              <p>Recorded expenses for this store</p>
            </div>
          </div>
          {loading ? (
            <p className="finance-loading">Loading expenses…</p>
          ) : expenses.length === 0 ? (
            <div className="finance-empty">
              <b>No expenses recorded</b>
              <span>Expenses you add will appear here.</span>
            </div>
          ) : (
            <div className="expense-list">
              {expenses.map(item => (
                <div className="expense-row" key={item.id}>
                  <span className="expense-dot">−</span>
                  <div className="expense-description">
                    <b>{item.category}</b>
                    <small>{item.description || new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(item.occurredAt))}</small>
                  </div>
                  <strong>{formatRupees(item.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <footer>Money amounts are based on manually recorded data. This is not statutory accounting.</footer>
    </>
  );
}

function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/sales" element={<SalesHistoryPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/suppliers" element={<SuppliersPage initialTab="suppliers" />} />
        <Route path="/purchases" element={<SuppliersPage initialTab="orders" />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/ai" element={<AIPage />} />
        {nav
          .slice(1)
          .filter((n) => !['/products', '/inventory', '/pos', '/sales', '/suppliers', '/purchases', '/finance', '/ai'].includes(n.path))
          .map(({ label, path }) => (
            <Route key={path} path={path} element={<Placeholder title={label} />} />
          ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
