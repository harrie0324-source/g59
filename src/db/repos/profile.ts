import { eq } from 'drizzle-orm';

import { ids } from '@/lib/ids';

import { newRow, touched } from '../rows';
import { profiles } from '../schema';
import type { DB } from '../types';

export type ProfileRow = typeof profiles.$inferSelect;
export type ProfileInput = Omit<typeof profiles.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'dirty' | 'serverUpdatedAt'>;

export const profileQuery = (db: DB) => db.select().from(profiles).where(eq(profiles.id, ids.profile()));

export function getProfile(db: DB): ProfileRow | undefined {
  return profileQuery(db).get();
}

export function createProfile(db: DB, input: ProfileInput, now = Date.now()): void {
  db.insert(profiles).values({ ...newRow(now, ids.profile()), ...input }).run();
}

export function updateProfile(db: DB, patch: Partial<ProfileInput>, now = Date.now()): void {
  db.update(profiles).set({ ...patch, ...touched(now) }).where(eq(profiles.id, ids.profile())).run();
}
