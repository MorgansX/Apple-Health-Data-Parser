/**
 * Apple Health dates look like "2026-07-10 08:30:00 +0200" — space-separated,
 * not directly ISO-parseable. This normalizes to "2026-07-10T08:30:00+0200".
 */
export function parseAppleDate(value: string): Date {
  const isoLike = value.replace(' ', 'T').replace(' ', '');
  return new Date(isoLike);
}

export function minutesBetween(startDate: string, endDate: string): number {
  const ms = parseAppleDate(endDate).getTime() - parseAppleDate(startDate).getTime();
  return ms / 60_000;
}

/** Local calendar date (YYYY-MM-DD) from an Apple date string, via string slice — no Date() needed. */
export function localDate(appleDate: string): string {
  return appleDate.slice(0, 10);
}
