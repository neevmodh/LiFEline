"use client";

import { useEffect, useState } from "react";
import { api, type AppConfig, type Discom } from "@/lib/api";

// The assumptions (peak hours, DISCOMs, sources) come from the API, so the backend's
// factors.py is the single place they're defined. Fetched once per page load.
let cached: Promise<AppConfig> | null = null;

export function loadConfig(): Promise<AppConfig> {
  cached ??= api.config().catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);
  useEffect(() => {
    let live = true;
    loadConfig()
      .then((c) => live && setConfig(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return config;
}

/** "18:00–22:00" style label for an hour window; 12-hour when `pm` is set (e.g. "6–10 PM"). */
export function hoursLabel([start, end]: [number, number], pm = false): string {
  if (pm && start >= 12 && end >= 12) return `${start - 12}–${end - 12} PM`;
  return `${String(start).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`;
}

/** Recognise the distribution company from a bill's text or an AI reader's answer. */
export function matchDiscom(text: string | null | undefined): Discom | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/torrent/.test(t)) return "torrent";
  if (/dgvcl|dakshin\s+gujarat/.test(t)) return "dgvcl";
  if (/mgvcl|madhya\s+gujarat/.test(t)) return "mgvcl";
  if (/pgvcl|paschim\s+gujarat/.test(t)) return "pgvcl";
  if (/ugvcl|uttar\s+gujarat/.test(t)) return "ugvcl";
  return null;
}
