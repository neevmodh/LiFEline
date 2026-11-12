import { describe, expect, it } from "vitest";

import type { Tariff } from "@/lib/api";

import { billFor, NO_CHANGE, whatIf } from "./whatif";

const urban: Tariff = { slabs: [[50, 3.05], [100, 3.5], [250, 4.15], [null, 5.2]], fixed_rs: 15, fppas_rs_per_kwh: 2.45, duty_share: 0.15 };
const rural: Tariff = { slabs: [[50, 2.65], [100, 3.1], [250, 3.75], [null, 4.9]], fixed_rs: 15, fppas_rs_per_kwh: 2.45, duty_share: 0.075 };
const torrent: Tariff = { slabs: [[50, 3.2], [200, 3.95], [null, 5.0]], fixed_rs: 25, fppas_rs_per_kwh: 2.45, duty_share: 0.15 };

describe("billFor matches the server's electricity_bill_rs", () => {
  // Values printed by backend/app/services/footprint.py for the same units.
  const cases: [Tariff, number[]][] = [
    [urban, [17.25, 327.17, 827.42, 1822.92, 2254.0, 10171.75]],
    [rural, [16.12, 284.77, 721.86, 1596.21, 1983.38, 9094.5]],
    [torrent, [28.75, 347.13, 868.82, 1894.57, 2314.38, 10025.12]],
  ];
  const units = [0, 49, 120, 251, 300, 1200];
  it.each(cases)("for each slab boundary", (tariff, expected) => {
    units.forEach((u, i) => expect(billFor(u, tariff)).toBeCloseTo(expected[i], 1));
  });
  it("treats negative and broken units as zero", () => {
    expect(billFor(-10, urban)).toBe(billFor(0, urban));
    expect(billFor(Number.NaN, urban)).toBe(billFor(0, urban));
  });
});

const x = {
  kwh: 300,
  tariff: urban,
  grid_kg_per_kwh: 0.71,
  levers: { ac_kwh_per_degree: 10.37, geyser_kwh: 24, standby_kwh: 9, led_kwh_each: 6.12, solar_kwh_per_kw: 129.2 },
};

describe("whatIf", () => {
  it("changes nothing with no levers", () => {
    expect(whatIf(x, NO_CHANGE)).toMatchObject({ kwh: 300, savedKwh: 0, savedRs: 0, savedKgMonth: 0, treesYear: 0 });
  });

  it("adds up the habits and prices them at the household's own slabs", () => {
    const w = whatIf(x, { acDegrees: 2, geyserOff: true, standbyOff: true, leds: 5, solarKw: 0 });
    const saved = 2 * 10.37 + 24 + 9 + 5 * 6.12;
    expect(w.savedKwh).toBe(Math.round(saved));
    expect(w.savedRs).toBe(Math.round(billFor(300, urban) - billFor(300 - saved, urban)));
    expect(w.savedKgMonth).toBeCloseTo(saved * 0.71, 0);
  });

  it("never goes below zero units, however much solar", () => {
    const w = whatIf(x, { ...NO_CHANGE, solarKw: 5 });
    expect(w.kwh).toBe(0);
    expect(w.savedKwh).toBe(300);
    expect(w.billRs).toBe(Math.round(billFor(0, urban)));
  });

  it("clamps levers to their range", () => {
    const wild = whatIf(x, { acDegrees: 99, geyserOff: false, standbyOff: false, leds: -4, solarKw: Number.NaN });
    expect(wild.savedKwh).toBe(Math.round(4 * 10.37));
  });

  it("counts trees from a year of savings", () => {
    const w = whatIf(x, { ...NO_CHANGE, solarKw: 1 });
    expect(w.treesYear).toBe(Math.round((129.2 * 0.71 * 12) / 21));
  });
});
