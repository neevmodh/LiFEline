"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardPage } from "@/components/Page";
import { ErrorNote, Field, Spinner, inputClass, useLoad } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, type CommuteMode, type Discom, type TariffArea } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const COMMUTES: CommuteMode[] = ["car", "two_wheeler", "bus", "metro", "cycle_walk"];
const DISCOMS: Discom[] = ["dgvcl", "mgvcl", "pgvcl", "ugvcl", "torrent"];

export default function JoinPage() {
  const { t } = useI18n();
  const { signIn, refresh } = useAuth();
  const router = useRouter();
  const districts = useLoad(api.districts);
  const [f, setF] = useState({
    name: "", email: "", password: "", district_id: "", ward: "",
    kwh: "", discom: "ugvcl" as Discom, area: "urban" as TariffArea, members: "4", lpg: "1",
    commute: "two_wheeler" as CommuteMode, km: "8", acs: "1", geyser: true, washing: true, roof: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Answers from the free bill check carry over, so nothing is typed twice.
  useEffect(() => {
    try {
      const g = JSON.parse(sessionStorage.getItem("nidhi.guest") ?? "null");
      if (g) setF((p) => ({ ...p, kwh: String(g.monthly_kwh), discom: g.discom, area: g.area, acs: String(g.ac_count), geyser: !!g.has_geyser, roof: g.roof_area_sqm ? String(g.roof_area_sqm) : "" }));
    } catch {
      // Nothing carried over.
    }
  }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  function pickDistrict(e: React.ChangeEvent<HTMLSelectElement>) {
    const d = districts.data?.find((x) => String(x.id) === e.target.value);
    setF((p) => ({ ...p, district_id: e.target.value, discom: d && !sessionStorage.getItem("nidhi.guest") ? d.suggested_discom : p.discom }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api.register({
        email: f.email, password: f.password, name: f.name, district_id: Number(f.district_id), ward: f.ward || undefined,
      });
      signIn(token, user);
      await api.saveHousehold({
        monthly_kwh: Number(f.kwh), members: Number(f.members), lpg_cylinders_per_month: Number(f.lpg),
        commute_mode: f.commute, commute_km_per_day: f.commute === "cycle_walk" ? 0 : Number(f.km),
        home_type: "apartment", ac_count: Number(f.acs), has_geyser: f.geyser, has_washing_machine: f.washing,
        has_ev: false, has_solar: false, roof_area_sqm: f.roof ? Number(f.roof) : null, discom: f.discom, area: f.area,
      });
      try {
        sessionStorage.removeItem("nidhi.guest");
      } catch {
        // Nothing to clear.
      }
      await refresh();
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <CardPage wide>
      <h1 className="text-2xl font-bold">{t("join.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("join.sub")}</p>
      <form onSubmit={submit} className="mt-6 space-y-8">
        <fieldset className="space-y-4">
          <legend className="kicker text-brand">{t("join.you")}</legend>
          <Field label={t("join.name")}><input className={inputClass} required maxLength={120} autoComplete="name" value={f.name} onChange={set("name")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("join.email")}><input className={inputClass} type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
            <Field label={t("join.password")}><input className={inputClass} type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
            <Field label={t("join.district")}>
              {districts.loading && !districts.data ? <Spinner /> : (
                <select className={inputClass} required value={f.district_id} onChange={pickDistrict}>
                  <option value="">{t("join.districtPick")}</option>
                  {districts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </Field>
            <Field label={t("join.ward")}><input className={inputClass} maxLength={80} value={f.ward} onChange={set("ward")} /></Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="kicker text-brand">{t("join.home")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("join.units")}><input className={inputClass} type="number" required min={1} max={10000} step="any" value={f.kwh} onChange={set("kwh")} /></Field>
            <Field label={t("check.discom")}>
              <select className={inputClass} value={f.discom} onChange={set("discom")}>
                {DISCOMS.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label={t("join.members")}><input className={inputClass} type="number" required min={1} max={30} value={f.members} onChange={set("members")} /></Field>
            <Field label={t("check.acs")}><input className={inputClass} type="number" required min={0} max={20} value={f.acs} onChange={set("acs")} /></Field>
            <Field label={t("join.commute")}>
              <select className={inputClass} value={f.commute} onChange={set("commute")}>
                {COMMUTES.map((c) => <option key={c} value={c}>{t(`commute.${c}` as MessageKey)}</option>)}
              </select>
            </Field>
            {f.commute !== "cycle_walk" && <Field label={t("join.km")}><input className={inputClass} type="number" min={0} max={500} step="any" value={f.km} onChange={set("km")} /></Field>}
            <Field label={t("join.lpg")}><input className={inputClass} type="number" required min={0} max={10} step="any" value={f.lpg} onChange={set("lpg")} /></Field>
            <Field label={t("check.roof")}><input className={inputClass} type="number" min={0} max={5000} value={f.roof} onChange={set("roof")} /></Field>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#0a7a57]" checked={f.geyser} onChange={set("geyser")} />{t("check.geyser")}</label>
            <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#0a7a57]" checked={f.washing} onChange={set("washing")} />{t("join.washing")}</label>
          </div>
        </fieldset>

        <ErrorNote message={error} />
        <button type="submit" disabled={busy} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white shadow-[var(--shadow)] hover:bg-brand-strong disabled:opacity-60">
          {busy ? t("join.creating") : t("join.create")}
        </button>
        <p className="text-center text-sm text-muted">{t("join.haveAccount")} <Link href="/login" className="font-semibold text-brand">{t("login.go")}</Link></p>
      </form>
    </CardPage>
  );
}
