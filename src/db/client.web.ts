// Web build only (used for browser previews; the app ships on iOS/Android).
// expo-sqlite on web runs in a Web Worker, and a synchronous open fails until that worker
// has started. So open asynchronously first, then create the synchronous connection.
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as Crypto from 'expo-crypto';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { setRandomSource } from '@/lib/ids';

import { schema } from './schema';

setRandomSource((n) => Crypto.getRandomBytes(n));

export let sqlite: SQLiteDatabase;
export let db: ExpoSQLiteDatabase<typeof schema>;

export const dbReady: Promise<void> | null = openDatabaseAsync('burnrate.db').then(() => {
  sqlite = openDatabaseSync('burnrate.db', { enableChangeListener: true });
  db = drizzle(sqlite, { schema });
});
