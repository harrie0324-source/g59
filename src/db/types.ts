import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { schema } from './schema';

/**
 * Any synchronous Drizzle SQLite database with our schema:
 * expo-sqlite in the app, better-sqlite3 in tests.
 */
export type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
