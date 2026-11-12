// "What if": the bill recomputed on the phone as the levers change. billFor mirrors the server's
// electricity_bill_rs (backend/app/services/footprint.py): telescopic slabs, fixed charge, FPPAS on
// every unit, then electricity duty on the lot. The levers' kWh come from GET /api/bill/xray.
import type { BillXray, Tariff } from "@/lib/api";

export function billFor(kwh: number, t: Tariff): number {
  const units = Number.isFinite(kwh) && kwh > 0 ? kwh : 0;
  let energy = 0;
  let lower = 0;
  for (const [upper, rate] of t.slabs) {
    if (units <= lower) break;
    const top = upper ?? Number.POSITIVE_INFINITY;
    energy += (Math.min(units, top) - lower) * rate;
    lower = top;
  }
  const beforeDuty = energy + t.fixed_rs + units * t.fppas_rs_per_kwh;
  return Math.round(beforeDuty * (1 + t.duty_share) * 100) / 100;
}

export interface Levers {
  /** Degrees the AC is set higher (0 to 4). */
  acDegrees: number;
  geyserOff: boolean;
  standbyOff: boolean;
  /** Old bulbs swapped for LEDs (0 to 10). */
  leds: number;
  /** Rooftop solar in kW (0 to 5, in halves). */
  solarKw: number;
}

export const NO_CHANGE: Levers = { acDegrees: 0, geyserOff: false, standbyOff: false, leds: 0, solarKw: 0 };

/** A tree takes up about 21 kg of CO₂ a year. */
export const KG_CO2_PER_TREE_YEAR = 21;

export interface WhatIf {
  kwh: number;
  savedKwh: number;
  billRs: number;
  savedRs: number;
  savedKgMonth: number;
  treesYear: number;
}

export function whatIf(x: Pick<BillXray, "kwh" | "tariff" | "levers" | "grid_kg_per_kwh">, l: Levers): WhatIf {
  const v = x.levers;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
  const habits =
    clamp(l.acDegrees, 0, 4) * v.ac_kwh_per_degree +
    (l.geyserOff ? v.geyser_kwh : 0) +
    (l.standbyOff ? v.standby_kwh : 0) +
    clamp(Math.round(l.leds), 0, 10) * v.led_kwh_each;
  const solar = clamp(l.solarKw, 0, 5) * v.solar_kwh_per_kw;
  // Savings can't take a home below zero units; extra solar is exported, not counted here.
  const kwh = Math.max(0, x.kwh - habits - solar);
  const savedKwh = x.kwh - kwh;
  const before = billFor(x.kwh, x.tariff);
  const after = billFor(kwh, x.tariff);
  const savedKgMonth = savedKwh * x.grid_kg_per_kwh;
  return {
    kwh: Math.round(kwh),
    savedKwh: Math.round(savedKwh),
    billRs: Math.round(after),
    savedRs: Math.round(before - after),
    savedKgMonth: Math.round(savedKgMonth * 10) / 10,
    treesYear: Math.round((savedKgMonth * 12) / KG_CO2_PER_TREE_YEAR),
  };
}
