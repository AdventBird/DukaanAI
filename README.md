# DukaanAI

DukaanAI is an AI-assisted operating system for Indian kirana stores. This repository starts with the shared application foundation and Dev 5's integrated dashboard shell. Product, POS, procurement, and AI modules are reserved for their respective owners and are not included yet.

## Local setup

Requirements: Node.js 22.12 or newer, npm, and Docker Compose.

```sh
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:5173>. The API is at <http://localhost:3001/api/health>. The dashboard currently presents an explicitly marked demo workspace and unknown values; it does not invent business records.

Useful commands: `npm run dev:web`, `npm run dev:api`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:studio`.

## Configuration

Copy `.env.example` to `.env`. The included `AUTH_MODE=demo` option is for local development only; it injects a demo owner/store context and is not real authentication. Do not use it in deployment. Configure a verified session implementation and a strong `SESSION_SECRET` before exposing the API. `DATABASE_URL` is the sole PostgreSQL connection setting.

## Architecture

- React, Vite and React Router PWA: `apps/web`
- Express modular API: `apps/api`
- Shared Zod/API/event contracts: `packages/shared`
- Canonical Prisma schema and migrations: `database/prisma`
- Local PostgreSQL service: `docker-compose.yml`
- Ownership and integration boundaries: [`docs/architecture/module-ownership.md`](docs/architecture/module-ownership.md)
- API contract: [`docs/contracts/api-conventions.md`](docs/contracts/api-conventions.md)
- Dashboard metric limitations: [`docs/modules/dashboard-analytics.md`](docs/modules/dashboard-analytics.md)

All amounts are intended to travel as decimal strings, and timestamps are UTC ISO 8601, displayed in `Asia/Kolkata`. The dashboard is read-oriented. Domain owners must provide approved query services/contracts before real aggregates can be shown. Gross profit requires sale-time cost snapshots; finance figures are estimates and not audited accounting.

## Database collaboration

There is one Prisma schema at `database/prisma/schema.prisma` and one sequential migration history. Domain developers propose their own models; Dev 5 coordinates cross-domain relationships and migration ordering. Review SQL before applying schema changes. Never reset a shared database.

## PWA and deployment

The web manifest enables install metadata. Service worker caching is intentionally not enabled for authenticated data. Deploy the web app behind HTTPS with SPA history fallback and the API as a Node service connected to persistent PostgreSQL. Follow [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md). `/api/health` currently reports liveness only; it does not verify database readiness.

## Current integration status

The global shell includes route placeholders for POS, products, inventory, sales, suppliers, analytics, and AI Employee. Dashboard sales/inventory/procurement aggregates are pending the corresponding domain contracts. Finance includes store-scoped expense listing/entry and an expense total; sales revenue, COGS, and gross profit remain unavailable. The AI worker, distributor mock portal, real authentication, and outbox dispatcher are not implemented by this foundation commit.
