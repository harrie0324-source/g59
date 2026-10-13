import { addDays, formatWeight, type WeightUnit } from '@/core';

/** "2,290" — whole kcal, grouped. */
export function formatKcal(kcal: number): string {
  return Math.round(kcal).toLocaleString('en-US');
}

export function formatGrams(g: number): string {
  return `${Math.round(g)} g`;
}

export { formatWeight };
export type { WeightUnit };

/** Today's date in the device's local timezone, as 'YYYY-MM-DD'. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", or "Mon, Oct 12". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** For mid-sentence use: "today", "yesterday", or "on Mon, Oct 12". */
export function dayPhrase(date: string, today: string): string {
  const label = dayLabel(date, today);
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : `on ${label}`;
}

/** Default meal for "now": breakfast before 10:30, lunch before 15:00, dinner before 21:00, else snack. */
export function mealForTime(d: Date = new Date()): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins < 10 * 60 + 30) return 'breakfast';
  if (mins < 15 * 60) return 'lunch';
  if (mins < 21 * 60) return 'dinner';
  return 'snack';
}
