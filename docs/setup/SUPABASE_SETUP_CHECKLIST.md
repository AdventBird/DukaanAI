# Supabase setup checklist

## Development project

- [ ] Create a separate development Supabase project in a region close to the development team/users.
- [ ] Save the project URL and publishable key; keep database credentials private.
- [ ] Rotate the database password previously shared in chat.
- [ ] Configure `.env` from `.env.example` with separate least-privilege runtime and migration URLs.
- [ ] Review remote schema and migration status before applying the checked-in migrations.
- [ ] Enable Email Auth and set localhost Site URL/redirect URLs; create only development test users.
- [ ] Add an `authSubject` membership for each test identity in the correct store.
- [ ] Finish browser login/session and store selection before using protected web screens.
- [ ] Implement request-scoped Prisma identity context and test connection-pool isolation.
- [ ] Review role/grant design; keep runtime role non-owner and `NOBYPASSRLS`.
- [ ] Apply RLS policies only after the Prisma request context passes isolated database tests.
- [ ] Create a private document bucket and test store-scoped upload/download policies.
- [ ] Run lint, build, all unit tests and database integration/security tests against development DB.

## Production (later)

- [ ] Create a separate production Supabase project and set production domain redirects.
- [ ] Configure separate runtime and migration secrets in the hosting secret store.
- [ ] Verify backups/PITR and a tested restore procedure.
- [ ] Review the exact migration diff, grants, policies, and storage configuration.
- [ ] Run the full migration/RLS/storage suite in staging.
- [ ] Obtain owner approval before production changes.
- [ ] Apply migrations with the migration credential; deploy runtime with the least-privilege role.
- [ ] Verify RLS, grants, auth membership, storage isolation, and health after deployment.
