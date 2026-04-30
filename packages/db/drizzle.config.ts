import type { Config } from 'drizzle-kit';

export default {
  schemaFilter: ['public'],
  schema: './src/schema/*.schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_DATABASE_URL ?? '',
  },
  migrations: {
    prefix: 'supabase',
  },
  strict: true,
  verbose: true,
  entities: {
    roles: {
      provider: 'supabase',
      exclude: ['supabase_auth_admin'],
    },
  },
} satisfies Config;
