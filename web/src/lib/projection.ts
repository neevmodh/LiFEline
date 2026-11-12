// With vs without Mission LiFE: scale what real active households saved in the last 30 days to any
// number of homes and any share of them taking part. Low, mid and high are the 25th, 50th and 75th
// percentiles of real households, so the range is observed, not modelled. Pure and tested.

export interface Spread {
  low: number;
  mid: number;
  high: number;
}

export interface HabitStats {
  avg_monthly_kwh: number;
  kwh_saved: Spread;
  co2_saved_kg: Spread;
  rs_saved: Spread;
}

export interface Projection {
  homesTakingPart: number;
  /** MWh a month all the homes use if nobody changes. */
  withoutMwh: number;
  /** MWh a month with the share taking part, at the mid case. */
  withMwh: number;
  savedMwh: Spread;
  savedRsMonth: Spread;
  co2TonnesYear: Spread;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

export function project(stats: HabitStats, homes: number, adoptionPct: number): Projection {
  const n = Math.round(clamp(homes, 0, 50_000_000));
  const taking = Math.round((n * clamp(adoptionPct, 0, 100)) / 100);
  const each = (s: Spread, k: number) => ({ low: s.low * k, mid: s.mid * k, high: s.high * k });
  const withoutMwh = (n * Math.max(0, stats.avg_monthly_kwh)) / 1000;
  const savedMwh = each(stats.kwh_saved, taking / 1000);
  return {
    homesTakingPart: taking,
    withoutMwh,
    withMwh: Math.max(0, withoutMwh - savedMwh.mid),
    savedMwh,
    savedRsMonth: each(stats.rs_saved, taking),
    co2TonnesYear: each(stats.co2_saved_kg, (taking * 12) / 1000),
  };
}
