# API conventions

All endpoints use the `/api` prefix. Success responses are `{ data, meta: { requestId } }`; errors are `{ error: { code, message, details, requestId } }`. HTTP status must represent the outcome. Never return stack traces or secrets in `details`.

## Shared representations

- Money is a decimal string plus an explicit `INR` currency.
- Timestamps are UTC ISO 8601; display in `Asia/Kolkata`.
- IDs are opaque strings (UUID recommended).
- Every store-owned query is scoped by the server-resolved `AuthContext`; never accept a body `storeId` as authority.
- Lists use stable sorting and page/pageSize/total pagination metadata.
- Unknown metrics are `null` or explicitly unavailable; they are not zero.

## Errors

`VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` and `INSUFFICIENT_STOCK` 409 · `RATE_LIMITED` 429 · `INTERNAL_ERROR` 500 · `DEPENDENCY_UNAVAILABLE` 503.

The current API includes request IDs, a safe JSON error handler, `/api/health`, and a dashboard summary contract. `AUTH_MODE=demo` injects a demo owner context for local development only. In other modes, the API verifies Supabase bearer tokens and resolves store and role from the `User.authSubject` membership; client-supplied identity, role, and store headers are not trusted. Each identity must resolve to exactly one membership.
