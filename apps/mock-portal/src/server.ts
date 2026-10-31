import http from 'node:http';
import { parse as parseUrl } from 'node:url';

export interface PortalSupplier {
  id: string;
  name: string;
  username: string;
  passwordHash: string; // Plaintext demo password
  leadTimeDays: number;
}

export interface PortalProduct {
  sku: string;
  name: string;
  category: string;
  packLabel: string;
  unitsPerPack: number;
  pricePerPack: number;
  availablePacks: number;
  moqPacks: number;
  isAvailable: boolean;
}

export interface PortalOrder {
  orderReference: string;
  poNumber: string;
  supplierId: string;
  submittedAt: string;
  status: 'ACKNOWLEDGED' | 'PACKED' | 'DISPATCHED' | 'DELIVERED';
  items: Array<{ sku: string; name: string; packs: number; unitPrice: number; total: number }>;
  totalAmount: number;
}

// In-memory state for mock portal
export const state = {
  activeScenario: 'NORMAL', // 'NORMAL' | 'PRICE_HIKE' | 'SHORTAGE'
  orders: new Map<string, PortalOrder>(),
  sessions: new Set<string>(), // Active auth tokens
};

export const suppliers: PortalSupplier[] = [
  {
    id: 'sup_metro',
    name: 'Metro Cash & Carry Partner Portal',
    username: 'metro_partner',
    passwordHash: 'demo_password123',
    leadTimeDays: 2,
  },
  {
    id: 'sup_anand',
    name: 'Anand Agencies FMCG B2B',
    username: 'anand_wholesaler',
    passwordHash: 'anand_demo456',
    leadTimeDays: 1,
  },
];

export function getCatalogue(supplierId: string): PortalProduct[] {
  if (supplierId === 'sup_metro') {
    const biscuitPrice = state.activeScenario === 'PRICE_HIKE' ? 240.00 : 216.00;
    const biscuitAvailable = state.activeScenario !== 'SHORTAGE';

    return [
      {
        sku: 'METRO-PARLE-G-250',
        name: 'Parle-G Biscuit 250g',
        category: 'Biscuits & Snacks',
        packLabel: 'carton',
        unitsPerPack: 24,
        pricePerPack: biscuitPrice,
        availablePacks: biscuitAvailable ? 50 : 0,
        moqPacks: 2,
        isAvailable: biscuitAvailable,
      },
      {
        sku: 'METRO-OIL-1L-CASE',
        name: 'Fortune Sunlite Sunflower Oil 1L',
        category: 'Edible Oils',
        packLabel: 'carton',
        unitsPerPack: 12,
        pricePerPack: 1440.00,
        availablePacks: 30,
        moqPacks: 1,
        isAvailable: true,
      },
      {
        sku: 'METRO-SALT-25KG-BAG',
        name: 'Tata Salt 1kg Bag (25 units)',
        category: 'Staples',
        packLabel: 'bag',
        unitsPerPack: 25,
        pricePerPack: 500.00,
        availablePacks: 40,
        moqPacks: 1,
        isAvailable: true,
      },
    ];
  }

  // Anand Agencies
  return [
    {
      sku: 'ANAND-PARLE-BX',
      name: 'Parle-G Biscuit 250g',
      category: 'Biscuits & Snacks',
      packLabel: 'box',
      unitsPerPack: 12,
      pricePerPack: 114.00,
      availablePacks: 100,
      moqPacks: 3,
      isAvailable: true,
    },
    {
      sku: 'ANAND-ATTA-5KG-BALE',
      name: 'Aashirvaad Shudh Chakki Atta 5kg',
      category: 'Flour & Grains',
      packLabel: 'bale',
      unitsPerPack: 8,
      pricePerPack: 1920.00,
      availablePacks: 25,
      moqPacks: 1,
      isAvailable: true,
    },
  ];
}

function renderHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · DukaanAI Distributor Portal</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    h1 { font-size: 1.4rem; font-weight: 700; color: #fff; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-normal { background: #064e3b; color: #6ee7b7; }
    .badge-alert { background: #7f1d1d; color: #fca5a5; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 6px; color: var(--text-muted); }
    input, select, button {
      width: 100%;
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #0b1329;
      color: #fff;
      font-size: 0.95rem;
      margin-bottom: 14px;
    }
    button.btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    button.btn-primary:hover { background: var(--primary-hover); }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }
    th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    .sim-bar {
      background: #1e1e38;
      border: 1px dashed #6366f1;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sim-buttons { display: flex; gap: 8px; }
    .sim-buttons button { margin-bottom: 0; width: auto; font-size: 0.8rem; padding: 6px 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <div class="sim-bar">
      <div>
        <strong>🎭 Hackathon Demo Scenario Control:</strong>
        <span class="badge ${state.activeScenario === 'NORMAL' ? 'badge-normal' : 'badge-alert'}">${state.activeScenario}</span>
        <small style="display:block; color:#94a3b8; font-size:0.75rem;">Changes catalogue prices & availability for Dev 4 agent comparison testing.</small>
      </div>
      <div class="sim-buttons">
        <form method="POST" action="/scenario/set?mode=NORMAL"><button type="submit">Normal</button></form>
        <form method="POST" action="/scenario/set?mode=PRICE_HIKE"><button type="submit" style="background:#b45309; border-color:#b45309;">Price Hike (+11%)</button></form>
        <form method="POST" action="/scenario/set?mode=SHORTAGE"><button type="submit" style="background:#b91c1c; border-color:#b91c1c;">Stock Shortage</button></form>
      </div>
    </div>
    ${bodyContent}
  </div>
</body>
</html>`;
}

export function createPortalServer() {
  return http.createServer((req, res) => {
    const parsed = parseUrl(req.url ?? '/', true);
    const pathname = parsed.pathname ?? '/';

    // CORS for API clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // JSON API: Scenario control
    if (pathname === '/api/scenario' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ activeScenario: state.activeScenario }));
      return;
    }

    if (pathname === '/scenario/set' && req.method === 'POST') {
      const mode = (parsed.query.mode as string) || 'NORMAL';
      state.activeScenario = ['NORMAL', 'PRICE_HIKE', 'SHORTAGE'].includes(mode) ? mode : 'NORMAL';
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    // JSON API: Login
    if (pathname === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body);
          const found = suppliers.find(s => s.username === username && s.passwordHash === password);
          if (!found) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid distributor credentials' }));
            return;
          }
          const token = `token_${found.id}_${Date.now()}`;
          state.sessions.add(token);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, supplier: { id: found.id, name: found.name, leadTimeDays: found.leadTimeDays } }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON' }));
        }
      });
      return;
    }

    // JSON API: Catalogue
    if (pathname === '/api/catalogue' && req.method === 'GET') {
      const supplierId = (parsed.query.supplierId as string) || 'sup_metro';
      const catalogue = getCatalogue(supplierId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ supplierId, catalogue }));
      return;
    }

    // JSON API: Submit Purchase Order
    if (pathname === '/api/orders' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const ref = `DIST-ORD-${Date.now().toString().slice(-6)}`;
          const order: PortalOrder = {
            orderReference: ref,
            poNumber: data.poNumber || 'PO-ONLINE',
            supplierId: data.supplierId || 'sup_metro',
            submittedAt: new Date().toISOString(),
            status: 'ACKNOWLEDGED',
            items: data.items || [],
            totalAmount: data.totalAmount || 0,
          };
          state.orders.set(ref, order);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ orderReference: ref, status: order.status, acknowledgedAt: order.submittedAt }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid order payload' }));
        }
      });
      return;
    }

    // JSON API: Order Status
    if (pathname.startsWith('/api/orders/') && req.method === 'GET') {
      const ref = pathname.replace('/api/orders/', '');
      const order = state.orders.get(ref);
      if (!order) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Distributor order not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(order));
      return;
    }

    // ==========================================
    // HTML Portal Screens for Dev 4 Browser Agent
    // ==========================================
    if (pathname === '/' || pathname === '/login') {
      const html = renderHtml('Supplier Login', `
        <header>
          <h1>Distributor Partner B2B Portal</h1>
          <span style="color:#94a3b8;">DukaanAI Local Integration</span>
        </header>
        <div class="card" data-testid="supplier-login">
          <h2 style="font-size:1.1rem; margin-bottom:12px;">Sign In to Distributor Account</h2>
          <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:16px;">
            Demo Credentials:<br>
            • Metro Cash: <code>metro_partner</code> / <code>demo_password123</code><br>
            • Anand Agencies: <code>anand_wholesaler</code> / <code>anand_demo456</code>
          </p>
          <form method="POST" action="/do-login">
            <label>Distributor Username</label>
            <input type="text" name="username" value="metro_partner" data-testid="supplier-username" required />
            <label>Password</label>
            <input type="password" name="password" value="demo_password123" data-testid="supplier-password" required />
            <button type="submit" class="btn-primary" data-testid="supplier-login-submit">Login to Partner Portal</button>
          </form>
        </div>
      `);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (pathname === '/do-login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const username = params.get('username') || '';
        const supplier = suppliers.find(s => s.username === username) || suppliers[0];
        res.writeHead(302, { Location: `/dashboard?supplierId=${supplier.id}` });
        res.end();
      });
      return;
    }

    if (pathname === '/dashboard') {
      const supplierId = (parsed.query.supplierId as string) || 'sup_metro';
      const supplier = suppliers.find(s => s.id === supplierId) || suppliers[0];
      const catalogue = getCatalogue(supplierId);

      const rows = catalogue.map(p => `
        <tr data-testid="quote-request-table">
          <td><strong>${p.name}</strong><br><small style="color:#94a3b8;">${p.sku}</small></td>
          <td>${p.packLabel} (${p.unitsPerPack} units)</td>
          <td data-testid="quote-unit-price"><strong>₹${p.pricePerPack.toFixed(2)}</strong></td>
          <td>${p.moqPacks} ${p.packLabel}</td>
          <td data-testid="quote-availability">
            <span class="badge ${p.isAvailable ? 'badge-normal' : 'badge-alert'}">
              ${p.isAvailable ? `In Stock (${p.availablePacks})` : 'OUT OF STOCK'}
            </span>
          </td>
        </tr>
      `).join('');

      const html = renderHtml(`${supplier.name}`, `
        <header>
          <div>
            <h1>${supplier.name}</h1>
            <small style="color:#94a3b8;">Lead Time: ~${supplier.leadTimeDays} days · Standard Kirana Terms</small>
          </div>
          <div><a href="/login" style="color:#60a5fa; font-size:0.85rem;">Sign Out</a></div>
        </header>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h2 style="font-size:1.1rem;">B2B Wholesale Catalogue & Live Quotes</h2>
            <input type="text" placeholder="Search catalogue..." style="width:250px; margin-bottom:0;" data-testid="catalogue-search" />
          </div>
          <table>
            <thead>
              <tr>
                <th>Product & SKU</th>
                <th>Pack Size</th>
                <th>Quote (per pack)</th>
                <th>MOQ</th>
                <th>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2 style="font-size:1.1rem; margin-bottom:12px;">Direct Purchase Order Submission</h2>
          <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:16px;">
            Owner-approved purchase orders submitted here are immediately acknowledged with an official distributor reference.
          </p>
          <form method="POST" action="/submit-po">
            <input type="hidden" name="supplierId" value="${supplier.id}" />
            <label>Store Purchase Order Number / Snapshot Reference</label>
            <input type="text" name="poReference" placeholder="e.g. PO-2026-1001" data-testid="purchase-order-reference" required />
            <label>Item Lines & Notes</label>
            <input type="text" name="notes" placeholder="e.g. 2 cartons Fortune Sunflower Oil" />
            <button type="submit" class="btn-primary" data-testid="purchase-order-submit">Submit Approved Order</button>
          </form>
        </div>
      `);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (pathname === '/submit-po' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const poRef = params.get('poReference') || 'PO-2026-UNKNOWN';
        const supplierId = params.get('supplierId') || 'sup_metro';
        const orderRef = `DIST-ORD-${Date.now().toString().slice(-6)}`;

        state.orders.set(orderRef, {
          orderReference: orderRef,
          poNumber: poRef,
          supplierId,
          submittedAt: new Date().toISOString(),
          status: 'ACKNOWLEDGED',
          items: [],
          totalAmount: 0,
        });

        res.writeHead(302, { Location: `/order-confirmation?ref=${orderRef}` });
        res.end();
      });
      return;
    }

    if (pathname === '/order-confirmation') {
      const ref = (parsed.query.ref as string) || '';
      const order = state.orders.get(ref);

      const html = renderHtml('Order Acknowledged', `
        <header>
          <h1>Order Acknowledged by Distributor</h1>
        </header>
        <div class="card" style="text-align:center; padding:32px;">
          <div style="color:#10b981; font-size:2rem; margin-bottom:10px;">✔</div>
          <h2 style="font-size:1.3rem; margin-bottom:8px;">Order Successfully Placed</h2>
          <p style="color:#94a3b8; margin-bottom:20px;">
            Distributor Order Reference: <strong style="color:#fff;" id="order-ref">${ref}</strong>
          </p>
          <div style="display:inline-block; margin-bottom:24px;">
            <span class="badge badge-normal" data-testid="order-status" style="font-size:0.9rem; padding:6px 14px;">
              ${order?.status || 'ACKNOWLEDGED'}
            </span>
          </div>
          <p style="font-size:0.85rem; color:#94a3b8;">
            Estimated Delivery: Within standard distributor lead time (~2 business days).<br>
            Please provide this reference to DukaanAI to track goods receipt.
          </p>
          <div style="margin-top:24px;">
            <a href="/dashboard" style="color:#60a5fa;">Back to Distributor Dashboard</a>
          </div>
        </div>
      `);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 Not Found</h1>');
  });
}

// Start server if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  const port = Number(process.env.MOCK_PORTAL_PORT || 3002);
  const server = createPortalServer();
  server.listen(port, () => {
    console.log(`Mock Distributor Portal running at http://localhost:${port}`);
  });
}
