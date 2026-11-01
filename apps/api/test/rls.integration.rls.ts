import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.RLS_TEST_DATABASE_URL;
const storeA = process.env.RLS_TEST_STORE_A_ID;
const storeB = process.env.RLS_TEST_STORE_B_ID;
const subjectA = process.env.RLS_TEST_SUBJECT_A;

if (!databaseUrl || !storeA || !storeB || !subjectA) {
  throw new Error(
    'RLS integration tests require RLS_TEST_DATABASE_URL, RLS_TEST_STORE_A_ID, RLS_TEST_STORE_B_ID, and RLS_TEST_SUBJECT_A. Use only an isolated development database with the reviewed policies and non-owner runtime role.',
  );
}

const protectedTables = [
  'Store', 'User', 'Expense', 'AuditLog', 'OutboxEvent', 'Category', 'Product',
  'ProductBarcode', 'InventoryBalance', 'StockMovement', 'Sale', 'SaleItem',
  'Payment', 'Supplier', 'SupplierProduct', 'QuoteRequest', 'QuoteRequestSupplier',
  'QuoteRequestItem', 'SupplierQuote', 'SupplierQuoteItem', 'PurchaseOrder',
  'PurchaseOrderItem', 'GoodsReceipt', 'GoodsReceiptItem', 'PurchaseInvoice',
  'PurchaseInvoiceItem',
];

test('RLS is enabled and forced for every store-owned table', async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const relationState = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(${protectedTables})
    `;
    assert.deepEqual(new Set(relationState.map((row) => row.relname)), new Set(protectedTables));
    for (const relation of relationState) {
      assert.equal(relation.relrowsecurity, true, `${relation.relname} must have RLS enabled`);
      assert.equal(relation.relforcerowsecurity, true, `${relation.relname} must force RLS`);
    }

    const [role] = await prisma.$queryRaw<Array<{ role_name: string; is_superuser: boolean; bypass_rls: boolean }>>`
      SELECT current_user AS role_name, r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls
      FROM pg_roles r WHERE r.rolname = current_user
    `;
    assert.ok(role);
    assert.equal(role.is_superuser, false, 'runtime test role must not be a superuser');
    assert.equal(role.bypass_rls, false, 'runtime test role must not have BYPASSRLS');
  } finally {
    await prisma.$disconnect();
  }
});

test('request identity is transaction-local and Store reads stay within membership', async () => {
  // This checks PostgreSQL policy context, not Supabase JWT verification. API-level
  // token/membership tests are in auth.middleware.test.ts. The test URL must set
  // connection_limit=1 so the same PostgreSQL backend is checked after commit.
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const [before] = await prisma.$queryRaw<Array<{ pid: number; subject: string | null }>>`
      SELECT pg_backend_pid() AS pid, current_setting('request.jwt.claim.sub', true) AS subject
    `;
    assert.ok(before);
    assert.equal(before.subject, null, 'a fresh pooled connection must start without an identity');

    const withoutIdentity = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public."Store" WHERE id IN (${storeA}, ${storeB})
    `;
    assert.deepEqual(withoutIdentity, [], 'no transaction identity must expose no stores');

    const result = await prisma.$transaction(async (tx) => {
      const [transactionBackend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      await tx.$queryRaw`SELECT set_config('request.jwt.claim.sub', ${subjectA}, true)`;
      const [activeSubject] = await tx.$queryRaw<Array<{ subject: string | null }>>`
        SELECT current_setting('request.jwt.claim.sub', true) AS subject
      `;
      const visible = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public."Store" WHERE id IN (${storeA}, ${storeB}) ORDER BY id
      `;
      return { pid: transactionBackend!.pid, subject: activeSubject!.subject, visible };
    });
    assert.equal(result.subject, subjectA, 'verified identity should exist only inside the transaction');
    assert.deepEqual(result.visible.map((row) => row.id), [storeA]);

    const [after] = await prisma.$queryRaw<Array<{ pid: number; subject: string | null }>>`
      SELECT pg_backend_pid() AS pid, current_setting('request.jwt.claim.sub', true) AS subject
    `;
    assert.ok(after);
    assert.equal(after.pid, result.pid, 'the same pooled backend must be reused for this check');
    assert.equal(after.subject, null, 'transaction-local identity must be cleared after commit');
    const visibleAfterTransaction = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public."Store" WHERE id IN (${storeA}, ${storeB})
    `;
    assert.deepEqual(visibleAfterTransaction, [], 'the same backend must deny reads after transaction completion');
  } finally {
    await prisma.$disconnect();
  }
});
