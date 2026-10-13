// App database (expo-sqlite). Tests use better-sqlite3 via src/db/__tests__/testDb.ts instead.
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as Crypto from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';

import { setRandomSource } from '@/lib/ids';

import { schema } from './schema';

setRandomSource((n) => Crypto.getRandomBytes(n));

// enableChangeListener powers Drizzle's useLiveQuery (screens re-render when rows change).
export const sqlite = openDatabaseSync('burnrate.db', { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });

/** Native opens synchronously, so there's nothing to wait for. See client.web.ts. */
export const dbReady: Promise<void> | null = null;
