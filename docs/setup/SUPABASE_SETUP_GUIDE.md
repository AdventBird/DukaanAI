# Supabase setup guide for DukaanAI

This guide describes the repository as it exists today. Supabase Auth token verification is implemented in the API, but the web client has no sign-in UI, Prisma queries do not yet carry transaction-local user identity, RLS is not enabled by these migrations, and the app has no Storage integration. The SQL under `docs/setup/sql/` is a design draft, not a migration. Do not apply it yet and do not use a `BYPASSRLS` runtime role.

## A — Create a project

1. In the [Supabase Dashboard](https://supabase.com/dashboard), choose **New project** under a new or intended organization.
2. Use a separate **development** project for setup and tests. Choose a region close to the developers and expected users; use the same region strategy for production later.
3. Set a strong unique database password and store it in a password manager. The earlier password shared in chat should be rotated before use.
4. Wait for provisioning. Save the project URL, project reference, and database password privately. Do not send database URLs in chat or commit them.

Supabase currently uses project creation to provision the database. Do not manually create tables in Table Editor before applying reviewed Prisma migrations.

## B — Database connection

1. Open the project and click **Connect** at the top.
2. Copy a **Direct connection** URL for Prisma migrations when your network can reach the project's IPv6 endpoint. If not, use **Session pooler** for migration commands.
3. Put that URL in `DIRECT_URL` in the ignored local `/home/adventbird/DukaanAI/.env` file.
4. Copy the appropriate runtime connection separately into `DATABASE_URL`. Prefer a least-privilege runtime role. Supabase's default `postgres` user is administrative and must not remain the ordinary API identity. Do not create/activate the runtime role until its grants are reviewed.
5. Supabase's **Transaction pooler** is intended for short-lived/serverless connections and has session-state limitations. The proposed RLS architecture depends on transaction-local identity settings, so the API must wrap the complete request in an interactive transaction and this must be tested on the selected pooler before use.
6. Encode reserved password characters in the URL (`#` → `%23`, `@` → `%40`). Verify only against the development project with `npx prisma migrate status --schema database/prisma/schema.prisma`; never print the URL.

Connection strings are under **Connect**; choose the mode instead of composing a hostname. For Prisma, use direct/session mode for migrations and select a compatible runtime mode after the transaction-context work. See [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

## C — Project API credentials

1. Open **Project Settings → API** (the API keys page may be labeled **API Keys** in the current dashboard).
2. Copy the **Project URL** to `SUPABASE_URL` and `VITE_SUPABASE_URL`.
3. Copy the **publishable** key (or legacy `anon` key) to `SUPABASE_ANON_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Never put a secret/service-role key in a `VITE_` variable, browser code, or `.env.example`. This API does not need a service-role key for token verification.

The frontend variables are placeholders only: this repo's web app does not yet use a Supabase client or implement sign-in.

## D — Email authentication

No production Auth settings are changed by this repository. In the development project:

1. Open **Authentication → Sign In / Providers → Email** and enable Email/password sign-in. Decide whether to require email confirmation; for real accounts, confirmation should stay enabled. For local smoke tests, use a dedicated test mailbox and follow the confirmation link.
2. Open **Authentication → URL Configuration**. Set **Site URL** to `http://localhost:5173` for development.
3. Add `http://localhost:5173/**` to **Redirect URLs**. Later add the exact deployed HTTPS origin and any explicit callback path used by the finished frontend. Avoid broad production wildcards.
4. Create a development user under **Authentication → Users → Add user** (or use the eventual signup flow). Do not create production users for this setup task.
5. Before the API accepts the user, provision a `public."User"` row with `authSubject` equal to that Auth user's UUID and the correct `storeId`/role. Existing middleware requires exactly one membership; web-side store selection is not implemented yet.

See [Supabase Auth URL configuration](https://supabase.com/docs/guides/auth/redirect-urls) and [password authentication](https://supabase.com/docs/guides/auth/passwords).

## E — Database migrations

Current history is in `database/prisma/migrations/`:

1. `20261031000000_shared_foundation`
2. `20261101000000_suppliers_procurement_auth`

The latter adds supplier/procurement tables and `User.authSubject`. Neither has been verified against your remote project, and the second has not been applied. First inspect **Database → Tables**, **Database → Migrations** (if available), and the SQL editor to determine whether any tables were created manually. Do not duplicate them.

On an empty, separate development database only:

```sh
cd /home/adventbird/DukaanAI
npx prisma migrate status --schema database/prisma/schema.prisma
npx prisma migrate deploy --schema database/prisma/schema.prisma
npx prisma validate --schema database/prisma/schema.prisma
```

`DIRECT_URL` is used for Prisma CLI migrations when present; `DATABASE_URL` is the API runtime URL. Check row counts and existing data before/after if the project is not empty. Confirm RLS flags with `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';` and list policies with `SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public';`. RLS is currently not part of the checked-in migrations. Do not activate the draft RLS SQL until request-scoped Prisma context and isolation tests are complete.

## F — RLS readiness and testing

RLS is **not ready to enable**. The API verifies a bearer token through Supabase Auth, but subsequent Prisma queries do not establish a verified transaction-local PostgreSQL identity. Without that context, policies would deny access; using the project owner or a `BYPASSRLS` role would defeat the boundary.

Before calling RLS complete, implement and test all of these against an isolated database using the actual non-owner runtime role:

1. Create two stores and Auth users A and B, and a cashier membership. Verify authenticated A can read/write only its authorized store and B cannot see A's rows.
2. Verify missing/expired JWT, no membership, and unauthorized store selection are denied.
3. Verify cashier/owner role differences for products, stock adjustments, sales, expenses, and procurement.
4. Start concurrent Prisma requests for A and B through the same pool; prove transaction-local context cannot leak.
5. Attempt cross-store inserts and storeId changes; both must fail at RLS even if application filters are omitted.
6. Check that the runtime role is `NOBYPASSRLS`, non-owner, and has only required schema/table/function privileges. Review views and functions separately.
7. Run explicit SQL assertions and API tests. Do not claim RLS protection until these pass.

After creating two development stores, one linked Auth user for Store A, and applying a reviewed RLS migration in the isolated project, add these variables to the ignored local `.env` without printing/sharing them, load that file in the shell, and run the dedicated test (it intentionally fails if any variable is missing):

```dotenv
RLS_TEST_DATABASE_URL=postgresql://<restricted-runtime-role>:<encoded-password>@<host>:<port>/postgres?connection_limit=1
RLS_TEST_STORE_A_ID=<store-a-id>
RLS_TEST_STORE_B_ID=<store-b-id>
RLS_TEST_SUBJECT_A=<supabase-auth-user-uuid-for-store-a>
```

```sh
set -a; . ./.env; set +a
npm run test:rls --workspace @dukaanai/api
```

Use a direct or session-mode development connection with `connection_limit=1` for this preflight so the test can confirm the same backend connection has no identity after transaction completion. The suite checks RLS/FORCE RLS flags, rejects superuser/BYPASSRLS roles, and verifies Store A cannot see Store B or access rows without a transaction-local subject. It does not prove request-concurrency isolation for the Express/Prisma application; that remains blocked on the API transaction-context implementation and must be added before RLS is declared complete.

`docs/setup/sql/rls-design.sql` records a draft policy direction, not an executable or reviewed migration. Its role permissions and parent/child table policies still need review against actual API operations.

## G — Private Storage

No document bucket or upload/download code currently exists. The prepared SQL draft names a private `business-documents` bucket with a 10 MiB limit and PDF/JPEG/PNG/WebP types, with store-scoped paths such as `<store-id>/<document-id>.pdf`. Do not run it until RLS identity mapping is implemented and storage policies are reviewed.

For manual inspection in a development project, open **Storage → New bucket**, name it `business-documents`, keep **Public bucket** off, and set the proposed size/MIME limits. The final policy should allow only authenticated users with a membership in the first path segment's store; owner/assistant may upload and owners may delete. The app needs signed URLs for temporary sharing and must never expose public invoice URLs. Verify that another store cannot list, download, upload, or delete the file. Supabase private buckets enforce access through `storage.objects` RLS; see [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## H — Environment file

Create `/home/adventbird/DukaanAI/.env` by copying `.env.example`; it is git-ignored. Fill values locally in a secret manager/editor. See [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md) for the complete variable table. Never share or commit the filled file.

| Variable | Where to get it | Used by | Secret? |
|---|---|---|---|
| `DATABASE_URL` | Supabase **Connect**; least-privilege runtime role | API Prisma | Yes |
| `DIRECT_URL` | Supabase **Connect**; direct/session migration connection | Prisma CLI migrations | Yes, elevated |
| `SUPABASE_URL` | **Project Settings → API** | API token verification | No |
| `SUPABASE_ANON_KEY` | **Project Settings → API Keys** publishable/anon key | API Auth verification call | No |
| `VITE_SUPABASE_URL` | Same project URL | Future browser Auth client, currently unused | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys** | Future browser Auth client, currently unused | No |
| `AUTH_MODE` | Set locally | API auth mode; `demo` only for local demo | No |
| `WEB_ORIGIN`, `VITE_API_BASE_URL`, `PORT` | Local/deployment URLs | CORS, web API, API listener | No |
| `AI_API_KEY` | AI provider only if AI is enabled later | Deferred AI | Yes; optional now |

## I — Development verification checklist

- [ ] The project is a dedicated development project; password has been rotated.
- [ ] `.env` contains distinct runtime and migration URLs and is not tracked.
- [ ] Remote schema/migration state was inspected before applying Prisma migrations.
- [ ] Supabase Email Auth and localhost redirects are configured.
- [ ] A development Auth user has a valid `User.authSubject` store membership.
- [ ] Web sign-in and store selection have been implemented (not yet done).
- [ ] Runtime role is non-owner, least-privileged, and `NOBYPASSRLS`.
- [ ] Request-scoped Prisma identity context is implemented and pool-isolation tests pass (not yet done).
- [ ] RLS policies and grants are reviewed and pass cross-store/role tests (not yet done).
- [ ] Private Storage policies and application upload/download tests pass (not yet done).
- [ ] Database integration suites run against the isolated development database rather than skip.

## J — Production preparation

Keep production in a separate Supabase project. Before any production operation: configure backups/PITR and test restore; inspect schema and migration history; review the SQL, grants, RLS/storage policies, role secrets, and rollback plan; run migrations and security tests in staging; then obtain owner approval. Apply migrations with the dedicated migration credential only. Deploy the API using the restricted runtime credential, never the Supabase `postgres` owner or service-role key. Production Auth URL/email settings and users are owner actions. No production action was performed as part of this preparation.
