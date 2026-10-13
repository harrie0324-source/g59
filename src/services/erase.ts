import { schema } from '@/db/schema';
import type { DB } from '@/db/types';

/** Removes every row on this device (used by "Erase all data"). */
export function eraseLocalData(db: DB): void {
  db.transaction((tx) => {
    for (const table of Object.values(schema)) tx.delete(table).run();
  });
}
