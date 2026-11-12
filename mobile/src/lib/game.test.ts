import { describe, expect, it } from "vitest";

import { log } from "./fixtures.test-utils";
import { istDay, stage, stageProgress, STAGE_AT, thisWeek, today, weekFlames, weeklyQuests } from "./game";

describe("istDay", () => {
  it("rolls over at midnight India time, not UTC", () => {
    expect(istDay("2026-11-11T18:29:59Z")).toBe("2026-11-11"); // 23:59:59 IST
    expect(istDay("2026-11-11T18:30:00Z")).toBe("2026-11-12"); // 00:00 IST
  });
});

describe("thisWeek", () => {
  it("starts on Monday, also when today is Sunday", () => {
    const sunday = new Date("2026-11-15T10:00:00Z"); // Sunday in India
    const week = thisWeek(sunday);
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-11-09");
    expect(week[6]).toBe("2026-11-15");
  });
  it("crosses a month boundary", () => {
    expect(thisWeek(new Date("2026-12-02T06:00:00Z"))[0]).toBe("2026-11-30");
  });
});

describe("today", () => {
  const now = new Date("2026-11-12T08:00:00Z");
  it("adds up only today's logs and skips rejected ones", () => {
    const t = today(
      [
        log({ points_awarded: 12, co2_saved_kg: 2 }),
        log({ points_awarded: 5, status: "rejected" }),
        log({ points_awarded: 7, created_at: "2026-11-11T06:00:00Z" }),
        log({ points_awarded: 3, status: "pending" }),
      ],
      now,
    );
    expect(t.logs).toHaveLength(2);
    expect(t.points).toBe(15);
    expect(t.co2Kg).toBe(2 + 1);
  });
  it("is empty with no history", () => {
    expect(today([], now)).toMatchObject({ logs: [], points: 0, co2Kg: 0 });
  });
});

describe("weekFlames", () => {
  it("lights days with a counted log and marks today and the future", () => {
    const now = new Date("2026-11-12T08:00:00Z"); // Thursday
    const flames = weekFlames([log({ created_at: "2026-11-10T06:00:00Z" }), log({ created_at: "2026-11-11T06:00:00Z", status: "rejected" })], now);
    expect(flames.map((f) => f.lit)).toEqual([false, true, false, false, false, false, false]);
    expect(flames[3].isToday).toBe(true);
    expect(flames.filter((f) => f.future)).toHaveLength(3);
  });
});

describe("weeklyQuests", () => {
  const now = new Date("2026-11-12T08:00:00Z");
  it("counts this week only, caps progress and ignores rejected logs", () => {
    const logs = [
      ...Array.from({ length: 12 }, () => log()),
      log({ status: "verified" }),
      log({ status: "rejected", code: "shift_heavy_load" }),
      log({ code: "shift_heavy_load", category: "energy" }),
      log({ code: "save_water", category: "water" }),
      log({ code: "cloth_bag", category: "plastic", created_at: "2026-11-01T06:00:00Z" }), // last week
    ];
    const q = Object.fromEntries(weeklyQuests(logs, now).map((x) => [x.code, x]));
    expect(q.log10).toMatchObject({ have: 10, need: 10, done: true });
    expect(q.photos2).toMatchObject({ have: 1, done: false });
    expect(q.peak3).toMatchObject({ have: 1, done: false });
    expect(q.themes3).toMatchObject({ have: 2, done: false });
  });
});

describe("stageProgress", () => {
  it("starts at Seed with nothing", () => {
    expect(stageProgress(0)).toEqual({ index: 0, toNext: 100, share: 0 });
  });
  it("treats negative, NaN and Infinity as no points", () => {
    for (const bad of [-50, Number.NaN, Number.POSITIVE_INFINITY]) expect(stageProgress(bad).index).toBe(0);
  });
  it("moves up exactly at each threshold", () => {
    STAGE_AT.forEach((at, i) => {
      expect(stageProgress(at).index).toBe(i);
      if (at > 0) expect(stageProgress(at - 1).index).toBe(i - 1);
    });
  });
  it("reports the share through the current stage", () => {
    expect(stageProgress(200)).toEqual({ index: 1, toNext: 100, share: 0.5 });
  });
  it("tops out at Grove", () => {
    expect(stageProgress(99_999)).toEqual({ index: 4, toNext: 0, share: 1 });
  });
  it("agrees with the server's level number", () => {
    expect(stage(1)).toBe(0);
    expect(stage(5)).toBe(4);
    expect(stage(9)).toBe(4);
    expect(stage(0)).toBe(0);
  });
});
