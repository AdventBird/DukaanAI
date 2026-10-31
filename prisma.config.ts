import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'database/prisma/schema.prisma',
  migrations: {
    path: 'database/prisma/migrations',
    seed: 'tsx database/prisma/seed.ts',
  },
  datasource: {
    // Allows schema validation and client generation without a real database URL.
    url: process.env.DATABASE_URL ?? 'postgresql://dukaanai:dukaanai@localhost:5432/dukaanai?schema=public',
  },
});
