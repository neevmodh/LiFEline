// Prizes: trophies a household wins by doing things, shown on Me and celebrated when one is won.
// Worked out only from what the server already counted (dashboard, badges, action history), so a
// prize can never be won with points the server didn't award. Rejected logs never count.
import type { ActionLog, Badge } from "@/lib/api";

export type PrizeTier = "bronze" | "silver" | "gold";

export type PrizeCode =
  | "first_step"
  | "week_flame"
  | "proof_pro"
  | "peak_hero"
  | "sapling_cup"
  | "carbon_cutter"
  | "badge_collector"
  | "grove_crown";

export interface Prize {
  code: PrizeCode;
  tier: PrizeTier;
  have: number;
  need: number;
  won: boolean;
  /** 0 to 1. */
  share: number;
}

export interface PrizeInput {
  points: number;
  streakDays: number;
  logs: ActionLog[];
  badges: Badge[];
}

const RULES: { code: PrizeCode; tier: PrizeTier; need: number; have: (x: PrizeInput, counted: ActionLog[]) => number }[] = [
  { code: "first_step", tier: "bronze", need: 1, have: (_, l) => l.length },
  { code: "week_flame", tier: "bronze", need: 7, have: (x) => x.streakDays },
  { code: "proof_pro", tier: "silver", need: 3, have: (_, l) => l.filter((a) => a.status === "verified").length },
  { code: "peak_hero", tier: "silver", need: 5, have: (_, l) => l.filter((a) => a.action.code === "shift_heavy_load").length },
  { code: "sapling_cup", tier: "silver", need: 300, have: (x) => x.points },
  { code: "carbon_cutter", tier: "gold", need: 25, have: (_, l) => Math.floor(l.reduce((s, a) => s + a.co2_saved_kg, 0)) },
  { code: "badge_collector", tier: "gold", need: 5, have: (x) => x.badges.filter((b) => b.earned).length },
  { code: "grove_crown", tier: "gold", need: 1500, have: (x) => x.points },
];

const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function prizes(input: PrizeInput): Prize[] {
  const counted = input.logs.filter((l) => l.status !== "rejected");
  return RULES.map(({ code, tier, need, have }) => {
    const raw = safe(have(input, counted));
    return { code, tier, need, have: Math.min(raw, need), won: raw >= need, share: Math.min(raw / need, 1) };
  });
}

/** Prizes won now that weren't in `seen`, in the order they're listed. */
export function newlyWon(list: Prize[], seen: ReadonlySet<string>): Prize[] {
  return list.filter((p) => p.won && !seen.has(p.code));
}
