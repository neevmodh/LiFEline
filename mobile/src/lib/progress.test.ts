import { describe, expect, it } from "vitest";

import type { Reading } from "@/lib/api";

import { goalStatus, monthKey, parseUnits, summarise } from "./progress";

const r = (month: string, kwh: number): Reading => ({ month, kwh, kg_co2: kwh * 0.7, bill_rs: kwh * 6, change_vs_baseline_pct: 0 });

describe("summarise", () => {
  it("is empty with no readings", () => {
    expect(summarise([], 200)).toEqual({ latest: null, changePct: null, best: null, monthsBelowInARow: 0, savedKwh: 0, hasTrend: false });
  });

  it("compares the latest month with the baseline, whatever order the readings come in", () => {
    const s = summarise([r("2026-11", 180), r("2026-09", 210), r("2026-10", 190)], 200);
    expect(s.latest?.month).toBe("2026-11");
    expect(s.changePct).toBe(-10);
    expect(s.savedKwh).toBe(20);
    expect(s.best?.month).toBe("2026-11");
    expect(s.monthsBelowInARow).toBe(2);
    expect(s.hasTrend).toBe(true);
  });

  it("counts a month exactly at the baseline as below, and an increase as no saving", () => {
    expect(summarise([r("2026-10", 200)], 200).monthsBelowInARow).toBe(1);
    const up = summarise([r("2026-10", 250)], 200);
    expect(up.changePct).toBe(25);
    expect(up.savedKwh).toBe(0);
    expect(up.monthsBelowInARow).toBe(0);
  });

  it("has no percentage without a usable baseline", () => {
    for (const base of [0, -5, null, undefined, Number.NaN]) {
      const s = summarise([r("2026-10", 150)], base);
      expect(s.changePct).toBeNull();
      expect(s.monthsBelowInARow).toBe(0);
    }
  });

  it("ignores broken readings", () => {
    const s = summarise([r("2026-10", Number.NaN), r("bad", 100), r("2026-11", -3), r("2026-09", 190)], 200);
    expect(s.latest?.month).toBe("2026-09");
    expect(s.hasTrend).toBe(false);
  });
});

describe("monthKey", () => {
  it("steps back across a year boundary", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    expect(monthKey(now)).toBe("2026-01");
    expect(monthKey(now, 1)).toBe("2025-12");
    expect(monthKey(now, 13)).toBe("2024-12");
  });
});

describe("parseUnits", () => {
  it("accepts whole units with separators and rejects nonsense", () => {
    expect(parseUnits("240")).toBe(240);
    expect(parseUnits("1,240")).toBe(1240);
    expect(parseUnits(" 99.6 ")).toBe(100);
    for (const bad of ["", "abc", "0", "-5", "20001", "1e9"]) expect(parseUnits(bad)).toBeNull();
  });
});

describe("goalStatus", () => {
  it("works out the target and how far there is to go", () => {
    expect(goalStatus(300, 300, 10)).toEqual({ target: 270, toGo: 30, onTrack: false });
    expect(goalStatus(260, 300, 10)).toEqual({ target: 270, toGo: 0, onTrack: true });
    expect(goalStatus(270, 300, 10)?.onTrack).toBe(true);
  });
  it("has no status without a goal or a start", () => {
    for (const [base, pct] of [[300, null], [300, 0], [300, 100], [0, 10], [null, 10]] as const) expect(goalStatus(250, base, pct)).toBeNull();
  });
  it("knows the target before the first bill", () => {
    expect(goalStatus(null, 400, 20)).toEqual({ target: 320, toGo: 0, onTrack: false });
  });
});
