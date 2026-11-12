// The game layer, worked out from the household's own action history (GET /api/actions/mine) so it
// never invents points: what was done today, which days this week kept the streak, and progress on
// the weekly quests. Days and weeks run on India time, like the rest of Nidhi.
import type { ActionLog } from "@/lib/api";

const IST_MS = 330 * 60_000;

/** "2026-11-11" for the India-time day of `d`. */
export function istDay(d: Date | string): string {
  const t = (typeof d === "string" ? new Date(d) : d).getTime();
  return new Date(t + IST_MS).toISOString().slice(0, 10);
}

/** The seven India-time days of this week, Monday first. */
export function thisWeek(now = new Date()): string[] {
  const ist = new Date(now.getTime() + IST_MS);
  const monday = new Date(ist);
  monday.setUTCDate(ist.getUTCDate() - ((ist.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const counts = (log: ActionLog) => log.status !== "rejected";

export interface Today {
  day: string;
  logs: ActionLog[];
  points: number;
  co2Kg: number;
}

export function today(logs: ActionLog[], now = new Date()): Today {
  const day = istDay(now);
  const mine = logs.filter((l) => counts(l) && istDay(l.created_at) === day);
  return {
    day,
    logs: mine,
    points: mine.reduce((s, l) => s + l.points_awarded, 0),
    co2Kg: mine.reduce((s, l) => s + l.co2_saved_kg, 0),
  };
}

/** One entry per day this week: did anything count that day, and is it today. */
export function weekFlames(logs: ActionLog[], now = new Date()) {
  const active = new Set(logs.filter(counts).map((l) => istDay(l.created_at)));
  const todayKey = istDay(now);
  return thisWeek(now).map((day) => ({ day, lit: active.has(day), isToday: day === todayKey, future: day > todayKey }));
}

export const CHEST_GOAL = 3;

export type QuestCode = "log10" | "photos2" | "peak3" | "themes3";

export interface Quest {
  code: QuestCode;
  have: number;
  need: number;
  done: boolean;
}

/** This week's quests and how far along each one is. */
export function weeklyQuests(logs: ActionLog[], now = new Date()): Quest[] {
  const week = new Set(thisWeek(now));
  const mine = logs.filter((l) => counts(l) && week.has(istDay(l.created_at)));
  const q = (code: QuestCode, have: number, need: number): Quest => ({ code, have: Math.min(have, need), need, done: have >= need });
  return [
    q("log10", mine.length, 10),
    q("photos2", mine.filter((l) => l.status === "verified").length, 2),
    q("peak3", mine.filter((l) => l.action.code === "shift_heavy_load").length, 3),
    q("themes3", new Set(mine.map((l) => l.action.category)).size, 3),
  ];
}

/** Journey stage from the server's level number: Seed, Sprout, Sapling, Tree, Grove. */
export function stage(level: number): number {
  return Math.max(0, Math.min(4, level - 1));
}

/** Points where each journey stage starts, matching the server (services/gamification.py). */
export const STAGE_AT = [0, 100, 300, 700, 1500] as const;
export const STAGE_KEYS = ["stage.seed", "stage.sprout", "stage.sapling", "stage.tree", "stage.grove"] as const;

export interface StageProgress {
  /** 0 (Seed) to 4 (Grove). */
  index: number;
  /** Points still needed for the next stage; 0 at Grove. */
  toNext: number;
  /** How far through the current stage, 0 to 1 (1 at Grove). */
  share: number;
}

/** Where a household is on the journey for a points total. Negative or missing points count as 0. */
export function stageProgress(points: number): StageProgress {
  const p = Number.isFinite(points) && points > 0 ? points : 0;
  let index = 0;
  STAGE_AT.forEach((at, i) => {
    if (p >= at) index = i;
  });
  if (index === STAGE_AT.length - 1) return { index, toNext: 0, share: 1 };
  const from = STAGE_AT[index];
  const to = STAGE_AT[index + 1];
  return { index, toNext: to - p, share: (p - from) / (to - from) };
}
