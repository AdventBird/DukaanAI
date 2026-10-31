import 'dotenv/config';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { errorEnvelope, successEnvelope, type AuthContext } from '@dukaanai/shared';

const app = express();
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

app.get('/api/health', (_req, res) => {
  res.json(successEnvelope({ status: 'ok', database: 'not_checked' }, res.locals.requestId));
});

app.get('/api/dashboard/summary', (req, res) => {
  if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
  // Domain modules have not been integrated yet. Unknown metrics stay null instead of appearing as zero.
  res.json(successEnvelope({
    period: String(req.query.period ?? 'today'),
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

app.use((_req, res) => res.status(404).json(errorEnvelope('NOT_FOUND', 'The requested resource was not found.', res.locals.requestId)));
const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === 'number' && err.status < 500 ? err.status : 500;
  res.status(status).json(errorEnvelope(status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', status === 400 ? 'The request could not be processed.' : 'An unexpected error occurred.', res.locals.requestId));
};
app.use(errors);

app.listen(port, () => console.log(`DukaanAI API listening on port ${port}`));
