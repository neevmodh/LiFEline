// Typed client for the Nidhi FastAPI backend. The response types are the web app's
// (web/src/lib/api.ts, read through @shared), so both apps break together when the API changes.
import type { District, User } from "@shared/lib/api";

import { currentLocale } from "@/i18n";

import { getItem, setItem } from "./storage";

export type { District, User };

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

const post = (data: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(data) });

export const api = {
  districts: () => request<District[]>("/api/districts"),
  register: (data: { email: string; password: string; name: string; district_id: number; ward?: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", post(data)),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", post(data)),
  me: () => request<User>("/api/auth/me"),
};
