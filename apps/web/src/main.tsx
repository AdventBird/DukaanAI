import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Boxes, ReceiptText, Truck, Wallet, Bot, BarChart3 } from 'lucide-react';
import './styles.css';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { ProductsPage } from './features/products/ProductsPage.js';
import { InventoryPage } from './features/inventory/InventoryPage.js';
import { SuppliersPage } from './features/suppliers/SuppliersPage.js';
import { POSPage } from './features/pos/POSPage.js';
import { SalesPage } from './features/sales/SalesPage.js';
import { AnalyticsPage } from './features/analytics/AnalyticsPage.js';
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
  return <DashboardPage />;
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
type DashboardSummary = {
  dataAvailable: boolean;
  sales: string | null;
  transactions: number | null;
  averageBasket: string | null;
  grossProfit: string | null;
  lowStockCount: number | null;
  totalProducts: number | null;
  openPurchaseOrders: number | null;
  updatedAt: string | null;
};
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
        <span><b>Live Store Ledger</b> · Recorded sales, COGS, and gross profit are calculated from live point-of-sale bills and item-level cost snapshots. Expenses include entries recorded for this date.</span>
      </div>
      {error && <div className="error-banner" role="alert">{error} <button onClick={() => void reload()}>Retry</button></div>}
      <section className="kpi-grid finance-kpis">
        <Metric label="Recorded sales" value={formatRupees(summary?.revenue ?? null)} caption={summary?.revenue !== null ? 'From completed POS bills' : 'No sales for this date'} icon="₹" />
        <Metric label="Cost of goods" value={formatRupees(summary?.costOfGoodsSold ?? null)} caption={summary?.costOfGoodsSold !== null ? 'Wholesale cost basis' : 'Needs cost data'} icon="▤" />
        <Metric label="Gross profit" value={formatRupees(summary?.grossProfit ?? null)} caption={summary?.grossProfit !== null ? 'Sales minus COGS' : 'Not audited profit'} icon="◒" />
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/suppliers" element={<SuppliersPage initialTab="suppliers" />} />
        <Route path="/purchases" element={<SuppliersPage initialTab="orders" />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/ai" element={<AIPage />} />
        {nav
          .slice(1)
          .filter((n) => !['/pos', '/products', '/inventory', '/sales', '/suppliers', '/purchases', '/finance', '/analytics', '/ai'].includes(n.path))
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
