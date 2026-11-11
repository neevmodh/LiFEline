"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DistrictDetailPanel, DistrictTable, KpiRow, LiveFeed, SolarPlanner, TrendPanel } from "@/components/Console";
import { CampaignsPanel, CommunitiesPanel, FunnelPanel, ThemesPanel } from "@/components/GedaPanels";
import { GujaratMap } from "@/components/map";
import { GedaStrip, LanguageSwitcher, Logo } from "@/components/Shell";
import { Badge, ErrorNote, Spinner, fmt, useLoad } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
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
    <section id="sec-reviews" className="scroll-mt-28 rounded-3xl bg-surface p-6 shadow-[var(--shadow)]">
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

const SECTIONS: [string, MessageKey][] = [
  ["sec-overview", "con.nav.overview"],
  ["sec-map", "con.nav.map"],
  ["sec-districts", "con.nav.districts"],
  ["sec-engagement", "con.nav.engagement"],
  ["sec-solar", "con.nav.solar"],
  ["sec-community", "con.nav.community"],
  ["sec-campaigns", "con.nav.campaigns"],
  ["sec-reviews", "con.nav.reviews"],
];

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

  // Loaded straight away: the session is restored from storage before the request goes out, and only
  // GEDA staff ever see this part of the page (the API refuses anyone else).
  const overview = useLoad(api.adminOverview);
  const sun = useLoad(api.districtSun);
  const [metric, setMetric] = useState<Metric>("sun");
  const [selected, setSelected] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [updated, setUpdated] = useState<Date>(() => new Date());
  const [active, setActive] = useState("sec-overview");

  // Refresh the headline figures every minute while the tab is open, if the user wants it.
  useEffect(() => {
    if (!auto || reviewer) return;
    const h = setInterval(() => { void overview.reload().then(() => setUpdated(new Date())); }, 60_000);
    return () => clearInterval(h);
  }, [auto, reviewer, overview]);

  // Highlight the section in view in the section bar.
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: "-120px 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [overview.data]);

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
  const open = (name: string) => { setSelected(name); document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  if (loading || !staff) return <div className="mx-auto w-full max-w-5xl px-4 pt-10"><Spinner /></div>;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <GedaStrip />
      <section className="hero pb-10">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <Logo light />
          <div className="no-print flex items-center gap-3 text-sm">
            <LanguageSwitcher />
            <button onClick={() => { signOut(); router.replace("/"); }} className="text-[#e9e2d3] hover:text-white">{t("nav.signOut2")}</button>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pt-2 sm:px-8">
          <div>
            <p className="kicker text-foam">{t("geda.kicker")}{reviewer && ` · ${t("geda.reviewerOnly")}`}</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{reviewer ? t("geda.queue") : t("geda.title")}</h1>
          </div>
          {!reviewer && (
            <div className="no-print flex flex-wrap items-center gap-2 text-sm text-[#d5dccf]">
              <span>{t("con.updated", { time: updated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) })}</span>
              <label className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#c9873e]" />
                {t("con.auto")}
              </label>
              <button onClick={() => void overview.reload().then(() => setUpdated(new Date()))} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">{t("con.refresh")}</button>
              <button onClick={() => window.print()} className="rounded-full bg-[#f6f2ea] px-3 py-1.5 font-semibold text-text hover:bg-white">{t("con.print")}</button>
            </div>
          )}
        </div>
      </section>

      {!reviewer && (
        <nav aria-label="Console sections" className="no-print sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-8">
            {SECTIONS.map(([id, k]) => (
              <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active === id ? "bg-navy text-[#f6f2ea]" : "text-muted hover:bg-surface-2 hover:text-text"}`}>
                {t(k)}
              </a>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 pb-16 pt-6 sm:px-8">
        {reviewer ? <Queue /> : (
          <>
            {overview.error && <ErrorNote message={overview.error} />}
            <div id="sec-overview" className="scroll-mt-28 grid items-start gap-6 xl:grid-cols-[1fr_380px]">
              <div className="space-y-6">
                {o && <KpiRow o={o} />}
                {o && o.citizens === 0 && <p className="rounded-2xl bg-sun-soft px-5 py-4 text-sm">{t("geda.noCitizens")}</p>}
                {o && <TrendPanel o={o} />}
              </div>
              <LiveFeed />
            </div>

            <section id="sec-map" className="scroll-mt-28 rounded-3xl bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{t("geda.mapTitle")}</h2>
                <div className="inline-flex rounded-full bg-surface-2 p-1 text-sm" role="tablist">
                  {(["sun", "citizens", "co2"] as Metric[]).map((m) => (
                    <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
                      className={`rounded-full px-4 py-1.5 font-medium ${metric === m ? "bg-surface shadow-sm" : "text-muted"}`}>
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
                      <h3 className="font-display text-2xl font-bold">{selected}</h3>
                      {sunByName[selected!] && <p className="num text-sm text-muted">{t("geda.sunUnit", { n: fmt.int(sunByName[selected!]) })}</p>}
                      {sel && (
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          {[[t("geda.detailCitizens"), fmt.int(sel.citizens)], [t("geda.detailActive"), fmt.int(sel.active_7d)], [t("geda.detailCo2"), fmt.kg(sel.co2_saved_30d_kg)], [t("geda.detailSolar"), `${fmt.int(sel.solar_potential_kwp)} kW`]].map(([k, v]) => (
                            <div key={k} className="rounded-2xl bg-bg p-3"><dt className="text-xs text-muted">{k}</dt><dd className="num mt-1 text-lg font-bold">{v}</dd></div>
                          ))}
                        </dl>
                      )}
                      {sel && <button onClick={() => open(sel.district)} className="min-h-11 rounded-full bg-navy px-5 text-sm font-semibold text-[#f6f2ea] hover:bg-abyss">{t("con.detail", { name: sel.district })}</button>}
                    </div>
                  ) : (
                    <p className="text-muted">{t("geda.pickDistrict")}</p>
                  )}
                  {metric === "sun" && <p className="mt-6 text-xs leading-relaxed text-muted">{t("geda.sunNote")}</p>}
                </div>
              </div>
            </section>

            <div id="sec-districts" className="scroll-mt-28 space-y-6">
              {o && <DistrictTable rows={o.districts} onOpen={open} selected={selected} />}
              <div id="detail" className="scroll-mt-28">
                {sel && <DistrictDetailPanel id={sel.district_id} onClose={() => setSelected(null)} />}
              </div>
            </div>

            <div id="sec-engagement" className="scroll-mt-28 grid items-start gap-6 lg:grid-cols-2">
              <FunnelPanel />
              <ThemesPanel />
            </div>

            <div id="sec-solar" className="scroll-mt-28">
              <SolarPlanner districts={(o?.districts ?? []).map((d) => ({ id: d.district_id, name: d.district })).sort((a, b) => a.name.localeCompare(b.name))} />
            </div>

            <div id="sec-community" className="scroll-mt-28"><CommunitiesPanel /></div>
            <div id="sec-campaigns" className="scroll-mt-28"><CampaignsPanel canRunState={user?.role === "admin"} /></div>

            <Queue onChange={() => overview.reload()} />
          </>
        )}
      </main>
    </div>
  );
}
