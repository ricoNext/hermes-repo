const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseDateMs(dateStr: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return null;
  }
  const ms = Date.parse(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function daysSince(dateStr: string, nowMs: number = Date.now()): number {
  const ms = parseDateMs(dateStr);
  if (ms === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((nowMs - ms) / MS_PER_DAY);
}

export function isWithinDays(dateStr: string, days: number, nowMs?: number): boolean {
  return daysSince(dateStr, nowMs) <= days;
}
