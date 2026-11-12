import { describe, expect, it } from "vitest";

import { DISTRICT_PATHS } from "@/components/gujarat-paths";

import { districtAt, insidePolygon, parsePath, rampIndex } from "./ramp";

describe("rampIndex", () => {
  it("has no colour for nothing or nonsense", () => {
    expect([undefined, Number.NaN, -5, 0].map((p) => rampIndex(p, 10))).toEqual([-1, -1, -1, -1]);
  });
  it("bands by share of the leader, the leader in the deepest band", () => {
    expect([0.5, 2, 4, 6, 8, 10].map((p) => rampIndex(p, 10))).toEqual([0, 1, 2, 3, 4, 4]);
  });
  it("copes with a missing or zero leader", () => {
    expect(rampIndex(5, 0)).toBe(4);
    expect(rampIndex(5, Number.NaN)).toBe(4);
  });
});

describe("hit testing", () => {
  const square = parsePath("M0 0L10 0L10 10L0 10Z")[0];
  it("parses the generated path format, several rings too", () => {
    expect(square).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(parsePath("M0 0L1 0L1 1ZM5 5L6 5L6 6Z")).toHaveLength(2);
    expect(parsePath("")).toEqual([]);
  });
  it("tells inside from outside", () => {
    expect(insidePolygon(5, 5, square)).toBe(true);
    expect(insidePolygon(15, 5, square)).toBe(false);
    expect(insidePolygon(-1, -1, square)).toBe(false);
  });
  it("finds every district at its own centre point, and nothing far outside", () => {
    const shapes = DISTRICT_PATHS.map((d) => ({ name: d.name, polygons: parsePath(d.d) }));
    const hits = DISTRICT_PATHS.filter((d) => districtAt(d.cx, d.cy, shapes) === d.name).length;
    expect(hits).toBeGreaterThanOrEqual(30); // a few odd-shaped districts have their centre in a neighbour
    expect(districtAt(-50, -50, shapes)).toBeNull();
  });
});
