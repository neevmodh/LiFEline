// Measuring a roof on a satellite map: the area inside the points someone taps, and where to send the
// answer back. Pure, so it's unit-tested.

export type LatLng = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Area in m² of the polygon through these points, on the sphere (the same formula as Leaflet.draw and
 * Turf). Accurate to well under 1% for something the size of a roof.
 */
export function polygonAreaSqm(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lon1] = points[i];
    const [lat2, lon2] = points[(i + 1) % points.length];
    sum += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Roofs are typed in whole square metres; the calculator takes 1 to 5,000. */
export function roofAreaForCalculator(points: LatLng[]): number | null {
  const a = Math.round(polygonAreaSqm(points));
  return a >= 1 && a <= 5000 ? a : null;
}

/**
 * Only send the answer back to Nidhi's own app: its web address or the phone app's nidhi:// link.
 * Anything else falls back to the web app, so this page can't be used to redirect people elsewhere.
 */
export function returnUrl(requested: string | null, area: number, fallback: string): string {
  const allowed = (u: URL) =>
    u.protocol === "nidhi:" || (u.protocol === "https:" && /(^|\.)nidhi-app-rosy\.vercel\.app$/.test(u.hostname)) ||
    (u.protocol === "http:" && u.hostname === "localhost");
  let target: URL;
  try {
    target = new URL(requested ?? "");
    if (!allowed(target)) throw new Error("not ours");
  } catch {
    target = new URL(fallback);
  }
  target.searchParams.set("roof", String(area));
  return target.toString();
}
