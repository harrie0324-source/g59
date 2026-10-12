import type { ActivityLog } from '../types';
import { getActivityType } from './compendium';

// The same workout often arrives twice: once from HealthKit/Health Connect and once
// typed in by hand. Two logs count as the same session when:
//   - they come from different sources, are on the same day, and are the same kind of activity, AND
//   - both have start times and overlap by ≥ 50 % of the shorter one, OR
//     at least one has no start time and their durations are within max(10 min, 25 %).
// The manual entry wins, because the user chose its intensity on purpose.
// Two manual entries are never merged (someone can really run twice in a day).

const MIN_OVERLAP = 0.5;

function sameKind(a: ActivityLog, b: ActivityLog): boolean {
  if (a.activityCode === b.activityCode) return true;
  const ca = getActivityType(a.activityCode)?.category;
  const cb = getActivityType(b.activityCode)?.category;
  return ca !== undefined && ca === cb;
}

function overlapFraction(a: ActivityLog, b: ActivityLog): number {
  const aEnd = a.startedAt! + a.durationMin * 60_000;
  const bEnd = b.startedAt! + b.durationMin * 60_000;
  const overlap = Math.min(aEnd, bEnd) - Math.max(a.startedAt!, b.startedAt!);
  const shorter = Math.min(a.durationMin, b.durationMin) * 60_000;
  return shorter > 0 ? Math.max(0, overlap) / shorter : 0;
}

export function isDuplicate(a: ActivityLog, b: ActivityLog): boolean {
  if (a.source === b.source) return false;
  if (a.localDate !== b.localDate || !sameKind(a, b)) return false;
  if (a.startedAt !== undefined && b.startedAt !== undefined) {
    return overlapFraction(a, b) >= MIN_OVERLAP;
  }
  const diff = Math.abs(a.durationMin - b.durationMin);
  return diff <= Math.max(10, 0.25 * Math.max(a.durationMin, b.durationMin));
}

const PRIORITY: Record<ActivityLog['source'], number> = { manual: 0, healthkit: 1, health_connect: 2 };

export interface DedupeResult {
  kept: ActivityLog[];
  /** Dropped log id → id of the log it duplicates. */
  duplicates: Map<string, string>;
}

export function dedupeActivities(logs: ActivityLog[]): DedupeResult {
  const sorted = [...logs].sort((a, b) => PRIORITY[a.source] - PRIORITY[b.source]);
  const kept: ActivityLog[] = [];
  const duplicates = new Map<string, string>();
  for (const log of sorted) {
    const match = kept.find((k) => isDuplicate(k, log));
    if (match) duplicates.set(log.id, match.id);
    else kept.push(log);
  }
  // Return in the original order for stable display.
  const keptIds = new Set(kept.map((k) => k.id));
  return { kept: logs.filter((l) => keptIds.has(l.id)), duplicates };
}
