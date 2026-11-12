import { describe, expect, it } from "vitest";

import { project, type HabitStats } from "./projection";

const stats: HabitStats = {
  avg_monthly_kwh: 300,
  kwh_saved: { low: 2, mid: 5, high: 9 },
  co2_saved_kg: { low: 1.5, mid: 3.5, high: 6.4 },
  rs_saved: { low: 15, mid: 38, high: 70 },
};

describe("project", () => {
  it("scales observed savings to the homes taking part", () => {
    const p = project(stats, 100_000, 25);
    expect(p.homesTakingPart).toBe(25_000);
    expect(p.withoutMwh).toBe(30_000); // 100,000 homes × 300 kWh
    expect(p.savedMwh).toEqual({ low: 50, mid: 125, high: 225 });
    expect(p.withMwh).toBe(30_000 - 125);
    expect(p.savedRsMonth.mid).toBe(950_000);
    expect(p.co2TonnesYear.mid).toBeCloseTo(1050, 6); // 25,000 × 3.5 kg × 12 months
  });
  it("keeps low ≤ mid ≤ high", () => {
    const p = project(stats, 5000, 60);
    for (const s of [p.savedMwh, p.savedRsMonth, p.co2TonnesYear]) expect(s.low <= s.mid && s.mid <= s.high).toBe(true);
  });
  it("clamps nonsense inputs instead of inventing numbers", () => {
    expect(project(stats, 1000, 150).homesTakingPart).toBe(1000);
    expect(project(stats, 1000, -5).homesTakingPart).toBe(0);
    expect(project(stats, Number.NaN, 50).withoutMwh).toBe(0);
    expect(project({ ...stats, avg_monthly_kwh: -10 }, 100, 50).withoutMwh).toBe(0);
  });
  it("never goes below zero use", () => {
    expect(project({ ...stats, avg_monthly_kwh: 1, kwh_saved: { low: 5, mid: 50, high: 90 } }, 100, 100).withMwh).toBe(0);
  });
});
