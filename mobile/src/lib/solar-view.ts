// The solar screen's small rules: where the roof measurer lives, reading its answer back, the survey
// request's steps, and the hour labels for today's output. Pure, so they're unit-tested.
import type { LeadStatus } from "@/lib/api";

/** The website (it hosts the roof measurer), from the console address the build already knows. */
export function websiteBase(consoleUrl: string | undefined): string {
  const base = (consoleUrl ?? "https://nidhi-gujarat.vercel.app/geda").replace(/\/+$/, "");
  return base.replace(/\/geda$/, "");
}

export function roofMeasureUrl(website: string, returnTo: string, lat?: number | null, lon?: number | null): string {
  const u = new URL("/roof", website);
  u.searchParams.set("return", returnTo);
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    u.searchParams.set("lat", lat.toFixed(5));
    u.searchParams.set("lon", lon.toFixed(5));
  }
  return u.toString();
}

/** The roof area the measurer sent back (?roof=NN), if it's one the calculator accepts. */
export function roofFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  try {
    const value = new URL(url).searchParams.get("roof");
    return parseRoof(value);
  } catch {
    return null;
  }
}

export function parseRoof(value: string | string[] | null | undefined): number | null {
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 1 && n <= 5000 ? Math.round(n) : null;
}

/** The survey request's steps in order; "dropped" leaves the line. */
export const LEAD_STEPS: LeadStatus[] = ["new", "contacted", "survey_done", "quoted", "installed"];

export function leadStepIndex(status: LeadStatus): number {
  return LEAD_STEPS.indexOf(status);
}

/** A request is finished once installed or dropped; then a new one can be made. */
export function leadIsOpen(status: LeadStatus | undefined | null): boolean {
  return !!status && status !== "installed" && status !== "dropped";
}

/** "1 PM" from 13. */
export function hourLabel(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  return `${((hour + 11) % 12) + 1} ${hour < 12 ? "AM" : "PM"}`;
}

/** Today's hours with any output, in order, scaled to a system size. */
export function todaySeries(hours: Record<string, number>, kwp: number): { hour: number; kwh: number }[] {
  const size = Number.isFinite(kwp) && kwp > 0 ? kwp : 1;
  return Object.entries(hours)
    .map(([h, v]) => ({ hour: Number(h), kwh: Math.round(v * size * 100) / 100 }))
    .filter((x) => Number.isInteger(x.hour) && x.hour >= 0 && x.hour < 24 && x.kwh > 0)
    .sort((a, b) => a.hour - b.hour);
}
