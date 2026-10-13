import { isNull } from 'drizzle-orm';

import { ids } from '@/lib/ids';

import { newRow, touched } from '../rows';
import { dailySummaries } from '../schema';
import type { DB } from '../types';

export type DayRow = typeof dailySummaries.$inferSelect;

export const daysQuery = (db: DB) => db.select().from(dailySummaries).where(isNull(dailySummaries.deletedAt));

/** One row per date with a deterministic id, so two devices merge instead of duplicating. */
export function setDayComplete(db: DB, date: string, isComplete: boolean, now = Date.now()): void {
  db.insert(dailySummaries)
    .values({ ...newRow(now, ids.day(date)), localDate: date, isComplete })
    .onConflictDoUpdate({ target: dailySummaries.id, set: { isComplete, deletedAt: null, ...touched(now) } })
    .run();
}
