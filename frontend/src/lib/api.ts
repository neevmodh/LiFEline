// Typed client for the EcoSetu FastAPI backend.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "ecosetu.token";

export type CommuteMode = "car" | "two_wheeler" | "bus" | "metro" | "cycle_walk";
export type Period = "week" | "month" | "all";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "citizen" | "admin";
  district_id: number | null;
  ward: string | null;
  onboarded: boolean;
}

export interface District {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export interface FootprintInput {
  monthly_kwh: number;
  members: number;
  lpg_cylinders_per_month: number;
  commute_mode: CommuteMode;
  commute_km_per_day: number;
}

export interface Footprint {
  electricity_kg: number;
  cooking_kg: number;
  commute_kg: number;
  total_kg: number;
  per_capita_kg: number;
  monthly_bill_rs: number;
}

export interface HouseholdInput extends FootprintInput {
  home_type: "apartment" | "independent" | "row_house";
  ac_count: number;
  has_geyser: boolean;
  has_washing_machine: boolean;
  has_ev: boolean;
  has_solar: boolean;
  roof_area_sqm: number | null;
}

export interface Household extends HouseholdInput {
  baseline_kg_co2_month: number;
}

export interface ActionType {
  id: number;
  code: string;
  title: string;
  description: string;
  category: string;
  points: number;
  co2_saved_kg: number;
  kwh_saved: number;
  max_per_day: number;
}

export interface ActionLog {
  id: number;
  action: ActionType;
  status: "self_reported" | "pending" | "verified" | "rejected";
  points_awarded: number;
  co2_saved_kg: number;
  is_daily_challenge: boolean;
  note: string | null;
  has_proof: boolean;
  created_at: string;
}

export interface DailyChallenge {
  date: string;
  action: ActionType;
  completed: boolean;
  multiplier: number;
}

export interface Nudge {
  code: string;
  title: string;
  body: string;
  category: "peak_shift" | "efficiency" | "mobility" | "progress";
  priority: number;
  action_code: string | null;
  tags: string[];
}

export interface Reading {
  month: string;
  kwh: number;
  kg_co2: number;
  bill_rs: number;
  change_vs_baseline_pct: number;
}

export interface Dashboard {
  user: User;
  footprint: Footprint;
  level: { level: number; title: string; points: number; next_level_at: number };
  streak_days: number;
  actions_logged: number;
  co2_saved_kg: number;
  kwh_saved: number;
  district_rank: number | null;
  district_participants: number;
  trend: { month: string; kwh: number; kg_co2: number }[];
  daily_challenge: DailyChallenge;
}

export interface UserRank {
  rank: number;
  user_id: number;
  name: string;
  district: string | null;
  ward: string | null;
  points: number;
  co2_saved_kg: number;
  is_me: boolean;
}

export interface DistrictRank {
  rank: number;
  district_id: number;
  district: string;
  participants: number;
  co2_saved_kg: number;
  co2_saved_per_participant_kg: number;
  monthly_goal_kg: number;
  goal_progress_pct: number;
}

export interface SolarInput {
  roof_area_sqm: number;
  monthly_kwh: number;
  district_id?: number | null;
}

export interface SolarEstimate {
  recommended_kwp: number;
  limited_by: "roof" | "consumption";
  specific_yield_kwh_per_kwp: number;
  yield_source: "pvgis" | "default";
  annual_generation_kwh: number;
  annual_savings_rs: number;
  gross_cost_rs: number;
  subsidy_rs: number;
  net_cost_rs: number;
  payback_years: number | null;
  annual_co2_avoided_kg: number;
  lifetime_savings_rs: number;
}

export interface AdminOverview {
  citizens: number;
  onboarded: number;
  active_7d: number;
  actions_total: number;
  co2_saved_total_kg: number;
  kwh_saved_total: number;
  pending_reviews: number;
  districts: {
    district_id: number;
    district: string;
    lat: number;
    lon: number;
    citizens: number;
    active_7d: number;
    actions_30d: number;
    co2_saved_30d_kg: number;
    avg_baseline_kg: number | null;
  }[];
  categories: { category: string; actions: number; co2_saved_kg: number }[];
  weekly: { week_start: string; actions: number; co2_saved_kg: number; active_citizens: number }[];
}

export interface ReviewItem {
  id: number;
  user_name: string;
  district: string | null;
  action_title: string;
  note: string | null;
  created_at: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session lasts until reload.
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the EcoSetu server. Is the backend running?");
  }
  if (resp.status === 204) return undefined as T;
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new ApiError(resp.status, errorMessage(body, `Request failed (${resp.status})`));
  return body as T;
}

const json = (data: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(data) });

export const api = {
  districts: () => request<District[]>("/api/districts"),
  register: (data: { email: string; password: string; name: string; district_id: number; ward?: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", json(data)),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", json(data)),
  me: () => request<User>("/api/auth/me"),

  previewFootprint: (data: FootprintInput) => request<Footprint>("/api/footprint/preview", json(data)),
  saveHousehold: (data: HouseholdInput) =>
    request<{ household: Household; footprint: Footprint }>("/api/household", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  household: () => request<{ household: Household; footprint: Footprint }>("/api/household"),
  readings: () => request<Reading[]>("/api/readings"),
  addReading: (data: { month: string; kwh: number }) => request<Reading>("/api/readings", json(data)),
  dashboard: () => request<Dashboard>("/api/dashboard"),
  nudges: () => request<{ temperature_c: number | null; generated_at: string; nudges: Nudge[] }>("/api/nudges"),

  actionTypes: () => request<ActionType[]>("/api/actions/types"),
  myActions: () => request<ActionLog[]>("/api/actions/mine"),
  logAction: (code: string, note?: string, proof?: File | null) => {
    const form = new FormData();
    form.set("action_code", code);
    if (note) form.set("note", note);
    if (proof) form.set("proof", proof);
    return request<ActionLog>("/api/actions", { method: "POST", body: form });
  },

  userLeaderboard: (period: Period, scope: "district" | "state") =>
    request<UserRank[]>(`/api/leaderboard/users?period=${period}&scope=${scope}`),
  districtLeaderboard: () => request<DistrictRank[]>("/api/leaderboard/districts"),
  solar: (data: SolarInput) => request<SolarEstimate>("/api/solar/estimate", json(data)),

  adminOverview: () => request<AdminOverview>("/api/admin/overview"),
  reviews: () => request<ReviewItem[]>("/api/admin/reviews"),
  decideReview: (id: number, approve: boolean) => request<void>(`/api/admin/reviews/${id}`, json({ approve })),
  proofUrl: async (id: number): Promise<string> => {
    const resp = await fetch(`${API_URL}/api/admin/reviews/${id}/proof`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!resp.ok) throw new ApiError(resp.status, "Proof unavailable");
    return URL.createObjectURL(await resp.blob());
  },
};
