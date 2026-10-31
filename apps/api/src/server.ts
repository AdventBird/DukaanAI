import 'dotenv/config';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createExpenseSchema, errorEnvelope, successEnvelope, type AuthContext } from '@dukaanai/shared';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 3001);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

app.disable('x-powered-by');
app.use(cors({ origin: webOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.slice(0, 100) || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

declare global {
  namespace Express { interface Request { auth?: AuthContext } }
}

// Demo identity is intentionally replaceable. Production deployments must use a verified session.
app.use('/api', (req: Request, _res: Response, next) => {
  if (process.env.AUTH_MODE === 'demo') {
    req.auth = { userId: 'demo-owner', storeId: 'demo-store', role: 'OWNER' };
  }
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(successEnvelope({ status: 'ok', database: 'ready' }, res.locals.requestId));
  } catch {
    res.status(503).json(errorEnvelope('DEPENDENCY_UNAVAILABLE', 'The database is not available.', res.locals.requestId));
  }
});

app.get('/api/dashboard/summary', (req, res) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  const period = typeof req.query.period === 'string' ? req.query.period : 'today';
  if (!['today', '7d', '30d'].includes(period)) return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Choose today, 7d, or 30d for the period.', res.locals.requestId));
  // Domain modules have not been integrated yet. Unknown metrics stay null instead of appearing as zero.
  res.json(successEnvelope({
    period,
    storeId: req.auth.storeId,
    dataAvailable: false,
    sales: null,
    transactions: null,
    averageBasket: null,
    grossProfit: null,
    lowStockCount: null,
    openPurchaseOrders: null,
    updatedAt: null,
  }, res.locals.requestId));
});

app.get('/api/dashboard/activity', async (req, res, next) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  const auth = req.auth;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  try {
    const records = await prisma.auditLog.findMany({ where: { storeId: auth.storeId }, orderBy: { createdAt: 'desc' }, take: limit });
    res.json(successEnvelope(records.map(({ id, action, entityType, entityId, metadata, createdAt }) => ({ id, action, entityType, entityId, details: metadata, occurredAt: createdAt.toISOString() })), res.locals.requestId));
  } catch (error) { next(error); }
});

// These aggregation adapters return explicit missing-data states until their domain owners integrate.
app.get('/api/analytics/sales', (req, res) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  res.json(successEnvelope({ dataAvailable: false, unavailableReason: 'SALES_MODULE_NOT_INTEGRATED', interval: req.query.interval ?? 'day', points: null }, res.locals.requestId));
});
app.get('/api/analytics/products/top-selling', (req, res) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  res.json(successEnvelope({ dataAvailable: false, unavailableReason: 'SALES_MODULE_NOT_INTEGRATED', items: null }, res.locals.requestId));
});
app.get('/api/analytics/inventory/health', (req, res) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  res.json(successEnvelope({ dataAvailable: false, unavailableReason: 'INVENTORY_MODULE_NOT_INTEGRATED', lowStockCount: null, stockoutCount: null }, res.locals.requestId));
});
app.get('/api/analytics/procurement/summary', (req, res) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  res.json(successEnvelope({ dataAvailable: false, unavailableReason: 'PROCUREMENT_MODULE_NOT_INTEGRATED', openPurchaseOrders: null, overdueDeliveries: null }, res.locals.requestId));
});

app.get('/api/finance/expenses', async (req, res, next) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  const auth = req.auth;
  const requestedPage = Number(req.query.page);
  const requestedPageSize = Number(req.query.pageSize);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(100, requestedPageSize) : 20;
  try {
    const [expenses, total] = await prisma.$transaction([
      prisma.expense.findMany({ where: { storeId: auth.storeId }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.expense.count({ where: { storeId: auth.storeId } }),
    ]);
    res.json({ data: expenses.map((expense) => ({ ...expense, amount: expense.amount.toFixed(2), occurredAt: expense.occurredAt.toISOString() })), meta: { requestId: res.locals.requestId, pagination: { page, pageSize, total } } });
  } catch (error) { next(error); }
});

app.post('/api/finance/expenses', async (req, res, next) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  const auth = req.auth;
  if (auth.role !== 'OWNER') return res.status(403).json(errorEnvelope('FORBIDDEN', 'Only the store owner can record expenses.', res.locals.requestId));
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'The expense details are invalid.', res.locals.requestId, parsed.error.issues.map(({ path, message }) => ({ path, message }))));
  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({ data: {
        storeId: auth.storeId,
        category: parsed.data.category,
        description: parsed.data.description,
        // Keep monetary input as a decimal string; Prisma writes it to NUMERIC without float conversion.
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        occurredAt: new Date(parsed.data.occurredAt),
        createdById: auth.userId,
      } });
      const eventId = randomUUID();
      const amount = created.amount.toFixed(2);
      const occurredAt = created.occurredAt.toISOString();
      const payload = { eventId, eventType: 'expense.recorded', payloadVersion: 1, storeId: auth.storeId, entityType: 'expense', entityId: created.id, occurredAt, actor: { type: 'USER', id: auth.userId }, payload: { category: created.category, amount, currency: created.currency } };
      await tx.outboxEvent.create({ data: { id: eventId, storeId: auth.storeId, eventType: 'expense.recorded', payloadVersion: 1, entityType: 'expense', entityId: created.id, payload } });
      await tx.auditLog.create({ data: { storeId: auth.storeId, actorId: auth.userId, action: 'expense.recorded', entityType: 'expense', entityId: created.id, metadata: { category: created.category, amount, currency: created.currency } } });
      return created;
    });
    res.status(201).json(successEnvelope({ ...expense, amount: expense.amount.toFixed(2), occurredAt: expense.occurredAt.toISOString() }, res.locals.requestId));
  } catch (error) { next(error); }
});

app.get('/api/finance/summary', async (req, res, next) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  const auth = req.auth;
  const todayInKolkata = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const parseBoundary = (value: string, endOfDay: boolean) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`)
    : new Date(value);
  const from = typeof req.query.from === 'string' ? parseBoundary(req.query.from, false) : parseBoundary(todayInKolkata, false);
  const to = typeof req.query.to === 'string' ? parseBoundary(req.query.to, true) : new Date();
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'A valid date range is required.', res.locals.requestId));
  try {
    const aggregate = await prisma.expense.aggregate({ where: { storeId: auth.storeId, occurredAt: { gte: from, lte: to } }, _sum: { amount: true }, _count: { _all: true } });
    res.json(successEnvelope({
      from: from.toISOString(), to: to.toISOString(), currency: 'INR',
      revenue: null, costOfGoodsSold: null, grossProfit: null,
      recordedExpenses: aggregate._sum.amount?.toFixed(2) ?? '0.00', expenseCount: aggregate._count._all,
      estimatedOperatingResult: null,
      dataAvailable: false,
      unavailable: ['sales', 'cost_of_goods_sold'],
    }, res.locals.requestId));
  } catch (error) { next(error); }
});

app.use((_req, res) => res.status(404).json(errorEnvelope('NOT_FOUND', 'The requested resource was not found.', res.locals.requestId)));
const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === 'number' && err.status < 500 ? err.status : 500;
  res.status(status).json(errorEnvelope(status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', status === 400 ? 'The request could not be processed.' : 'An unexpected error occurred.', res.locals.requestId));
};
app.use(errors);

app.listen(port, () => console.log(`DukaanAI API listening on port ${port}`));
