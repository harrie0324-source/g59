import { and, asc, eq, isNull } from 'drizzle-orm';

import type { DataSource } from '@/core';

import { newRow, softDeleted, touched } from '../rows';
import { weightEntries } from '../schema';
import type { DB } from '../types';

export type WeightRow = typeof weightEntries.$inferSelect;

export const weightsQuery = (db: DB) =>
  db.select().from(weightEntries).where(isNull(weightEntries.deletedAt)).orderBy(asc(weightEntries.measuredAt));

export function addWeight(
  db: DB,
  entry: { weightKg: number; localDate: string; measuredAt: number; source?: DataSource; externalId?: string | null },
  now = Date.now(),
): string {
  const row = newRow(now);
  db.insert(weightEntries)
    .values({
      ...row,
      weightKg: entry.weightKg,
      localDate: entry.localDate,
      measuredAt: entry.measuredAt,
      source: entry.source ?? 'manual',
      externalId: entry.externalId ?? null,
    })
    .run();
  return row.id;
}

/** This day's manual weigh-in, if there is one. */
export function manualWeightOn(db: DB, localDate: string): WeightRow | undefined {
  return db
    .select()
    .from(weightEntries)
    .where(and(eq(weightEntries.localDate, localDate), eq(weightEntries.source, 'manual'), isNull(weightEntries.deletedAt)))
    .get();
}

/**
 * Manual entry from the app: one per day. Logging again on the same day corrects that
 * day's number (the trend uses one weigh-in per day, so a second entry would be ignored).
 */
export function logManualWeight(db: DB, entry: { weightKg: number; localDate: string; measuredAt: number }, now = Date.now()): string {
  const existing = manualWeightOn(db, entry.localDate);
  if (!existing) return addWeight(db, { ...entry, source: 'manual' }, now);
  db.update(weightEntries)
    .set({ weightKg: entry.weightKg, outlierStatus: 'none', ...touched(now) })
    .where(eq(weightEntries.id, existing.id))
    .run();
  return existing.id;
}

/** The user says an unusual weigh-in is real, so the trend should include it. */
export function confirmWeight(db: DB, id: string, now = Date.now()): void {
  db.update(weightEntries).set({ outlierStatus: 'confirmed', ...touched(now) }).where(eq(weightEntries.id, id)).run();
}

export function deleteWeight(db: DB, id: string, now = Date.now()): void {
  db.update(weightEntries).set(softDeleted(now)).where(eq(weightEntries.id, id)).run();
}
