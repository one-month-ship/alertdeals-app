import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../schema/index.js';

type SupabaseToken = {
  iss?: string;
  sub?: string;
  aud?: string[] | string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  role?: string;
};

export function createDrizzle<
  Database extends PostgresJsDatabase<typeof schema> & {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    $client: postgres.Sql<{}>;
  },
  Token extends SupabaseToken = SupabaseToken,
>(token: Token, { admin, client }: { admin: Database; client: Database }) {
  return {
    admin,
    rls: (async (transaction, ...rest) => {
      return await client.transaction(async (tx) => {
        try {
          await tx.execute(sql`
            select set_config('request.jwt.claims', '${sql.raw(JSON.stringify(token))}', TRUE);
            select set_config('request.jwt.claim.sub', '${sql.raw(token.sub ?? '')}', TRUE);
            set local role ${sql.raw(token.role ?? 'anon')};
          `);
          return await transaction(tx);
        } finally {
          await tx.execute(sql`
            select set_config('request.jwt.claims', NULL, TRUE);
            select set_config('request.jwt.claim.sub', NULL, TRUE);
            reset role;
          `);
        }
      }, ...rest);
    }) as typeof client.transaction,
  };
}
