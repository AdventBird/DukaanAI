import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Boxes, ReceiptText, Truck, Wallet, Bot, BarChart3, Wifi } from 'lucide-react';
import './styles.css';

const nav = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard }, { label: 'POS', path: '/pos', icon: ShoppingCart },
  { label: 'Products', path: '/products', icon: Package }, { label: 'Inventory', path: '/inventory', icon: Boxes },
  { label: 'Sales', path: '/sales', icon: ReceiptText }, { label: 'Suppliers', path: '/suppliers', icon: Truck },
  { label: 'Finance', path: '/finance', icon: Wallet }, { label: 'Analytics', path: '/analytics', icon: BarChart3 }, { label: 'AI Employee', path: '/ai', icon: Bot },
];

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="app"><aside className="sidebar"><div className="brand"><span className="brand-mark">D</span><span>Dukaan<span className="brand-ai">AI</span></span></div><div className="store"><span className="store-avatar">K</span><span><b>Kirana Store</b><small>Demo workspace</small></span><span className="chevron">⌄</span></div><nav aria-label="Main navigation">{nav.map(({ label, path, icon: Icon }) => <a className={location.pathname === path ? 'nav-item active' : 'nav-item'} href={path} key={path}><Icon size={19} strokeWidth={1.8}/><span>{label}</span>{label === 'AI Employee' && <i className="nav-dot"/>}</a>)}</nav><div className="sidebar-bottom"><div className="online"><span/>Online · Demo mode</div><small>DUKAANAI · MVP</small></div></aside><main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark">D</span>Dukaan<span className="brand-ai">AI</span></div><div className="top-status"><Wifi size={16}/> Online <span className="status-separator">·</span> Demo workspace</div><button className="user-button" aria-label="Demo owner profile">AS</button></header><div className="content">{children}</div></main><nav className="mobile-nav" aria-label="Mobile navigation">{nav.slice(0,5).map(({label,path,icon:Icon})=><a className={location.pathname===path?'selected':''} href={path} key={path}><Icon size={19}/><span>{label}</span></a>)}</nav></div>;
}

function Dashboard() {
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date()).toUpperCase();
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return <><div className="page-heading"><div><p className="eyebrow">{today}</p><h1>{greeting}, store owner <span>☀</span></h1><p className="subhead">Here’s how your store is doing today.</p></div><button className="period">Today <span>⌄</span></button></div>
    <div className="notice"><span className="notice-icon">i</span><span><b>Demo workspace</b> · Connect your store modules to see live business data. No sales or stock figures are being estimated.</span></div>
    <section className="kpi-grid" aria-label="Today's key figures"><Metric label="Today's sales" value="—" caption="Connect POS & sales" icon="₹"/><Metric label="Transactions" value="—" caption="Completed sales today" icon="▤"/><Metric label="Average basket" value="—" caption="Based on today's sales" icon="↗"/><Metric label="Gross profit" value="—" caption="Needs historical cost data" icon="◒"/></section>
    <div className="section-heading"><div><h2>Store operations</h2><p>Keep an eye on the things that need attention.</p></div></div>
    <section className="ops-grid"><article className="panel ops-card"><div className="panel-icon amber"><Boxes size={19}/></div><div><h3>Inventory health</h3><p>Stock levels appear here once inventory is connected.</p></div><a href="/inventory" className="text-link">Open inventory <span>→</span></a></article><article className="panel ops-card"><div className="panel-icon blue"><Truck size={19}/></div><div><h3>Purchasing</h3><p>Orders and deliveries will appear here once procurement is connected.</p></div><a href="/purchases" className="text-link">View purchases <span>→</span></a></article></section>
    <div className="lower-grid"><section className="panel chart-panel"><div className="panel-header"><div><h2>Sales overview</h2><p>Daily sales over the last 7 days</p></div><a href="/analytics" className="text-link">Analytics <span>→</span></a></div><div className="empty-chart"><div className="chart-placeholder"><BarChart3 size={28}/></div><b>Not enough data yet</b><span>Sales trends will show here when completed transactions are available.</span></div></section><section className="panel activity-panel"><div className="panel-header"><div><h2>Recent activity</h2><p>Updates from across your store</p></div></div><div className="empty-activity"><span className="activity-icon"><ReceiptText size={18}/></span><div><b>Nothing to show yet</b><p>New sales, stock updates, and purchase activity will show here.</p></div></div></section></div>
    <footer>Data status: waiting for module connections <span>·</span> Last updated —</footer></>;
}
function Metric({label,value,caption,icon}:{label:string;value:string;caption:string;icon:string}) { return <article className="panel metric"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{caption}</small></article>; }
function Placeholder({ title }: {title:string}) { return <div className="page-heading"><div><p className="eyebrow">DUKAANAI</p><h1>{title}</h1><p className="subhead">This area is ready for its feature module.</p></div></div>; }
function App() { return <Shell><Routes><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<Dashboard/>}/>{nav.slice(1).map(({label,path})=><Route key={path} path={path} element={<Placeholder title={label}/>}/>) }<Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes></Shell>; }

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
