import { z } from 'zod';

export const authContextSchema = z.object({
  userId: z.string().min(1),
  storeId: z.string().min(1),
  role: z.enum(['OWNER', 'CASHIER', 'ASSISTANT']),
});
export type AuthContext = z.infer<typeof authContextSchema>;

export const successEnvelope = <T>(data: T, requestId: string) => ({ data, meta: { requestId } });
export const errorEnvelope = (code: string, message: string, requestId: string, details: unknown[] = []) => ({
  error: { code, message, details, requestId },
});

export const apiErrorCodes = [
  'VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'INSUFFICIENT_STOCK', 'RATE_LIMITED', 'INTERNAL_ERROR', 'DEPENDENCY_UNAVAILABLE',
] as const;
export type ApiErrorCode = (typeof apiErrorCodes)[number];

export const domainEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  payloadVersion: z.number().int().positive(),
  storeId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  occurredAt: z.string().datetime(),
  actor: z.object({ type: z.enum(['USER', 'SYSTEM', 'AI']), id: z.string().optional() }),
  payload: z.unknown(),
});
export type DomainEvent = z.infer<typeof domainEventSchema>;
