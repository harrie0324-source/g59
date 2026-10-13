import { newId } from '@/lib/ids';

/** Columns for a brand-new row. `id` can be passed for deterministic rows. */
export function newRow(now: number = Date.now(), id: string = newId()) {
  return { id, createdAt: now, updatedAt: now, deletedAt: null, dirty: true };
}

/** Columns every local edit must set, so last-write-wins sync picks it up. */
export function touched(now: number = Date.now()) {
  return { updatedAt: now, dirty: true };
}

export function softDeleted(now: number = Date.now()) {
  return { deletedAt: now, updatedAt: now, dirty: true };
}
