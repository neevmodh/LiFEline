// The district map's maths, kept free of React so it is unit-tested.

export const RAMP_STEPS = 5;

/**
 * Colour band for a district: -1 when it has nothing yet, else 0 to 4 by its share of the leading
 * district's progress, so the map shows who is ahead even early in the month.
 */
export function rampIndex(pct: number | undefined, maxPct: number): number {
  if (pct === undefined || !Number.isFinite(pct) || pct <= 0) return -1;
  const top = Number.isFinite(maxPct) && maxPct > 0 ? maxPct : pct;
  return Math.min(RAMP_STEPS - 1, Math.floor((pct / top) * RAMP_STEPS));
}

export type Polygon = [number, number][];

/** "M1 2L3 4L5 6ZM…" (as scripts/build-map.py writes it) to polygons. */
export function parsePath(d: string): Polygon[] {
  return d
    .split("M")
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/Z/g, "")
        .split("L")
        .map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
    )
    .filter((poly) => poly.length >= 3);
}

/** Even-odd ray casting. */
export function insidePolygon(x: number, y: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The district under a point, or null for the sea or outside Gujarat. */
export function districtAt(x: number, y: number, shapes: { name: string; polygons: Polygon[] }[]): string | null {
  for (const s of shapes) if (s.polygons.some((p) => insidePolygon(x, y, p))) return s.name;
  return null;
}
