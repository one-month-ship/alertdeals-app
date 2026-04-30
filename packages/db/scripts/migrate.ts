import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDBAdminClient, postgresClient } from '../src/index.js';

async function migrateDB() {
  const clientAdmin = getDBAdminClient();
  await migrate(clientAdmin, { migrationsFolder: './src/drizzle/migrations' });
  await postgresClient.end();
}

migrateDB();
