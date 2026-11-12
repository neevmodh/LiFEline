// "My progress": each month's electricity against the baseline from onboarding, worked out from the
// readings the household entered (GET /api/readings). Pure, so the rules are unit-tested.
import type { Reading } from "@/lib/api";

export interface ProgressSummary {
  /** The most recent month with a reading, or null when there is none. */
  latest: Reading | null;
  /** Latest month against the baseline, in percent: negative is better. Null without a baseline. */
  changePct: number | null;
  /** The month with the fewest units. */
  best: Reading | null;
  /** How many months in a row, up to the latest, were at or below the baseline. */
  monthsBelowInARow: number;
  /** Units a month saved against the baseline in the latest month (0 if above). */
  savedKwh: number;
  /** True once there's at least one month beyond the starting point to compare. */
  hasTrend: boolean;
}

const valid = (r: Reading) => Number.isFinite(r.kwh) && r.kwh >= 0 && /^\d{4}-\d{2}$/.test(r.month);

export function summarise(readings: Reading[], baselineKwh: number | null | undefined): ProgressSummary {
  const months = readings.filter(valid).sort((a, b) => a.month.localeCompare(b.month));
  const base = baselineKwh && Number.isFinite(baselineKwh) && baselineKwh > 0 ? baselineKwh : null;
  const latest = months.at(-1) ?? null;
  const best = months.reduce<Reading | null>((m, r) => (m === null || r.kwh < m.kwh ? r : m), null);
  let run = 0;
  if (base !== null) {
    for (let i = months.length - 1; i >= 0 && months[i].kwh <= base; i--) run++;
  }
  return {
    latest,
    changePct: latest && base !== null ? Math.round(((latest.kwh - base) / base) * 1000) / 10 : null,
    best,
    monthsBelowInARow: run,
    savedKwh: latest && base !== null ? Math.max(0, Math.round(base - latest.kwh)) : 0,
    hasTrend: months.length >= 2,
  };
}

/** "2026-11" for the month `back` months before `now` (India time is close enough at month scale). */
export function monthKey(now: Date, back = 0): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  return d.toISOString().slice(0, 7);
}

/** A sensible units value: whole, 1 to 20,000 a month. */
export function parseUnits(text: string): number | null {
  const n = Number(text.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 1 && n <= 20000 ? Math.round(n) : null;
}
