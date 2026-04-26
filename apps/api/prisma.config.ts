import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // Migrations bypass the pgbouncer transaction pooler — they need long
    // DDL transactions and advisory locks that pgbouncer can't sustain.
    // Runtime queries still go through DATABASE_URL via the PrismaClient
    // constructor in PrismaService; this URL is only used by the CLI.
    //
    // `||` (not `??`) is intentional: Railway and several other PaaS
    // providers materialize "added but blank" env vars as empty strings,
    // not undefined. With `??`, an empty `DIRECT_URL` short-circuits the
    // chain and the `DATABASE_URL` fallback never fires, so
    // `prisma migrate deploy` crashes at container start with
    // "datasource.url property is required".
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
