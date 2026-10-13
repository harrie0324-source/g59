// In-memory SQLite with the real migrations, for repository/service tests.
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as path from 'path';

import { schema } from '../schema';
import type { DB } from '../types';

export function createTestDb(): DB {
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  return db as unknown as DB;
}
