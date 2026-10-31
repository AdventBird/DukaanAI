import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalServer, state, getCatalogue } from '../src/server.js';
import { EventEmitter } from 'node:events';

test('Mock Distributor Portal - Catalogue & Scenario Toggles', () => {
  // 1. Initial normal catalogue check
  state.activeScenario = 'NORMAL';
  const catNormal = getCatalogue('sup_metro');
  const biscuitNormal = catNormal.find(p => p.sku === 'METRO-PARLE-G-250')!;
  assert.equal(biscuitNormal.pricePerPack, 216);
  assert.equal(biscuitNormal.isAvailable, true);

  // 2. Scenario Toggle: Price hike increases price from 216 to 240
  state.activeScenario = 'PRICE_HIKE';
  const catHike = getCatalogue('sup_metro');
  const biscuitHike = catHike.find(p => p.sku === 'METRO-PARLE-G-250')!;
  assert.equal(biscuitHike.pricePerPack, 240);

  // 3. Scenario Toggle: Stock shortage marks item out of stock
  state.activeScenario = 'SHORTAGE';
  const catShortage = getCatalogue('sup_metro');
  const biscuitShortage = catShortage.find(p => p.sku === 'METRO-PARLE-G-250')!;
  assert.equal(biscuitShortage.isAvailable, false);
  assert.equal(biscuitShortage.availablePacks, 0);
});

test('Mock Distributor Portal - In-memory HTTP Request Handling', async () => {
  const server = createPortalServer();
  state.activeScenario = 'NORMAL';

  // Helper to simulate HTTP requests without opening restricted TCP sockets
  async function simulateRequest(method: string, url: string, bodyObj?: any) {
    return new Promise<{ status: number; headers: Record<string, any>; body: string }>((resolve) => {
      const req = new EventEmitter() as any;
      req.method = method;
      req.url = url;
      req.headers = { host: 'localhost' };

      const res = new EventEmitter() as any;
      let status = 200;
      const headers: Record<string, any> = {};
      let responseBody = '';

      res.writeHead = (s: number, h?: any) => {
        status = s;
        if (h) Object.assign(headers, h);
      };
      res.setHeader = (k: string, v: any) => {
        headers[k.toLowerCase()] = v;
      };
      res.end = (chunk?: any) => {
        if (chunk) responseBody += chunk;
        resolve({ status, headers, body: responseBody });
      };

      // Emit to server listener
      server.emit('request', req, res);

      if (bodyObj) {
        req.emit('data', JSON.stringify(bodyObj));
      }
      req.emit('end');
    });
  }

  // 1. Test Catalogue API
  const catRes = await simulateRequest('GET', '/api/catalogue?supplierId=sup_metro');
  assert.equal(catRes.status, 200);
  const catData = JSON.parse(catRes.body);
  assert.equal(catData.supplierId, 'sup_metro');
  assert.ok(catData.catalogue.length >= 3);

  // 2. Test Login API
  const loginRes = await simulateRequest('POST', '/api/login', {
    username: 'metro_partner',
    password: 'demo_password123',
  });
  assert.equal(loginRes.status, 200);
  const loginData = JSON.parse(loginRes.body);
  assert.ok(loginData.token);
  assert.equal(loginData.supplier.id, 'sup_metro');

  // 3. Test Order Submission API
  const orderRes = await simulateRequest('POST', '/api/orders', {
    poNumber: 'PO-2026-TEST',
    supplierId: 'sup_metro',
    items: [{ sku: 'METRO-OIL-1L-CASE', name: 'Fortune Oil', packs: 2, unitPrice: 1440, total: 2880 }],
    totalAmount: 2880,
  });
  assert.equal(orderRes.status, 201);
  const orderData = JSON.parse(orderRes.body);
  assert.ok(orderData.orderReference.startsWith('DIST-ORD-'));
  assert.equal(orderData.status, 'ACKNOWLEDGED');

  // 4. Test Order Status Query
  const statusRes = await simulateRequest('GET', `/api/orders/${orderData.orderReference}`);
  assert.equal(statusRes.status, 200);
  const statusData = JSON.parse(statusRes.body);
  assert.equal(statusData.status, 'ACKNOWLEDGED');
  assert.equal(statusData.poNumber, 'PO-2026-TEST');
});
