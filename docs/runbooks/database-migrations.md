# Database migrations

Use the single schema at `database/prisma/schema.prisma`. Domain owners propose model changes; Dev 5 reconciles them and creates the next sequential migration. Review generated SQL before merging. Never reset a shared or production database. Local setup: `docker compose up -d postgres`, then `npm run db:generate` and `npm run db:migrate`.
