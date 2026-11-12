// Regression: the app showed screens half in English because some keys had no Gujarati or Hindi, and
// a few had lost a {placeholder}. Every key the website, console and phone app use must be translated
// in both languages and keep its placeholders.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { COPY } from "./copy";
import en from "./en.json";
import gu from "./gu.json";
import hi from "./hi.json";

const mobileSrc = readFileSync(fileURLToPath(new URL("../../../mobile/src/i18n/mobile.ts", import.meta.url)), "utf8");
const mobile = Object.fromEntries(
  [...mobileSrc.matchAll(/^\s*"([\w.]+)":\s*("(?:[^"\\]|\\.)*")/gm)].map((m) => [m[1], JSON.parse(m[2]) as string]),
);
const english: Record<string, string> = { ...en, ...COPY, ...mobile };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each([
  ["gu", gu as Record<string, string>],
  ["hi", hi as Record<string, string>],
])("%s catalogue", (_, catalogue) => {
  it("has every key", () => {
    expect(Object.keys(english).filter((k) => !(k in catalogue))).toEqual([]);
  });

  it("keeps every placeholder", () => {
    const broken = Object.keys(english).filter((k) => k in catalogue && placeholders(catalogue[k]).join() !== placeholders(english[k]).join());
    expect(broken).toEqual([]);
  });

  it("has no empty translations", () => {
    expect(Object.entries(catalogue).filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => k)).toEqual([]);
  });
});

it("reads the phone app's own keys", () => {
  expect(Object.keys(mobile).length).toBeGreaterThan(100);
  expect(mobile["prize.title"]).toBe("Prizes");
});

it("uses one Gujarati word for points", () => {
  const variants = Object.entries(gu as Record<string, string>).filter(([, v]) => /ગુણ|મુદ્દાઓ|પોઈન્ટ્સ/.test(v));
  expect(variants.map(([k]) => k)).toEqual([]);
});
