# Deployment runbook

Deploy `apps/web` as a static PWA with SPA route fallback and HTTPS; deploy `apps/api` as a Node service; use persistent managed PostgreSQL. Configure `DATABASE_URL`, `WEB_ORIGIN`, `PORT`, and a real authentication/session implementation through the deployment secret store. Do not deploy with `AUTH_MODE=demo`. `/api/health` is a liveness endpoint; database readiness is not yet wired. The AI worker and mock portal are not implemented in this foundation.
