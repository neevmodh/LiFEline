// The on-device bill reader against 254 synthetic Gujarat bills generated with Adaption's
// "invent a dataset" (backend/tools/invent_bill_tests.py): every DISCOM, bilingual labels and OCR
// noise, each kept only if its true figures are printed in its own text.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBillText } from "./billParser";

type Bill = { text: string; units_kwh: number; billing_days?: number | null; amount_rs?: number | null };
const bills: Bill[] = readFileSync(new URL("./__fixtures__/bills.adaption.jsonl", import.meta.url), "utf8")
  .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((b) => typeof b.text === "string");

describe("bill reader on the Adaption test set", () => {
  const parsed = bills.map((b) => ({ b, p: parseBillText(b.text) }));
  const share = (ok: (x: (typeof parsed)[number]) => boolean, of = parsed) => of.filter(ok).length / of.length;

  it("reads units, billing days and amount on the 254 Adaption bills", () => {
    const units = share(({ b, p }) => p.unitsKwh === b.units_kwh);
    const withDays = parsed.filter(({ b }) => b.billing_days != null);
    const days = share(({ b, p }) => p.billingDays === b.billing_days, withDays);
    const withAmount = parsed.filter(({ b }) => b.amount_rs != null);
    const amount = share(({ b, p }) => p.amountRs != null && Math.abs(p.amountRs - (b.amount_rs as number)) < 1, withAmount);
    console.log(`${bills.length} bills · units ${(units * 100).toFixed(1)}% · days ${(days * 100).toFixed(1)}% (${withDays.length}) · amount ${(amount * 100).toFixed(1)}% (${withAmount.length})`);
    expect(bills.length).toBeGreaterThan(200);
    // Measured on 14 Nov 2026: units 100%, days 95.3%, amount 91.7%. Guard against regressions.
    expect(units).toBeGreaterThanOrEqual(0.98);
    expect(days).toBeGreaterThanOrEqual(0.9);
    expect(amount).toBeGreaterThanOrEqual(0.88);
  });
});
