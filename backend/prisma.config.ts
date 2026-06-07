import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node ./prisma/seed.ts",
  },
  datasource: {
    // Migrations must run against the unpooled (direct) connection — Neon's
    // pgbouncer-pooled URL doesn't support the prepared statements Prisma
    // Migrate uses. Falls back to DATABASE_URL for local dev.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
