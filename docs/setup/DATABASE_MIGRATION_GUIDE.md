# Database migration guide

## Current migration history

Prisma is the single schema and migration workflow at `database/prisma/schema.prisma` and `database/prisma/migrations/`:

1. `20261031000000_shared_foundation` creates the shared, product/inventory, and POS/sales schema.
2. `20261101000000_suppliers_procurement_auth` adds supplier/procurement tables and nullable `User.authSubject`.

The second migration is prepared but has not been applied to Supabase. There is no verified remote schema snapshot, migration status, RLS inventory, storage bucket inventory, or grants inventory in this workspace. The Supabase owner must inspect the intended project before applying either migration.

## Safe development procedure

1. Create a separate Supabase development project (recommended) or an isolated disposable PostgreSQL database. Never use business production records for tests.
2. Set `DIRECT_URL` to that database's direct or session-mode migration connection, and set `DATABASE_URL` to the least-privileged runtime connection. Do not send either value in reports.
3. Review every SQL file under `database/prisma/migrations/` against the target's existing schema. These migrations were written assuming the foundation tables are absent in migration 1 and the new supplier/auth tables are absent in migration 2; do not run them blindly on a project with manually-created tables.
4. Check status with `npx prisma migrate status --schema database/prisma/schema.prisma`.
5. For a new isolated development database, apply the checked-in history using `npx prisma migrate deploy --schema database/prisma/schema.prisma`.
6. Verify with `npx prisma validate --schema database/prisma/schema.prisma`, then run the integration test suite against that isolated database.
7. For local schema development, use `npm run db:migrate` only against a disposable local database. Review and check in the generated migration before deployment.

Do not use `prisma migrate reset` on any shared or live database. Do not apply a migration until its target state has been reviewed and backed up.

## Supabase-specific constraints

- Prisma CLI uses `DIRECT_URL` from `prisma.config.ts` when set; the API Prisma client uses `DATABASE_URL` from the Prisma schema.
- Use a direct or session-mode connection for migrations; a transaction-pooler connection may not support migration advisory locks or session behavior.
- Supabase's default `postgres` role is administrative. It must not be the ordinary API runtime identity.
- The current API does not yet set verified user identity transaction-locally for Prisma. RLS policies must remain unapplied until that is implemented and tested with pooled connections. Never solve this by granting the runtime role `BYPASSRLS`.
- The RLS/storage SQL draft is at `docs/setup/sql/rls-design.sql`; it is a design artifact, not a runnable migration or proof of isolation.

## Production sequence (later)

1. Create a backup/restore point and capture the remote migration/schema state.
2. Reconcile any existing schema manually; do not baseline by guessing.
3. Review migration SQL, role grants, RLS policies, and the rollback/restore procedure.
4. Run the complete migration and isolation tests on staging.
5. Obtain project-owner approval, then apply using the migration credential and `npx prisma migrate deploy`.
6. Verify migration history, row counts, RLS flags/policies, grants, and application health before traffic is switched.
