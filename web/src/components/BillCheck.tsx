"use client";

import { useState } from "react";
import { BillScanner } from "@/components/BillScanner";
import { ErrorNote, Field, fmt, inputClass } from "@/components/ui";
import { api, type Discom, type GuestCheck, type TariffArea } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";
import { APP_URL } from "@/lib/links";

const DISCOMS: Discom[] = ["dgvcl", "mgvcl", "pgvcl", "ugvcl", "torrent"];

/** The free bill check: value first, an account only if you want to keep the plan. */
export function BillCheck() {
  const { t } = useI18n();
  const [f, setF] = useState({ kwh: "", discom: "ugvcl" as Discom, area: "urban" as TariffArea, acs: "1", geyser: true, roof: "" });
  const [result, setResult] = useState<GuestCheck | null>(null);
  const [keepUrl, setKeepUrl] = useState(APP_URL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const answers = {
        monthly_kwh: Number(f.kwh), discom: f.discom, area: f.area, ac_count: Number(f.acs),
        has_geyser: f.geyser, roof_area_sqm: f.roof ? Number(f.roof) : null,
      };
      setResult(await api.guestCheck(answers));
      // The app is on another origin, so the answers travel in the link and its onboarding starts from them.
      setKeepUrl(`${APP_URL}/?guest=${encodeURIComponent(JSON.stringify(answers))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  if (result) {
    const steps = result.plan.items.filter((i) => i.kind === "habit" && i.rs_month > 0).slice(0, 3);
    return (
      <div className="rounded-[28px] bg-white p-6 text-text shadow-[var(--shadow-lg)] sm:p-8" data-testid="check-result">
        <p className="kicker text-brand">{t("check.resultKicker")}</p>
        <p className="num mt-1 text-6xl font-bold text-text sm:text-7xl">
          {fmt.rs(result.plan.total_rs_month)}
          <span className="ml-2 text-xl font-medium text-muted">{t("check.perMonth")}</span>
        </p>
        <p className="mt-2 text-muted">{t("check.cutCo2", { kg: Math.round(result.plan.total_co2_month_kg) })}</p>
        {result.plan.slab_note && <p className="mt-4 rounded-2xl bg-sun-soft px-4 py-3 text-sm">{result.plan.slab_note}</p>}
        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t("check.topSteps")}</h3>
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={s.code} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">{i + 1}</span>
              <span className="min-w-0 flex-1 font-medium">{s.title}</span>
              <span className="num rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">{fmt.rs(s.rs_month)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={keepUrl} className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-[var(--shadow)] hover:bg-brand-strong">
            {t("check.keep")}
          </a>
          <button type="button" onClick={() => setResult(null)} className="rounded-full px-4 py-3 text-sm font-medium text-muted hover:text-text">
            {t("check.recheck")}
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">{t("check.keepHint")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] bg-white p-6 text-text shadow-[var(--shadow-lg)] sm:p-8" aria-label={t("check.title")}>
      <h2 className="text-lg font-bold">{t("check.title")}</h2>
      <div className="mt-4 space-y-4">
        <Field label={t("check.units")} hint={t("check.unitsHint")}>
          <input className={inputClass} type="number" inputMode="decimal" min={1} max={10000} step="any" required value={f.kwh} onChange={set("kwh")} />
        </Field>
        <BillScanner
          compact
          title={t("check.scan")}
          onResult={(r) => setF((p) => ({ ...p, kwh: String(Math.round(r.monthlyKwh)), discom: r.discom ?? p.discom }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("check.discom")}>
            <select className={inputClass} value={f.discom} onChange={set("discom")}>
              {DISCOMS.map((code) => <option key={code} value={code}>{t(`discom.${code}` as MessageKey)}</option>)}
            </select>
          </Field>
          <Field label={t("check.area")}>
            <select className={inputClass} value={f.area} onChange={set("area")}>
              <option value="urban">{t("check.urban")}</option>
              <option value="rural">{t("check.rural")}</option>
            </select>
          </Field>
          <Field label={t("check.acs")}>
            <input className={inputClass} type="number" min={0} max={20} required value={f.acs} onChange={set("acs")} />
          </Field>
          <Field label={t("check.roof")}>
            <input className={inputClass} type="number" min={0} max={5000} value={f.roof} onChange={set("roof")} />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[#4e7d5e]" checked={f.geyser} onChange={set("geyser")} />
          {t("check.geyser")}
        </label>
      </div>
      <ErrorNote message={error} />
      <button
        type="submit"
        disabled={busy || !f.kwh}
        className="btn-saffron mt-6 w-full rounded-full px-6 py-4 text-base disabled:opacity-60"
      >
        {busy ? t("check.working") : t("check.go")}
      </button>
    </form>
  );
}
