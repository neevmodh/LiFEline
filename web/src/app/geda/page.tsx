"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GujaratMap } from "@/components/map";
import { GedaStrip, LanguageSwitcher, Logo, WaveEdge } from "@/components/Shell";
import { Badge, ErrorNote, Spinner, fmt, useLoad } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type ReviewItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Metric = "sun" | "citizens" | "co2";

function ReviewRow({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    api.proofUrl(item.id).then((u) => { url = u; setSrc(u); }).catch(() => setSrc(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [item.id]);
  async function decide(approve: boolean) {
    setBusy(true);
    try { await api.decideReview(item.id, approve); onDone(); } catch (e) { setError(e instanceof Error ? e.message : t("common.error")); setBusy(false); }
  }
  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 text-xs text-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
        {src ? <img src={src} alt={item.action_title} className="h-full w-full object-cover" /> : "…"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.action_title}</p>
        <p className="text-xs text-muted">{item.user_name}{item.district && ` · ${item.district}`}</p>
        {item.ai_verdict && <p className="mt-1 text-xs text-muted"><Badge tone={item.ai_verdict === "likely" ? "brand" : item.ai_verdict === "unlikely" ? "danger" : "muted"}>AI: {item.ai_verdict}</Badge> {item.ai_reason}</p>}
        <ErrorNote message={error} />
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide(false)} className="min-h-11 rounded-full border-2 border-border px-5 text-sm font-semibold hover:bg-surface-2">{t("geda.reject")}</button>
        <button disabled={busy} onClick={() => decide(true)} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-strong">{t("geda.approve")}</button>
      </div>
    </li>
  );
}

function Queue({ onChange }: { onChange?: () => void }) {
  const { t } = useI18n();
  const q = useLoad(api.reviews);
  return (
    <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t("geda.queue")}</h2>
        <Badge tone="sun">{q.data?.length ?? 0}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">{t("geda.aiNote")}</p>
      {q.loading && !q.data ? <Spinner /> : q.data?.length ? (
        <ul className="mt-2 divide-y divide-border">
          {q.data.map((it) => <ReviewRow key={it.id} item={it} onDone={() => { q.setData((l) => l?.filter((r) => r.id !== it.id) ?? null); onChange?.(); }} />)}
        </ul>
      ) : <p className="mt-3 text-muted">{t("geda.queueEmpty")}</p>}
    </section>
  );
}

export default function GedaPage() {
  const { t } = useI18n();
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const reviewer = user?.role === "reviewer";
  const staff = !!user && user.role !== "citizen";

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "citizen") router.replace("/"); // households use the app
  }, [loading, user, router]);

  const overview = useLoad(async () => (staff && !reviewer ? api.adminOverview() : null));
  const sun = useLoad(api.districtSun);
  const [metric, setMetric] = useState<Metric>("sun");
  const [selected, setSelected] = useState<string | null>(null);

  const o = overview.data;
  const byName = useMemo(() => Object.fromEntries((o?.districts ?? []).map((d) => [d.district, d])), [o]);
  const sunByName = useMemo(() => Object.fromEntries((sun.data ?? []).map((d) => [d.district, d.kwh_per_kwp])), [sun.data]);
  const sel = selected ? byName[selected] : null;

  const values = useMemo(() => {
    if (metric === "sun") return sunByName;
    return Object.fromEntries((o?.districts ?? []).map((d) => [d.district, metric === "citizens" ? d.citizens : d.co2_saved_30d_kg]));
  }, [metric, sunByName, o]);
  const label = metric === "sun" ? `${t("geda.metricSun")} (kWh/kWp/yr)` : metric === "citizens" ? t("geda.metricCitizens") : t("geda.metricCo2");
  const format = (v: number) => (metric === "sun" ? fmt.int(v) : metric === "citizens" ? fmt.int(v) : fmt.kg(v));

  if (loading || !staff) return <div className="mx-auto w-full max-w-5xl px-4 pt-10"><Spinner /></div>;

  return (
    <div className="flex flex-1 flex-col">
      <GedaStrip />
      <section className="hero pb-16">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <Logo light />
          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher />
            <button onClick={() => { signOut(); router.replace("/"); }} className="text-[#cfeee6] hover:text-white">{t("nav.signOut2")}</button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-8">
          <p className="kicker text-[#8fe3cf]">{t("geda.kicker")}{reviewer && ` · ${t("geda.reviewerOnly")}`}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{reviewer ? t("geda.queue") : t("geda.title")}</h1>
        </div>
        <WaveEdge />
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pb-16 sm:px-8">
        {reviewer ? <Queue /> : (
          <>
            {overview.error && <ErrorNote message={overview.error} />}
            {o && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [t("geda.citizens"), fmt.int(o.citizens), t("geda.reached", { n: o.districts.filter((d) => d.citizens > 0).length })],
                  [t("geda.active"), fmt.int(o.active_7d), o.citizens ? `${Math.round((o.active_7d / o.citizens) * 100)}%` : ""],
                  [t("geda.co2"), fmt.kg(o.co2_saved_total_kg), `${fmt.kg(o.co2_verified_total_kg)} photo-verified`],
                  [t("geda.kwh"), `${fmt.int(o.kwh_saved_total)} kWh`, `${o.pending_reviews} ${t("geda.queue").toLowerCase()}`],
                ].map(([l, v, h]) => (
                  <div key={l} className="rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{l}</p>
                    <p className="num mt-1 text-3xl font-bold">{v}</p>
                    <p className="mt-1 text-xs text-muted">{h}</p>
                  </div>
                ))}
              </div>
            )}
            {o && o.citizens === 0 && <p className="rounded-2xl bg-sun-soft px-5 py-4 text-sm">{t("geda.noCitizens")}</p>}

            <section className="rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{t("geda.mapTitle")}</h2>
                <div className="inline-flex rounded-full bg-surface-2 p-1 text-sm" role="tablist">
                  {(["sun", "citizens", "co2"] as Metric[]).map((m) => (
                    <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
                      className={`rounded-full px-4 py-1.5 font-medium ${metric === m ? "bg-white shadow-sm" : "text-muted"}`}>
                      {m === "sun" ? t("geda.metricSun") : m === "citizens" ? t("geda.metricCitizens") : t("geda.metricCo2")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <GujaratMap metric={{ label, values, format }} selected={selected} onSelect={setSelected} height={460} />
                <div>
                  {sel || selected ? (
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold">{selected}</h3>
                      {sunByName[selected!] && <p className="num text-sm text-muted">{t("geda.sunUnit", { n: fmt.int(sunByName[selected!]) })}</p>}
                      {sel && (
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          {[[t("geda.detailCitizens"), fmt.int(sel.citizens)], [t("geda.detailActive"), fmt.int(sel.active_7d)], [t("geda.detailCo2"), fmt.kg(sel.co2_saved_30d_kg)], [t("geda.detailSolar"), `${fmt.int(sel.solar_potential_kwp)} kW`]].map(([k, v]) => (
                            <div key={k} className="rounded-2xl bg-surface-2 p-3"><dt className="text-xs text-muted">{k}</dt><dd className="num mt-1 text-lg font-bold">{v}</dd></div>
                          ))}
                        </dl>
                      )}
                      {sel && <button onClick={() => api.downloadDistrictReport(sel.district_id)} className="min-h-11 rounded-full border-2 border-brand px-5 text-sm font-semibold text-brand-strong hover:bg-brand-soft">{t("geda.csv")}</button>}
                    </div>
                  ) : (
                    <p className="text-muted">{t("geda.pickDistrict")}</p>
                  )}
                  {metric === "sun" && <p className="mt-6 text-xs leading-relaxed text-muted">{t("geda.sunNote")}</p>}
                </div>
              </div>
            </section>

            <Queue onChange={() => overview.reload()} />
          </>
        )}
      </main>
    </div>
  );
}
