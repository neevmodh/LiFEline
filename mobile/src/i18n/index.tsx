// English, Gujarati and Hindi, shared with the web app: the catalogues are web/src/i18n/*.json
// (plus web's copy.ts), read through the @shared alias. A key missing from a translation falls back
// to English, and a translation that lost a {placeholder} falls back to English too, as on the web.
import { useQueryClient } from "@tanstack/react-query";
import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import enBase from "@shared/i18n/en.json";
import gu from "@shared/i18n/gu.json";
import hi from "@shared/i18n/hi.json";
import { COPY } from "@shared/i18n/copy";
import { getItem, setItem } from "@/lib/storage";

import { MOBILE_COPY } from "./mobile";

const en = { ...enBase, ...COPY, ...MOBILE_COPY };

export type Locale = "en" | "gu" | "hi";
export type MessageKey = keyof typeof en;
type Params = Record<string, string | number>;

const CATALOGUES: Record<Locale, Partial<Record<string, string>>> = { en, gu, hi };
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "hi", label: "हिन्दी" },
];
const STORAGE_KEY = "nidhi.locale";

function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "gu" || v === "hi";
}

function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return isLocale(code) ? code : "en";
}

let active: Locale = deviceLocale();

/** The current UI language, for non-React code such as the API client's Accept-Language header. */
export function currentLocale(): Locale {
  return active;
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const template = CATALOGUES[locale][key] ?? en[key];
  if (!params) return template;
  const filled = template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  return /\{\w+\}/.test(filled) && locale !== "en" ? translate("en", key, params) : filled;
}

/** A Gujarat district's name in the UI language; unknown names are shown as they are. */
export function districtName(locale: Locale, name: string | null | undefined): string {
  if (!name) return "";
  return CATALOGUES[locale][`district.${name}`] ?? name;
}

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, params?: Params) => string;
  district: (name: string | null | undefined) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(active);
  const qc = useQueryClient();

  // Action names, reasons and nudges come from the server in the language asked for, so after a
  // change everything already fetched is fetched again rather than left in the old language.
  useEffect(() => {
    getItem(STORAGE_KEY).then((saved) => {
      if (isLocale(saved) && saved !== active) {
        active = saved;
        setLocaleState(saved);
        void qc.invalidateQueries();
      }
    });
  }, [qc]);

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale: (l) => {
        if (l === active) return;
        active = l;
        setLocaleState(l);
        void setItem(STORAGE_KEY, l);
        void qc.invalidateQueries();
      },
      t: (key, params) => translate(locale, key, params),
      district: (name) => districtName(locale, name),
    }),
    [locale, qc],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
