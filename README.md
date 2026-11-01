# DukaanAI

DukaanAI is an AI-assisted operating system for Indian kirana stores. The current application includes a React web client, Express API, PostgreSQL/Prisma data layer, point-of-sale and sales flows, product and inventory management, supplier/procurement workflows, finance and analytics views, and an AI Employee area whose live actions are deliberately disabled until their data and permission boundaries are ready.

## Local setup

Requirements: Node.js 22.12 or newer, npm, and either local PostgreSQL via Docker Compose or a configured Supabase PostgreSQL database.

```sh
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:5173>. The API is at <http://localhost:3001/api/health>. Local `AUTH_MODE=demo` uses in-memory demo supplier/procurement records; product, sales, finance, and inventory data use PostgreSQL.

Useful commands: `npm run dev:web`, `npm run dev:api`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:studio`.

## Configuration

Copy `.env.example` to `.env`. `AUTH_MODE=demo` is a local development shortcut and is not real authentication. Outside demo mode, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`; API requests must carry a Supabase bearer token, which the API verifies and maps to exactly one `User.authSubject` membership. Supply database settings through the environment or secret store. URL-encode reserved characters in database passwords (for example, `#` as `%23`), and rotate any database password that has been pasted into a shared chat or source file. Never use a production database for local tests or run a migration against it before reviewing the SQL and taking a backup.

## Architecture

- React, Vite and React Router PWA: `apps/web`
- Express modular API: `apps/api`
- Shared Zod/API/event contracts: `packages/shared`
- Canonical Prisma schema and migrations: `database/prisma`
- Local PostgreSQL service: `docker-compose.yml`
- Ownership and integration boundaries: [`docs/architecture/module-ownership.md`](docs/architecture/module-ownership.md)
- API contract: [`docs/contracts/api-conventions.md`](docs/contracts/api-conventions.md)
- Dashboard metric limitations: [`docs/modules/dashboard-analytics.md`](docs/modules/dashboard-analytics.md)
- Supabase setup and auth/data readiness: [`docs/setup/SUPABASE_SETUP_GUIDE.md`](docs/setup/SUPABASE_SETUP_GUIDE.md)
- Environment variable reference: [`docs/setup/ENVIRONMENT_VARIABLES.md`](docs/setup/ENVIRONMENT_VARIABLES.md)
- Database migration procedure: [`docs/setup/DATABASE_MIGRATION_GUIDE.md`](docs/setup/DATABASE_MIGRATION_GUIDE.md)

Amounts travel as decimal strings, and timestamps are UTC ISO 8601, displayed in `Asia/Kolkata`. Dashboard metrics show unavailable values when their source data cannot be read. Gross profit uses sale-time cost snapshots; finance figures are estimates and not audited accounting.

## Database collaboration

There is one Prisma schema at `database/prisma/schema.prisma` and one sequential migration history. Domain developers propose their own models; Dev 5 coordinates cross-domain relationships and migration ordering. Review SQL before applying schema changes. Never reset a shared database.

## PWA and deployment

The web manifest enables install metadata. Service worker caching is intentionally not enabled for authenticated data. Deploy the web app behind HTTPS with SPA history fallback and the API as a Node service connected to persistent PostgreSQL. Follow [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md). `/api/health` currently reports liveness only; it does not verify database readiness.

## Current integration status

POS, products, inventory, sales, suppliers, finance, and analytics screens are present. Sales, inventory, and supplier/procurement runtime persistence use Prisma; in-memory procurement repositories remain for isolated tests. Dashboard metrics reflect database availability. AI live operations are deferred and return an explicit unavailable response. Supabase token verification is available in non-demo mode, but each authenticated identity still needs a matching `User.authSubject` row and the web UI does not yet provide a sign-in screen. The outbox is written transactionally for sale and confirmed receipt events; a delivery worker remains future work.
