// When to run heavy appliances: a relative "how dirty is the grid" index for each hour of today,
// from the district's live solar forecast (sunnier hours are cleaner in Gujarat, which has the most
// solar of any state) and the evening peak (dirtiest, when fossil plants ramp up). Relative, not a
// measured grid series, and labelled so in the app. Pure, so it's unit-tested.

/** kg CO₂ per kWh on the grid on average (CEA), as on the server (factors.GRID_KG_CO2_PER_KWH). */
export const GRID_KG_PER_KWH = 0.71;
export const PEAK: [number, number] = [18, 22]; // 6 to 10 PM, as on the server (factors.PEAK_HOURS)
const SUN_CUT = 0.3; // the sunniest hour is up to 30% cleaner than average
const PEAK_ADD = 0.15; // peak hours are about 15% dirtier

export interface Appliance {
  code: "washing" | "geyser" | "iron" | "ev" | "pump";
  kw: number;
  hours: number;
}

export const APPLIANCES: Appliance[] = [
  { code: "washing", kw: 0.5, hours: 1 },
  { code: "geyser", kw: 2, hours: 1 },
  { code: "iron", kw: 1, hours: 1 },
  { code: "pump", kw: 0.75, hours: 1 },
  { code: "ev", kw: 3.3, hours: 3 },
];

/** The appliances this home has: washing machine, geyser and EV only if it said so; iron and pump always. */
export function appliancesFor(home: { has_washing_machine: boolean; has_geyser: boolean; has_ev: boolean }): Appliance[] {
  return APPLIANCES.filter((a) => (a.code === "washing" ? home.has_washing_machine : a.code === "geyser" ? home.has_geyser : a.code === "ev" ? home.has_ev : true));
}

export const inPeak = (h: number) => h >= PEAK[0] && h < PEAK[1];

/** 24 values around 1.0: below is cleaner than average, above is dirtier. */
export function hourlyIndex(sun: Record<string | number, number>): number[] {
  const values = Array.from({ length: 24 }, (_, h) => Math.max(0, Number(sun[h] ?? sun[String(h)] ?? 0)) || 0);
  const top = Math.max(...values);
  return values.map((v, h) => {
    const share = top > 0 ? v / top : 0;
    return Math.round((1 - SUN_CUT * share + (inPeak(h) ? PEAK_ADD : 0)) * 1000) / 1000;
  });
}

/** Mean index over the hours an appliance runs from `start`, wrapping past midnight. */
export function windowIndex(index: number[], start: number, hours: number): number {
  const n = Math.max(1, Math.round(hours));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += index[(((start + i) % 24) + 24) % 24] ?? 1;
  return sum / n;
}

export function touchesPeak(start: number, hours: number): boolean {
  return Array.from({ length: Math.max(1, Math.round(hours)) }, (_, i) => (start + i) % 24).some(inPeak);
}

/** The cleanest start between 6 AM and 10 PM (people don't run the washing machine at 3 AM). */
export function bestStart(index: number[], a: Appliance): number {
  let best = 6;
  for (let h = 6; h <= 22 - Math.round(a.hours); h++) if (windowIndex(index, h, a.hours) < windowIndex(index, best, a.hours) - 1e-9) best = h;
  return best;
}

/** kg CO₂ for one run starting at `start`. */
export function kgPerRun(index: number[], a: Appliance, start: number): number {
  return Math.round(a.kw * a.hours * GRID_KG_PER_KWH * windowIndex(index, start, a.hours) * 100) / 100;
}
