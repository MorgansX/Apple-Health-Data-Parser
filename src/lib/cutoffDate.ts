/**
 * Computed once per request. Per-record filtering is a plain string
 * comparison against this prefix — never `new Date()` per record.
 */
export function getCutoffDateString(monthsBack = 3, now: Date = new Date()): string {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, '0');
  const day = String(cutoff.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
