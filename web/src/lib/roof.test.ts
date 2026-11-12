import { describe, expect, it } from "vitest";

import { polygonAreaSqm, returnUrl, roofAreaForCalculator, type LatLng } from "./roof";

// A 10 m × 10 m square in Ahmedabad: 10 m is 1/111,320 of a degree of latitude, and of longitude
// times cos(latitude).
const lat = 23.03;
const dLat = 10 / 111_320;
const dLon = 10 / (111_320 * Math.cos((lat * Math.PI) / 180));
const square: LatLng[] = [[lat, 72.58], [lat, 72.58 + dLon], [lat + dLat, 72.58 + dLon], [lat + dLat, 72.58]];

describe("polygonAreaSqm", () => {
  it("measures a 10 m square as 100 m² within 1%", () => {
    expect(polygonAreaSqm(square)).toBeGreaterThan(99);
    expect(polygonAreaSqm(square)).toBeLessThan(101);
  });
  it("doesn't care which way round the points go", () => {
    expect(polygonAreaSqm([...square].reverse())).toBeCloseTo(polygonAreaSqm(square), 6);
  });
  it("is zero for fewer than three points", () => {
    expect(polygonAreaSqm([])).toBe(0);
    expect(polygonAreaSqm(square.slice(0, 2))).toBe(0);
  });
});

describe("roofAreaForCalculator", () => {
  it("rounds to whole m² and refuses areas the calculator can't take", () => {
    expect(roofAreaForCalculator(square)).toBe(100);
    expect(roofAreaForCalculator(square.slice(0, 2))).toBeNull();
    const huge: LatLng[] = [[23, 72], [23, 72.01], [23.01, 72.01], [23.01, 72]];
    expect(roofAreaForCalculator(huge)).toBeNull();
  });
});

describe("returnUrl", () => {
  const fallback = "https://nidhi-app-rosy.vercel.app/solar";
  it("sends the area back to the app", () => {
    expect(returnUrl("https://nidhi-app-rosy.vercel.app/solar", 42, fallback)).toBe("https://nidhi-app-rosy.vercel.app/solar?roof=42");
    expect(returnUrl("nidhi://solar", 42, fallback)).toBe("nidhi://solar?roof=42");
    expect(returnUrl("http://localhost:8081/solar?x=1", 7, fallback)).toBe("http://localhost:8081/solar?x=1&roof=7");
  });
  it("never redirects anywhere else", () => {
    for (const bad of ["https://evil.example/solar", "https://nidhi-app-rosy.vercel.app.evil.example/", "javascript:alert(1)", "", null, "not a url"]) {
      expect(returnUrl(bad, 5, fallback)).toBe(`${fallback}?roof=5`);
    }
  });
});
