// Typed client for the LiFEline FastAPI backend.

import { currentLocale } from "@/i18n";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "lifeline.token";

export type CommuteMode = "car" | "two_wheeler" | "bus" | "metro" | "cycle_walk";
export type Period = "week" | "month" | "all";

export interface User {
  id: number;
  email: string;
  name: string;
  /** admin: GEDA state team; officer: a GEDA district officer (their district_id only). */
  role: "citizen" | "admin" | "officer";
  district_id: number | null;
  ward: string | null;
  onboarded: boolean;
}

export type Discom = "dgvcl" | "mgvcl" | "pgvcl" | "ugvcl" | "torrent";
export type TariffArea = "urban" | "rural";

export interface District {
  id: number;
  name: string;
  lat: number;
  lon: number;
  suggested_discom: Discom;
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
  discom: Discom;
  area: TariffArea;
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
  /** False when this household can't do it (no AC, already commutes by bus...). */
  applicable: boolean;
  not_applicable_reason: string | null;
}

export interface ActionLog {
  id: number;
  action: ActionType;
  status: "self_reported" | "pending" | "verified" | "rejected";
  points_awarded: number;
  co2_saved_kg: number;
  kwh_saved: number;
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
  discom?: Discom;
  area?: TariffArea;
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

export interface BillScan {
  units_kwh: number | null;
  billing_days: number | null;
  billing_period_end: string | null;
  bill_amount_rs: number | null;
  distributor: string | null;
  confidence: "high" | "medium" | "low";
  monthly_kwh: number | null;
  provider: "groq" | "anthropic";
}

export interface AdminOverview {
  citizens: number;
  onboarded: number;
  active_7d: number;
  actions_total: number;
  co2_saved_total_kg: number;
  co2_verified_total_kg: number;
  kwh_saved_total: number;
  pending_reviews: number;
  districts: {
    district_id: number;
    district: string;
    lat: number;
    lon: number;
    citizens: number;
    active_7d: number;
    participation_pct: number | null;
    actions_30d: number;
    co2_saved_30d_kg: number;
    co2_per_citizen_30d_kg: number | null;
    avg_baseline_kg: number | null;
    solar_potential_kwp: number;
  }[];
  categories: { category: string; actions: number; co2_saved_kg: number }[];
  weekly: { week_start: string; actions: number; co2_saved_kg: number; active_citizens: number }[];
}

export interface DistrictDetail {
  district_id: number;
  district: string;
  citizens: number;
  onboarded: number;
  active_7d: number;
  participation_pct: number | null;
  actions_30d: number;
  co2_saved_30d_kg: number;
  kwh_saved_30d: number;
  peak_shifts_30d: number;
  avg_baseline_kg: number | null;
  consumption: { month: string; avg_kwh: number; households: number }[];
  categories: AdminOverview["categories"];
  weekly: AdminOverview["weekly"];
  top_wards: { ward: string; citizens: number; co2_saved_30d_kg: number }[];
  solar: {
    suitable_households: number;
    installed_households: number;
    potential_kwp: number;
    annual_generation_kwh: number;
    annual_co2_avoided_t: number;
    subsidy_pipeline_rs: number;
  };
  solar_survey_requests: number;
}

export interface ReviewItem {
  id: number;
  user_name: string;
  district: string | null;
  action_title: string;
  note: string | null;
  created_at: string;
  ai_verdict: "likely" | "unlikely" | "unsure" | null;
  ai_confidence: number | null;
  ai_reason: string | null;
}

export interface WeatherInsight {
  available: boolean;
  reason: string | null;
  baseline_month: string | null;
  baseline_kwh: number | null;
  baseline_cdd: number | null;
  model: { slope_kwh_per_cdd: number; source: "household" | "district" | "state" | "none"; months_used: number } | null;
  months: {
    month: string;
    kwh: number;
    cooling_degree_days: number;
    expected_kwh: number;
    saving_pct: number;
    above_expected: boolean;
  }[];
}

export interface GreenWindow {
  date: string;
  start_hour: number;
  end_hour: number;
  avg_radiation_w_m2: number;
  sky: "sunny" | "partly_cloudy" | "cloudy";
}

export interface GreenHours {
  today: GreenWindow | null;
  tomorrow: GreenWindow | null;
  peak_hours: [number, number];
  district: string | null;
}

export interface Activity {
  kind: "joined" | "action" | "proof";
  at: string;
  first_name: string;
  district: string | null;
  action_title: string | null;
  co2_saved_kg: number | null;
}

export interface SolarScenario {
  district: string;
  adoption_pct: number;
  registered_homes: number;
  suitable_homes: number;
  adopting_homes: number;
  capacity_mw: number;
  annual_generation_mwh: number;
  annual_co2_avoided_t: number;
  annual_bill_savings_rs: number;
  subsidy_needed_rs: number;
  household_investment_rs: number;
  payback_years: number | null;
  yield_source: "pvgis" | "default";
  per_1000_homes: { capacity_mw: number; annual_co2_avoided_t: number; annual_bill_savings_rs: number; subsidy_needed_rs: number };
}

export interface FootprintHistory {
  baseline_kg: number;
  months: {
    month: string;
    electricity_kg: number;
    cooking_kg: number;
    commute_kg: number;
    total_kg: number;
    avoided_kg: number;
    actions: number;
  }[];
}

export interface Badge {
  code: string;
  earned: boolean;
  progress: number;
  target: number;
}

export interface ApplianceComparison {
  kwh_saved_per_year: number;
  rs_saved_per_year: number;
  co2_saved_kg_per_year: number;
  payback_years: number | null;
  ten_year_savings_rs: number;
}

export interface AppConfig {
  peak_hours: [number, number];
  solar_hours: [number, number];
  sqm_per_kwp: number;
  grid_kg_co2_per_kwh: number;
  car_kg_co2_per_km: number;
  tree_kg_co2_per_year: number;
  discoms: { code: Discom; name: string }[];
  sources: { topic: string; value: string; source: string; url: string | null }[];
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
  // The API translates action names, nudges and reasons into the UI language.
  headers.set("Accept-Language", currentLocale());
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the LiFEline server. Is the backend running?");
  }
  if (resp.status === 204) return undefined as T;
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new ApiError(resp.status, errorMessage(body, `Request failed (${resp.status})`));
  return body as T;
}

const json = (data: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(data) });

export const api = {
  config: () => request<AppConfig>("/api/config"),
  districts: () => request<District[]>("/api/districts"),
  register: (data: { email: string; password: string; name: string; district_id: number; ward?: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", json(data)),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", json(data)),
  me: () => request<User>("/api/auth/me"),
  updateProfile: (data: { name?: string; district_id?: number; ward?: string | null }) =>
    request<User>("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) }),

  previewFootprint: (data: FootprintInput & { discom?: Discom; area?: TariffArea }) =>
    request<Footprint>("/api/footprint/preview", json(data)),
  saveHousehold: (data: HouseholdInput) =>
    request<{ household: Household; footprint: Footprint }>("/api/household", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  household: () => request<{ household: Household; footprint: Footprint }>("/api/household"),
  readings: () => request<Reading[]>("/api/readings"),
  addReading: (data: { month: string; kwh: number }) => request<Reading>("/api/readings", json(data)),
  scanBill: (photo: File) => {
    const form = new FormData();
    form.set("photo", photo);
    return request<BillScan>("/api/bills/scan", { method: "POST", body: form });
  },
  dashboard: () => request<Dashboard>("/api/dashboard"),
  nudges: () => request<{ temperature_c: number | null; generated_at: string; nudges: Nudge[] }>("/api/nudges"),
  weatherInsight: () => request<WeatherInsight>("/api/insights/weather"),
  greenHours: () => request<GreenHours>("/api/insights/green-hours"),
  footprintHistory: () => request<FootprintHistory>("/api/footprint/history"),
  badges: () => request<Badge[]>("/api/badges"),

  actionTypes: () => request<ActionType[]>("/api/actions/types"),
  myActions: () => request<ActionLog[]>("/api/actions/mine"),
  logAction: (code: string, note?: string, proof?: File | null) => {
    const form = new FormData();
    form.set("action_code", code);
    if (note) form.set("note", note);
    if (proof) form.set("proof", proof);
    return request<ActionLog>("/api/actions", { method: "POST", body: form });
  },

  userLeaderboard: (period: Period, scope: "ward" | "district" | "state") =>
    request<UserRank[]>(`/api/leaderboard/users?period=${period}&scope=${scope}`),
  districtLeaderboard: () => request<DistrictRank[]>("/api/leaderboard/districts"),
  solar: (data: SolarInput) => request<SolarEstimate>("/api/solar/estimate", json(data)),
  compareAppliances: (data: {
    appliance: string;
    old_kwh_per_year: number;
    new_kwh_per_year: number;
    new_price_rs: number | null;
  }) => request<ApplianceComparison>("/api/appliances/compare", json(data)),

  adminOverview: () => request<AdminOverview>("/api/admin/overview"),
  districtDetail: (id: number) => request<DistrictDetail>(`/api/admin/districts/${id}`),
  reviews: () => request<ReviewItem[]>("/api/admin/reviews"),
  solarScenario: (adoptionPct: number, districtId?: number) =>
    request<SolarScenario>(
      `/api/admin/solar-scenario?adoption_pct=${adoptionPct}${districtId ? `&district_id=${districtId}` : ""}`,
    ),
  activity: (since: string | null) =>
    request<Activity[]>(`/api/admin/activity${since ? `?since=${encodeURIComponent(since)}` : ""}`),
  decideReview: (id: number, approve: boolean) => request<void>(`/api/admin/reviews/${id}`, json({ approve })),
  shareCard: async (): Promise<Blob> => {
    const resp = await fetch(`${API_URL}/api/share/card.png`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!resp.ok) throw new ApiError(resp.status, "Card unavailable");
    return resp.blob();
  },
  /** Download the district panel as a CSV file. */
  downloadDistrictReport: async (id: number) => {
    const resp = await fetch(`${API_URL}/api/admin/districts/${id}/report.csv`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!resp.ok) throw new ApiError(resp.status, "Report unavailable");
    const name = /filename="([^"]+)"/.exec(resp.headers.get("content-disposition") ?? "")?.[1] ?? "district-report.csv";
    const url = URL.createObjectURL(await resp.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  },
  proofUrl: async (id: number): Promise<string> => {
    const resp = await fetch(`${API_URL}/api/admin/reviews/${id}/proof`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!resp.ok) throw new ApiError(resp.status, "Proof unavailable");
    return URL.createObjectURL(await resp.blob());
  },
};
