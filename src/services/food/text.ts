const SMALL = new Set(['a', 'an', 'and', 'or', 'of', 'with', 'in', 'on', 'the', 'to', 'for']);

/** "CHOBANI, GREEK YOGURT, PLAIN" → "Chobani, Greek Yogurt, Plain". Leaves mixed-case text alone. */
export function tidyName(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^(\p{L})/u, (c) => c.toUpperCase())))
    .join(' ');
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Short, readable serving label: "1 container (150 g)". */
export function servingLabel(text: string | null | undefined, grams: number): string {
  const g = `${round1(grams)} g`;
  const base = text?.trim();
  if (!base || base.toLowerCase() === g) return g;
  return `${base} (${g})`;
}
