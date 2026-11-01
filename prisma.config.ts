import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'database/prisma/schema.prisma',
  migrations: {
    path: 'database/prisma/migrations',
    seed: 'tsx database/prisma/seed.ts',
  },
  datasource: {
    // Prisma CLI migrations use the direct/migration URL when supplied. The API's
    // PrismaClient still uses DATABASE_URL from the schema at runtime.
    // The local fallback allows generate/validate without a configured database.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://dukaanai:dukaanai@localhost:5432/dukaanai?schema=public',
  },
});
