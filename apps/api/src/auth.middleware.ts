import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { errorEnvelope, type AuthContext } from '@dukaanai/shared';

declare global {
  namespace Express { interface Request { auth?: AuthContext } }
}

type AuthDependencies = {
  prisma: Pick<PrismaClient, 'user'>;
  authMode?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  fetcher?: typeof fetch;
};

export function createAuthMiddleware(deps: AuthDependencies) {
  const fetcher = deps.fetcher ?? fetch;
  const fail = (res: Response, status: number, code: string, message: string) =>
    res.status(status).json(errorEnvelope(code, message, res.locals?.requestId ?? ''));
  return async (req: Request, res: Response, next: NextFunction) => {
    if (deps.authMode === 'demo') {
      req.auth = { userId: 'demo-owner', storeId: 'demo-store', role: 'OWNER' };
      return next();
    }

    const authorization = req.header('authorization');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail(res, 401, 'UNAUTHENTICATED', 'A valid bearer token is required.');
    if (!deps.supabaseUrl || !deps.supabaseAnonKey) {
      return fail(res, 503, 'AUTH_NOT_CONFIGURED', 'Supabase authentication is not configured.');
    }

    try {
      const response = await fetcher(`${deps.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: deps.supabaseAnonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return fail(res, 401, 'UNAUTHENTICATED', 'The bearer token is invalid or expired.');
      const identity = await response.json() as { id?: unknown };
      if (typeof identity.id !== 'string' || identity.id.length === 0) {
        return fail(res, 401, 'UNAUTHENTICATED', 'The identity provider returned no user ID.');
      }

      // Store and role come only from the server-side membership record. Client supplied
      // store IDs, role claims, and user IDs are never used as authorization authority.
      const requestedStoreId = req.header('x-store-id')?.trim();
      const memberships = await deps.prisma.user.findMany({
        where: { authSubject: identity.id, ...(requestedStoreId ? { storeId: requestedStoreId } : {}) },
        select: { id: true, storeId: true, role: true },
        take: 2,
      });
      if (memberships.length === 0) {
        return fail(res, 403, 'FORBIDDEN', 'The authenticated user must have exactly one active store membership.');
      }
      if (!requestedStoreId && memberships.length > 1) {
        return fail(res, 409, 'STORE_SELECTION_REQUIRED', 'Choose one of your authorized stores and retry with its store ID.');
      }
      if (memberships.length > 1) {
        return fail(res, 409, 'STORE_SELECTION_REQUIRED', 'Store membership is ambiguous; contact an administrator.');
      }
      const membership = memberships[0]!;
      req.auth = {
        userId: membership.id,
        storeId: membership.storeId,
        role: membership.role as AuthContext['role'],
      };
      return next();
    } catch {
      return fail(res, 503, 'AUTH_UNAVAILABLE', 'Supabase authentication could not be verified.');
    }
  };
}

export function assertSupabaseAuthConfigured(env: NodeJS.ProcessEnv = process.env) {
  const missing = ['DATABASE_URL'].filter((key) => !env[key]?.trim());
  if (env.AUTH_MODE !== 'demo') missing.push(...['SUPABASE_URL', 'SUPABASE_ANON_KEY'].filter((key) => !env[key]?.trim()));
  if (missing.length) throw new Error(`Authentication configuration is incomplete: ${missing.join(', ')} must be set when AUTH_MODE is not demo.`);
}

export function ownerOnly(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'OWNER') return res.status(403).json(errorEnvelope('FORBIDDEN', 'Only the store owner can perform this action.', res.locals?.requestId ?? ''));
  return next();
}
