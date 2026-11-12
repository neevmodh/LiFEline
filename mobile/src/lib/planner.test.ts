import { describe, expect, it } from "vitest";

import { APPLIANCES, appliancesFor, bestStart, hourlyIndex, inPeak, kgPerRun, touchesPeak, windowIndex } from "./planner";

const sunnyDay = { 7: 0.1, 8: 0.3, 9: 0.5, 10: 0.65, 11: 0.75, 12: 0.8, 13: 0.78, 14: 0.7, 15: 0.55, 16: 0.35, 17: 0.15 };
const washing = APPLIANCES.find((a) => a.code === "washing")!;
const ev = APPLIANCES.find((a) => a.code === "ev")!;

describe("hourlyIndex", () => {
  const idx = hourlyIndex(sunnyDay);
  it("has 24 hours, cleanest at the sunniest hour and dirtiest in the peak", () => {
    expect(idx).toHaveLength(24);
    expect(Math.min(...idx)).toBe(idx[12]);
    expect(idx[12]).toBeCloseTo(0.7, 3);
    expect(idx[19]).toBeCloseTo(1.15, 3);
    expect(idx[3]).toBe(1);
  });
  it("is flat outside the peak with no sun at all, and ignores nonsense", () => {
    const night = hourlyIndex({});
    expect(night.filter((v, h) => !inPeak(h)).every((v) => v === 1)).toBe(true);
    expect(hourlyIndex({ 12: Number.NaN, 13: -4 })[12]).toBe(1);
  });
});

describe("windows", () => {
  const idx = hourlyIndex(sunnyDay);
  it("averages over the run and wraps past midnight", () => {
    expect(windowIndex(idx, 11, 3)).toBeCloseTo((idx[11] + idx[12] + idx[13]) / 3, 6);
    expect(windowIndex(idx, 23, 3)).toBeCloseTo((idx[23] + idx[0] + idx[1]) / 3, 6);
  });
  it("knows when a run touches the evening peak", () => {
    expect(touchesPeak(18, 1)).toBe(true);
    expect(touchesPeak(16, 3)).toBe(true);
    expect(touchesPeak(22, 1)).toBe(false);
    expect(touchesPeak(12, 1)).toBe(false);
  });
  it("picks the sunniest start in waking hours", () => {
    expect(bestStart(idx, washing)).toBe(12);
    expect(bestStart(idx, ev)).toBe(11); // 11-2 PM beats 12-3 PM
    expect(bestStart(hourlyIndex({}), washing)).toBe(6); // a flat day: the first allowed hour
  });
  it("prices a run in kg CO₂, less at noon than in the peak", () => {
    expect(kgPerRun(idx, washing, 12)).toBeLessThan(kgPerRun(idx, washing, 19));
    expect(kgPerRun(hourlyIndex({}), washing, 3)).toBe(0.36); // 0.5 kWh × 0.71, to two places
  });
});

describe("appliancesFor", () => {
  it("lists only what the home has, plus iron and pump", () => {
    expect(appliancesFor({ has_washing_machine: false, has_geyser: true, has_ev: false }).map((a) => a.code)).toEqual(["geyser", "iron", "pump"]);
    expect(appliancesFor({ has_washing_machine: true, has_geyser: true, has_ev: true })).toHaveLength(5);
  });
});
