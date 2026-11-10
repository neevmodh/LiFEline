"use client";

import Link from "next/link";
import { useState } from "react";
import { PlanList } from "@/components/PlanList";
import { Button, Card, ErrorNote, Field, fmt, inputClass } from "@/components/ui";
import { api, type Discom, type GuestCheck as Result, type TariffArea } from "@/lib/api";
import { useI18n } from "@/i18n";

const DISCOMS: { code: Discom; name: string }[] = [
  { code: "dgvcl", name: "DGVCL (South Gujarat)" },
  { code: "mgvcl", name: "MGVCL (Central Gujarat)" },
  { code: "pgvcl", name: "PGVCL (Saurashtra, Kutch)" },
  { code: "ugvcl", name: "UGVCL (North Gujarat)" },
  { code: "torrent", name: "Torrent Power (Ahmedabad, Gandhinagar, Surat)" },
];

/** The free bill check from the landing page: value first, an account only if you want to keep it. */
export function GuestCheck() {
  const { t } = useI18n();
  const [form, setForm] = useState({ kwh: "", discom: "ugvcl" as Discom, area: "urban" as TariffArea, acs: "1", geyser: true, roof: "" });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const answers = {
        monthly_kwh: Number(form.kwh),
        discom: form.discom,
        area: form.area,
        ac_count: Number(form.acs),
        has_geyser: form.geyser,
        roof_area_sqm: form.roof ? Number(form.roof) : null,
      };
      setResult(await api.guestCheck(answers));
      try {
        // Carried into onboarding if they sign up, so nothing has to be typed twice.
        sessionStorage.setItem("nidhi.guest", JSON.stringify(answers));
      } catch {
        // Storage unavailable: they just re-enter it.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setResult(null);
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  };

  const plan = result?.plan;
  return (
    <section id="check" className="scroll-mt-24 pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("guest.title")}</h2>
        <p className="mt-3 text-muted">{t("guest.sub")}</p>
      </div>
      <Card className="mx-auto mt-8 max-w-3xl shadow-[var(--shadow-lg)] sm:p-8">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("guest.units")} hint={t("household.unitsHint")}>
            <input type="number" required min={1} max={10000} value={form.kwh} onChange={set("kwh")} className={inputClass} />
          </Field>
          <Field label={t("household.discom")} hint={t("household.discomHint")}>
            <select value={form.discom} onChange={set("discom")} className={inputClass}>
              {DISCOMS.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("household.area")}>
            <select value={form.area} onChange={set("area")} className={inputClass}>
              <option value="urban">{t("household.urban")}</option>
              <option value="rural">{t("household.rural")}</option>
            </select>
          </Field>
          <Field label={t("household.acs")}>
            <input type="number" min={0} max={20} value={form.acs} onChange={set("acs")} className={inputClass} />
          </Field>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={form.geyser} onChange={set("geyser")} className="h-5 w-5 accent-[var(--brand)]" />
            {t("household.geyser")}
          </label>
          <Field label={t("household.roof")} hint={t("common.optional")}>
            <input type="number" min={0} value={form.roof} onChange={set("roof")} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <ErrorNote message={error} />
            <Button type="submit" disabled={busy} className="w-full py-3 text-base">
              {busy ? t("common.wait") : t("guest.go")}
            </Button>
          </div>
        </form>
      </Card>

      {plan && result && (
        <div className="mx-auto mt-8 max-w-3xl space-y-5" aria-live="polite">
          <div className="rounded-[2rem] bg-gradient-to-br from-[#0a8157] to-[#10a073] p-6 text-white shadow-[var(--shadow-lg)] sm:p-8">
            <p className="text-3xl font-bold tracking-tight sm:text-4xl">
              {plan.total_rs_month > 0 ? t("plan.hero", { rs: fmt.rs(plan.total_rs_month) }) : t("plan.title")}
            </p>
            <p className="mt-2 text-white/90">
              {t("guest.summary", {
                bill: fmt.rs(plan.bill_rs),
                rate: `₹${plan.marginal_rs_per_kwh.toFixed(2)}`,
                kg: fmt.int(result.electricity_kg_year),
              })}
            </p>
          </div>
          {plan.slab_note && (
            <Card className="border-sun/40 bg-sun-soft/50">
              <p className="text-sm">{plan.slab_note}</p>
            </Card>
          )}
          <PlanList items={plan.items.slice(0, 4)} onLogged={() => undefined} readOnly />
          <div className="rounded-3xl border border-brand/30 bg-brand-soft/60 p-6 text-center">
            <p className="text-lg font-semibold">{t("guest.cta")}</p>
            <p className="mt-1 text-sm text-muted">{t("guest.ctaSub")}</p>
            <Link
              href="/register"
              className="mt-4 inline-block rounded-2xl bg-gradient-to-br from-[#0a8157] to-[#10a073] px-7 py-3 font-semibold text-white shadow-[var(--shadow-lg)]"
            >
              {t("guest.save")}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
