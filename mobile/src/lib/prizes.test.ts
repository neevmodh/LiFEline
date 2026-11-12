import { describe, expect, it } from "vitest";

import type { Badge } from "@/lib/api";

import { log } from "./fixtures.test-utils";
import { newlyWon, prizes, type PrizeInput } from "./prizes";

const badge = (earned: boolean): Badge => ({ code: "x", earned, progress: earned ? 1 : 0, target: 1 }) as Badge;
const base: PrizeInput = { points: 0, streakDays: 0, logs: [], badges: [] };
const byCode = (input: PrizeInput) => Object.fromEntries(prizes(input).map((p) => [p.code, p]));

describe("prizes", () => {
  it("lists eight prizes, none won for a new household", () => {
    const list = prizes(base);
    expect(list).toHaveLength(8);
    expect(list.every((p) => !p.won && p.have === 0 && p.share === 0)).toBe(true);
    expect(new Set(list.map((p) => p.tier))).toEqual(new Set(["bronze", "silver", "gold"]));
  });

  it("wins at exactly the target, not one short", () => {
    expect(byCode({ ...base, points: 299 }).sapling_cup.won).toBe(false);
    expect(byCode({ ...base, points: 300 }).sapling_cup.won).toBe(true);
    expect(byCode({ ...base, streakDays: 6 }).week_flame.won).toBe(false);
    expect(byCode({ ...base, streakDays: 7 }).week_flame.won).toBe(true);
  });

  it("never counts rejected logs", () => {
    const rejected = Array.from({ length: 10 }, () => log({ status: "rejected", code: "shift_heavy_load", co2_saved_kg: 10 }));
    const p = byCode({ ...base, logs: rejected });
    expect(p.first_step.won).toBe(false);
    expect(p.peak_hero.have).toBe(0);
    expect(p.carbon_cutter.have).toBe(0);
  });

  it("only counts GEDA-verified photos for proof pro", () => {
    const logs = [log({ status: "verified" }), log({ status: "verified" }), log({ status: "pending" }), log({ status: "self_reported" })];
    expect(byCode({ ...base, logs }).proof_pro).toMatchObject({ have: 2, won: false });
    expect(byCode({ ...base, logs: [...logs, log({ status: "verified" })] }).proof_pro.won).toBe(true);
  });

  it("caps progress at the target and keeps share between 0 and 1", () => {
    const p = byCode({ ...base, points: 10_000 });
    expect(p.grove_crown).toMatchObject({ have: 1500, need: 1500, won: true, share: 1 });
  });

  it("rounds CO₂ down, so 24.9 kg is not 25", () => {
    const logs = [log({ co2_saved_kg: 24.9 })];
    expect(byCode({ ...base, logs }).carbon_cutter).toMatchObject({ have: 24, won: false });
  });

  it("treats bad numbers from the server as zero", () => {
    const p = byCode({ ...base, points: Number.NaN, streakDays: -3, logs: [log({ co2_saved_kg: Number.NaN })] });
    expect(p.sapling_cup.have).toBe(0);
    expect(p.week_flame.have).toBe(0);
    expect(p.carbon_cutter.have).toBe(0);
  });

  it("counts earned badges only", () => {
    const badges = [badge(true), badge(true), badge(true), badge(true), badge(false), badge(false)];
    expect(byCode({ ...base, badges }).badge_collector).toMatchObject({ have: 4, won: false });
    expect(byCode({ ...base, badges: [...badges, badge(true)] }).badge_collector.won).toBe(true);
  });
});

describe("newlyWon", () => {
  it("returns won prizes that weren't seen, in list order", () => {
    const list = prizes({ ...base, points: 400, logs: [log()] });
    expect(newlyWon(list, new Set()).map((p) => p.code)).toEqual(["first_step", "sapling_cup"]);
    expect(newlyWon(list, new Set(["first_step"])).map((p) => p.code)).toEqual(["sapling_cup"]);
    expect(newlyWon(list, new Set(["first_step", "sapling_cup"]))).toEqual([]);
  });
});
