"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import en from "./en.json";
import gu from "./gu.json";
import hi from "./hi.json";

// English (en.json) is the source. Gujarati and Hindi are generated from it with Adaption
// (tools/translate_with_adaption.py) and reviewed by a native speaker. A key missing from a
// translation falls back to English, so a partial catalogue never breaks a screen.
export type Locale = "en" | "gu" | "hi";
export type MessageKey = keyof typeof en;
type Params = Record<string, string | number>;

const CATALOGUES: Record<Locale, Partial<Record<string, string>>> = { en, gu, hi };
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "hi", label: "हिन्दी" },
];
const STORAGE_KEY = "lifeline.locale";

// The chosen language lives in localStorage; this tiny store lets React subscribe to it
// (useSyncExternalStore) so the server render and first client render agree.
let activeLocale: Locale | null = null;
const listeners = new Set<() => void>();

function readSaved(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "gu" || saved === "hi") return saved;
  } catch {
    // Storage unavailable; fall through to the browser language.
  }
  const lang = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  return lang === "gu" || lang === "hi" ? lang : "en";
}

/** The current UI language, for non-React code (API headers, date formatting). */
export function currentLocale(): Locale {
  if (typeof window === "undefined") return "en";
  activeLocale ??= readSaved();
  return activeLocale;
}

function setActiveLocale(l: Locale) {
  activeLocale = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // Not persisted; the choice lasts until reload.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const template = CATALOGUES[locale][key] ?? en[key];
  if (!params) return template;
  const filled = template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  // A translation that lost a placeholder would show "{x}"; use English instead.
  return /\{\w+\}/.test(filled) && locale !== "en" ? translate("en", key, params) : filled;
}

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, params?: Params) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, currentLocale, () => "en" as Locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale: setActiveLocale, t: (key, params) => translate(locale, key, params) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Compact language picker for headers. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <select
      aria-label={t("common.language")}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={`rounded-lg border border-border bg-surface px-2 py-1 text-sm text-muted ${className}`}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
