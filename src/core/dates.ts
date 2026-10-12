import type { ISODate } from './types';

// Calendar math on 'YYYY-MM-DD' strings, done in UTC so DST never shifts a day.

const DAY_MS = 86_400_000;

function toUtcMs(date: ISODate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid ISO date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** Inclusive list of dates from `start` to `end`. Empty if end < start. */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const n = diffDays(start, end);
  const out: ISODate[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** Age in whole years on `onDate`. */
export function ageOn(birthDate: ISODate, onDate: ISODate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = onDate.split('-').map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}
