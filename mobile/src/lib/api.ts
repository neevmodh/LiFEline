// Typed client for the Nidhi FastAPI backend. The response types are the web app's
// (web/src/lib/api.ts, read through @shared), so both apps break together when the API changes.
import type {
  ActionLog,
  Badge,
  BillScan,
  Campaign,
  CommunityKind,
  CommuteMode,
  DailyChallenge,
  Dashboard,
  Discom,
  District,
  DistrictRank,
  Duel,
  EngineToday,
  Footprint,
  GreenHours,
  Household,
  HouseholdInput,
  Ledger,
  LifeScore,
  SocietyRank,
  SocietyView,
  SolarEstimate,
  SolarInput,
  TariffArea,
  User,
} from "@shared/lib/api";

import { currentLocale } from "@/i18n";

import { getItem, setItem } from "./storage";

export type {
  ActionLog,
  Badge,
  BillScan,
  Campaign,
  CommunityKind,
  CommuteMode,
  DailyChallenge,
  Dashboard,
  Discom,
  District,
  DistrictRank,
  Duel,
  EngineToday,
  Footprint,
  GreenHours,
  Household,
  HouseholdInput,
  Ledger,
  LifeScore,
  SocietyRank,
  SocietyView,
  SolarEstimate,
  SolarInput,
  TariffArea,
  User,
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "nidhi.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await getItem(TOKEN_KEY);
  return token;
}

export async function saveToken(value: string | null): Promise<void> {
  token = value;
  await setItem(TOKEN_KEY, value);
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
  return fallback;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // The API translates action names, nudges and reasons into the UI language.
  headers.set("Accept-Language", currentLocale());
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network");
  }
  if (resp.status === 204) return undefined as T;
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new ApiError(resp.status, errorMessage(body, `Request failed (${resp.status})`));
  return body as T;
}

/** What expo-image-picker returns for one picked photo. */
export type Photo = { uri: string; mimeType?: string | null; fileName?: string | null };

/** On phones FormData takes {uri, name, type}; on the web build the picker gives a Blob URL, fetched first. */
async function appendPhoto(form: FormData, field: string, photo: Photo) {
  const name = photo.fileName ?? "photo.jpg";
  const type = photo.mimeType ?? "image/jpeg";
  if (process.env.EXPO_OS === "web") form.append(field, await (await fetch(photo.uri)).blob(), name);
  else form.append(field, { uri: photo.uri, name, type } as unknown as Blob);
}

const post = (data: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(data) });

export const api = {
  districts: () => request<District[]>("/api/districts"),
  register: (data: { email: string; password: string; name: string; district_id: number; ward?: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", post(data)),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", post(data)),
  me: () => request<User>("/api/auth/me"),

  previewFootprint: (data: Omit<HouseholdInput, "home_type" | "ac_count" | "has_geyser" | "has_washing_machine" | "has_ev" | "has_solar" | "roof_area_sqm">) =>
    request<Footprint>("/api/footprint/preview", post(data)),
  saveHousehold: (data: HouseholdInput) =>
    request<{ household: Household; footprint: Footprint }>("/api/household", { method: "PUT", body: JSON.stringify(data) }),
  score: () => request<LifeScore>("/api/me/score"),
  ledger: (period: "month" | "all" = "month") => request<Ledger>(`/api/me/ledger?period=${period}`),
  engineToday: () => request<EngineToday>("/api/engine/today"),
  dashboard: () => request<Dashboard>("/api/dashboard"),
  greenHours: () => request<GreenHours>("/api/insights/green-hours"),
  /** Without a photo the action counts now for 40% of its points; with one it waits for review and earns them all. */
  logAction: async (code: string, proof?: Photo) => {
    const form = new FormData();
    form.append("action_code", code);
    if (proof) await appendPhoto(form, "proof", proof);
    return request<ActionLog>("/api/actions", { method: "POST", body: form });
  },
  registerPush: (token: string) => request<void>("/api/push/expo", post({ token })),
  myCommunity: () => request<SocietyView>("/api/societies/mine"),
  createCommunity: (name: string, kind: CommunityKind) => request<SocietyView>("/api/societies", post({ name, kind })),
  joinCommunity: (code: string) => request<SocietyView>("/api/societies/join", post({ code })),
  leaveCommunity: () => request<void>("/api/societies/leave", { method: "POST" }),
  postAnnouncement: (text: string) => request<SocietyView>("/api/societies/announcements", post({ text })),
  weeklyLeague: () => request<SocietyRank[]>("/api/societies/leaderboard?period=week"),
  districtStandings: () => request<DistrictRank[]>("/api/leaderboard/districts"),
  campaigns: () => request<Campaign[]>("/api/campaigns"),
  /** Everything Nidhi stores about me (GET /api/account/export), as pretty JSON text. */
  exportData: async () => JSON.stringify(await request<unknown>("/api/account/export"), null, 2),
  deleteAccount: (password: string) => request<void>("/api/account", { method: "DELETE", body: JSON.stringify({ password }) }),
  household: () => request<{ household: Household; footprint: Footprint }>("/api/household"),
  solarEstimate: (data: SolarInput) => request<SolarEstimate>("/api/solar/estimate", post(data)),
  myDuels: () => request<Duel[]>("/api/duels/mine"),
  challenge: (opponentId: number) => request<Duel>("/api/duels", post({ opponent_id: opponentId })),
  answerDuel: (id: number, answer: "accept" | "decline") => request<Duel>(`/api/duels/${id}/${answer}`, { method: "POST" }),
  dailyChallenge: () => request<DailyChallenge>("/api/actions/today"),
  badges: () => request<Badge[]>("/api/badges"),

  scanBill: async (photo: Photo) => {
    const form = new FormData();
    await appendPhoto(form, "photo", photo);
    return request<BillScan>("/api/bills/scan", { method: "POST", body: form });
  },
};
