import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware, assertSupabaseAuthConfigured, ownerOnly } from '../src/auth.middleware.js';

function invoke(middleware: any, headers: Record<string, string> = {}) {
  let statusCode = 200;
  let body: any;
  let nextCalled = false;
  const req = { header: (key: string) => headers[key.toLowerCase()] };
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  };
  const next = () => { nextCalled = true; };
  return Promise.resolve(middleware(req, res, next)).then(() => ({ req, statusCode, body, nextCalled }));
}

test('auth rejects missing credentials when demo mode is not explicitly enabled', async () => {
  const result = await invoke(createAuthMiddleware({ prisma: {} as any, authMode: 'off' }));
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('demo identity is assigned only for explicit AUTH_MODE=demo', async () => {
  const result = await invoke(createAuthMiddleware({ prisma: {} as any, authMode: 'demo' }));
  assert.equal(result.nextCalled, true);
  assert.deepEqual((result.req as any).auth, { userId: 'demo-owner', storeId: 'demo-store', role: 'OWNER' });
});

test('Supabase verified identity resolves store and role from membership, ignoring client claims', async () => {
  let query: any;
  const middleware = createAuthMiddleware({
    prisma: { user: { findMany: async (args: unknown) => { query = args; return [{ id: 'member-1', storeId: 'store-a', role: 'CASHIER' }]; } } } as any,
    authMode: 'off', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-test-key',
    fetcher: async (_url, options) => {
      assert.equal((options?.headers as any).Authorization, 'Bearer valid-test-token');
      return new Response(JSON.stringify({ id: 'auth-subject-a' }), { status: 200 });
    },
  });
  const result = await invoke(middleware, {
    authorization: 'Bearer valid-test-token',
    'x-store-id': 'store-a',
    'x-user-role': 'OWNER',
  });
  assert.equal(result.nextCalled, true);
  assert.deepEqual((result.req as any).auth, { userId: 'member-1', storeId: 'store-a', role: 'CASHIER' });
  assert.deepEqual(query.where, { authSubject: 'auth-subject-a', storeId: 'store-a' });
  assert.equal(query.take, 2);
});

test('invalid Supabase token is rejected', async () => {
  const middleware = createAuthMiddleware({
    prisma: {} as any, authMode: 'off', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-test-key',
    fetcher: async () => new Response('{}', { status: 401 }),
  });
  const result = await invoke(middleware, { authorization: 'Bearer invalid-token' });
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('missing store membership is denied', async () => {
  const middleware = createAuthMiddleware({
    prisma: { user: { findMany: async () => [] } } as any,
    authMode: 'off', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-test-key',
    fetcher: async () => new Response(JSON.stringify({ id: 'auth-subject-a' }), { status: 200 }),
  });
  const result = await invoke(middleware, { authorization: 'Bearer valid-test-token' });
  assert.equal(result.statusCode, 403);
  assert.equal(result.nextCalled, false);
});

test('multiple memberships require a selection; selected store is still membership-checked', async () => {
  const middleware = createAuthMiddleware({
    prisma: { user: { findMany: async (args: any) => args.where.storeId
      ? [{ id: `member-${args.where.storeId.slice(-1)}`, storeId: args.where.storeId, role: args.where.storeId === 'store-a' ? 'OWNER' : 'CASHIER' }]
      : [{ id: 'member-a', storeId: 'store-a', role: 'OWNER' }, { id: 'member-b', storeId: 'store-b', role: 'CASHIER' }] } } as any,
    authMode: 'off', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-test-key',
    fetcher: async () => new Response(JSON.stringify({ id: 'auth-subject-a' }), { status: 200 }),
  });
  const needsChoice = await invoke(middleware, { authorization: 'Bearer valid-test-token' });
  assert.equal(needsChoice.statusCode, 409);
  assert.equal((needsChoice.body as any).error.code, 'STORE_SELECTION_REQUIRED');

  const selected = await invoke(middleware, { authorization: 'Bearer valid-test-token', 'x-store-id': 'store-b' });
  assert.equal(selected.nextCalled, true);
  assert.deepEqual((selected.req as any).auth, { userId: 'member-b', storeId: 'store-b', role: 'CASHIER' });
});

test('owner-only guard blocks a cashier', () => {
  let statusCode = 200;
  let nextCalled = false;
  const req = { auth: { role: 'CASHIER' } };
  const res = { status(code: number) { statusCode = code; return this; }, json() { return this; } };
  ownerOnly(req as any, res as any, () => { nextCalled = true; });
  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
});

test('Supabase server configuration is required outside demo mode', () => {
  assert.throws(() => assertSupabaseAuthConfigured({ AUTH_MODE: 'off' } as NodeJS.ProcessEnv), /DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY/);
  assert.doesNotThrow(() => assertSupabaseAuthConfigured({ AUTH_MODE: 'demo', DATABASE_URL: 'postgresql://test' } as NodeJS.ProcessEnv));
});
