// Test helpers: an action log with sensible defaults.
import type { ActionLog } from "@/lib/api";

let nextId = 1;

export function log(over: Partial<Omit<ActionLog, "action">> & { code?: string; category?: string } = {}): ActionLog {
  const { code = "ac_24", category = "energy", ...rest } = over;
  return {
    id: nextId++,
    action: { code, category } as ActionLog["action"],
    status: "self_reported",
    points_awarded: 10,
    co2_saved_kg: 1,
    kwh_saved: 1,
    is_daily_challenge: false,
    note: null,
    has_proof: false,
    created_at: "2026-11-12T06:00:00Z",
    ...rest,
  };
}
