"use client";

// The GEDA console's working panels: headline figures with 8-week sparklines, the weekly trend, a
// sortable district table with CSV export, a district drill-down, the rooftop solar planner and a
// live activity feed. The API scopes everything: a district officer only ever receives their own.
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorNote, Spinner, fmt } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, type Activity, type AdminOverview, type DistrictDetail, type SolarScenario } from "@/lib/api";

export const panel = "rounded-3xl bg-surface p-5 shadow-[var(--shadow)] sm:p-6";
const INK = "#23312a";
const SAGE = "#4e7d5e";
const SAFFRON = "#c9873e";
const SKY = "#45678a";
const GRID = "#e7e0d3";
const tick = { fill: "#5f6b63", fontSize: 11 };
const shortWeek = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Counts up to `target` once it is known. */
function useCount(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now(), a = from.current;
    let raf = 0;
    if (reduce) {
      raf = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(raf);
    }
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const val = a + (target - a) * (1 - Math.pow(1 - p, 3));
      setV(val);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const rows = data.map((y, i) => ({ i, y }));
  return (
    <div className="h-10 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ label, value, render, hint, series, color }: { label: string; value: number; render: (n: number) => string; hint: string; series: number[]; color: string }) {
  const v = useCount(value);
  return (
    <div className="tilt rounded-3xl bg-surface p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="num mt-1 font-display text-3xl font-bold">{render(v)}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <div className="mt-3"><Spark data={series} color={color} /></div>
    </div>
  );
}

export function KpiRow({ o }: { o: AdminOverview }) {
  const { t } = useI18n();
  const weeks = o.weekly.slice(-8);
  const reached = o.districts.filter((d) => d.citizens > 0).length;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label={t("geda.citizens")} value={o.citizens} render={fmt.int} hint={t("geda.reached", { n: reached })} series={weeks.map((w) => w.active_citizens)} color={INK} />
      <Kpi label={t("geda.active")} value={o.active_7d} render={fmt.int} hint={o.citizens ? `${Math.round((o.active_7d / o.citizens) * 100)}%` : "–"} series={weeks.map((w) => w.active_citizens)} color={SAGE} />
      <Kpi label={t("geda.co2")} value={o.co2_saved_total_kg} render={fmt.kg} hint={`${fmt.kg(o.co2_verified_total_kg)} photo-verified`} series={weeks.map((w) => w.co2_saved_kg)} color={SAFFRON} />
      <Kpi label={t("geda.kwh")} value={o.kwh_saved_total} render={(n) => `${fmt.int(n)} kWh`} hint={`${o.pending_reviews} ${t("geda.queue").toLowerCase()}`} series={weeks.map((w) => w.actions)} color={SKY} />
    </div>
  );
}

export function TrendPanel({ o }: { o: AdminOverview }) {
  const { t } = useI18n();
  const rows = o.weekly.slice(-8).map((w) => ({ week: shortWeek(w.week_start), actions: w.actions, active: w.active_citizens, co2: Math.round(w.co2_saved_kg) }));
  return (
    <section className={panel} aria-labelledby="trend">
      <h2 id="trend" className="text-lg font-bold">{t("con.trend")}</h2>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="week" tick={tick} axisLine={false} tickLine={false} />
            <YAxis tick={tick} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, background: "#fffdf8" }} />
            <Area type="monotone" name={t("con.trendActions")} dataKey="actions" stroke={SAFFRON} strokeWidth={2.5} fill={SAFFRON} fillOpacity={0.12} />
            <Area type="monotone" name={t("con.trendActive")} dataKey="active" stroke={SAGE} strokeWidth={2.5} fill={SAGE} fillOpacity={0.12} />
            <Area type="monotone" name={t("con.trendCo2")} dataKey="co2" stroke={SKY} strokeWidth={2} fill={SKY} fillOpacity={0.06} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        {[[SAFFRON, t("con.trendActions")], [SAGE, t("con.trendActive")], [SKY, t("con.trendCo2")]].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>
    </section>
  );
}

type Row = AdminOverview["districts"][number];
type SortKey = "district" | "citizens" | "active_7d" | "participation_pct" | "actions_30d" | "co2_saved_30d_kg" | "co2_per_citizen_30d_kg" | "solar_potential_kwp";

export function DistrictTable({ rows, onOpen, selected }: { rows: Row[]; onOpen: (name: string) => void; selected: string | null }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("citizens");
  const [desc, setDesc] = useState(true);
  const cols: [SortKey, MessageKey, (r: Row) => string][] = [
    ["district", "con.col.district", (r) => r.district],
    ["citizens", "con.col.citizens", (r) => fmt.int(r.citizens)],
    ["active_7d", "con.col.active", (r) => fmt.int(r.active_7d)],
    ["participation_pct", "con.col.part", (r) => (r.participation_pct == null ? "–" : `${Math.round(r.participation_pct)}%`)],
    ["actions_30d", "con.col.actions", (r) => fmt.int(r.actions_30d)],
    ["co2_saved_30d_kg", "con.col.co2", (r) => fmt.kg(r.co2_saved_30d_kg)],
    ["co2_per_citizen_30d_kg", "con.col.perCitizen", (r) => (r.co2_per_citizen_30d_kg == null ? "–" : fmt.kg(r.co2_per_citizen_30d_kg))],
    ["solar_potential_kwp", "con.col.solar", (r) => `${fmt.int(r.solar_potential_kwp)} kW`],
  ];
  const shown = useMemo(() => {
    const f = rows.filter((r) => r.district.toLowerCase().includes(q.trim().toLowerCase()));
    return [...f].sort((a, b) => {
      const x = a[sort] ?? -1, y = b[sort] ?? -1;
      const c = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return desc ? -c : c;
    });
  }, [rows, q, sort, desc]);
  const maxCit = Math.max(1, ...rows.map((r) => r.citizens));

  function exportCsv() {
    const head = cols.map(([, k]) => t(k)).join(",");
    const body = shown.map((r) => [r.district, r.citizens, r.active_7d, r.participation_pct ?? "", r.actions_30d, r.co2_saved_30d_kg.toFixed(1), r.co2_per_citizen_30d_kg?.toFixed(2) ?? "", Math.round(r.solar_potential_kwp)].join(",")).join("\n");
    const blob = new Blob([`${head}\n${body}\n`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nidhi-districts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className={panel} aria-labelledby="dtable">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dtable" className="text-lg font-bold">{t("con.table")}</h2>
        <div className="no-print flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="dsearch">{t("con.search")}</label>
          <input id="dsearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("con.search")} className="min-h-10 rounded-full border border-border bg-bg px-4 text-sm outline-none focus:border-brand" />
          <button onClick={exportCsv} className="min-h-10 rounded-full border border-border px-4 text-sm font-semibold hover:bg-surface-2">{t("con.export")}</button>
        </div>
      </div>
      <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2 text-left text-xs text-muted">
            <tr>
              {cols.map(([k, label]) => (
                <th key={k} scope="col" className="px-3 py-2.5 font-semibold" aria-sort={sort === k ? (desc ? "descending" : "ascending") : "none"}>
                  <button onClick={() => { if (sort === k) setDesc(!desc); else { setSort(k); setDesc(k !== "district"); } }} className="inline-flex items-center gap-1 hover:text-text">
                    {t(label)}{sort === k && <span aria-hidden>{desc ? "↓" : "↑"}</span>}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.district_id} className={`border-t border-border ${selected === r.district ? "bg-brand-soft" : "hover:bg-bg"}`}>
                {cols.map(([k, , render], i) => (
                  <td key={k} className={`px-3 py-2.5 ${i === 0 ? "font-semibold" : "num"}`}>
                    {k === "citizens" ? (
                      <div className="flex items-center gap-2"><span className="w-10 text-right">{render(r)}</span><span className="h-1.5 w-16 rounded-full bg-surface-2"><span className="block h-1.5 rounded-full bg-brand" style={{ width: `${(r.citizens / maxCit) * 100}%` }} /></span></div>
                    ) : render(r)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right"><button onClick={() => onOpen(r.district)} className="no-print rounded-full px-3 py-1 text-xs font-semibold text-brand-strong hover:bg-brand-soft">{t("con.open")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DistrictDetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<DistrictDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.districtDetail(id).then((x) => live && setD(x)).catch((e) => live && setError(e instanceof Error ? e.message : t("common.error")));
    return () => { live = false; };
  }, [id, t]);
  if (error) return <ErrorNote message={error} />;
  if (!d || d.district_id !== id) return <section className={panel}><Spinner /></section>;
  const consumption = d.consumption.map((c) => ({ month: fmt.month(c.month), kwh: Math.round(c.avg_kwh) }));
  const cats = d.categories.slice(0, 7).map((c) => ({ name: c.category, actions: c.actions }));
  return (
    <section className={`${panel} anim-rise`} aria-labelledby="ddetail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ddetail" className="font-display text-2xl font-bold">{t("con.detail", { name: d.district })}</h2>
          <p className="text-sm text-muted">{fmt.int(d.citizens)} {t("geda.citizens").toLowerCase()} · {fmt.int(d.onboarded)} set up · {d.participation_pct == null ? "–" : `${Math.round(d.participation_pct)}%`} taking part</p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={() => api.downloadDistrictReport(d.district_id)} className="min-h-10 rounded-full border border-border px-4 text-sm font-semibold hover:bg-surface-2">{t("geda.csv")}</button>
          <button onClick={onClose} className="min-h-10 rounded-full px-4 text-sm font-semibold text-muted hover:bg-surface-2">{t("con.close")}</button>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[t("geda.detailActive"), fmt.int(d.active_7d)], [t("con.col.actions"), fmt.int(d.actions_30d)], [t("geda.detailCo2"), fmt.kg(d.co2_saved_30d_kg)], [t("con.peakShifts"), fmt.int(d.peak_shifts_30d)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-bg p-3"><dt className="text-xs text-muted">{k}</dt><dd className="num mt-1 font-display text-xl font-bold">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t("con.consumption")}</h3>
          <div className="mt-2 h-48">
            {consumption.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={consumption} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, background: "#fffdf8" }} />
                  <Line type="monotone" dataKey="kwh" stroke={INK} strokeWidth={2.5} dot={{ r: 3, fill: SAFFRON, stroke: SAFFRON }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted">–</p>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t("geda.themes")}</h3>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={tick} width={70} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1ebdf" }} contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, background: "#fffdf8" }} />
                <Bar dataKey="actions" fill={SAGE} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t("con.wards")}</h3>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
            {d.top_wards.length ? d.top_wards.map((w) => (
              <li key={w.ward} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span className="font-medium">{w.ward}</span><span className="num text-muted">{t("con.wardLine", { n: w.citizens, kg: fmt.kg(w.co2_saved_30d_kg) })}</span></li>
            )) : <li className="px-4 py-2.5 text-sm text-muted">–</li>}
          </ul>
        </div>
        <div className="rounded-2xl bg-sun-soft p-4">
          <h3 className="text-sm font-semibold text-sun">{t("con.solarBlock")}</h3>
          <p className="mt-2 text-sm">{t("con.solarLine", { s: fmt.int(d.solar.suitable_households), i: fmt.int(d.solar.installed_households), kw: fmt.int(d.solar.potential_kwp) })}</p>
          <p className="mt-1 text-sm">{t("con.solarYield", { mwh: fmt.int(d.solar.annual_generation_kwh / 1000), t: d.solar.annual_co2_avoided_t.toFixed(1), rs: fmt.rs(d.solar.subsidy_pipeline_rs) })}</p>
          <p className="mt-2 text-xs text-muted">{t("con.surveys")}: {fmt.int(d.solar_survey_requests)}</p>
        </div>
      </div>
    </section>
  );
}

export function SolarPlanner({ districts }: { districts: { id: number; name: string }[] }) {
  const { t } = useI18n();
  const [pct, setPct] = useState(20);
  const [area, setArea] = useState<number | 0>(0);
  const [debounced, setDebounced] = useState(20);
  useEffect(() => { const h = setTimeout(() => setDebounced(pct), 300); return () => clearTimeout(h); }, [pct]);
  // Each answer remembers which question it answers, so "loading" is simply "not this one yet".
  const ask = `${debounced}:${area}`;
  const [s, setS] = useState<{ key: string; data: SolarScenario | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    let live = true;
    api.solarScenario(debounced, area || undefined)
      .then((data) => live && setS({ key: ask, data, error: null }))
      .catch((e) => live && setS((p) => ({ ...p, key: ask, error: e instanceof Error ? e.message : t("common.error") })));
    return () => { live = false; };
  }, [debounced, area, ask, t]);
  const loading = s.key !== ask;
  const r = s.data;
  const tiles: [MessageKey, string][] = r ? [
    ["con.capacity", r.capacity_mw >= 1 ? `${r.capacity_mw.toFixed(1)} MW` : `${fmt.int(r.capacity_mw * 1000)} kW`],
    ["con.generation", `${fmt.int(r.annual_generation_mwh)} MWh`],
    ["con.co2Year", `${fmt.int(r.annual_co2_avoided_t)} t`],
    ["con.billSavings", fmt.rs(r.annual_bill_savings_rs)],
    ["con.subsidy", fmt.rs(r.subsidy_needed_rs)],
    ["con.payback", r.payback_years == null ? "–" : t("con.years", { n: r.payback_years.toFixed(1) })],
  ] : [];
  return (
    <section className={panel} aria-labelledby="planner">
      <h2 id="planner" className="text-lg font-bold">{t("con.planner")}</h2>
      <p className="mt-1 text-sm text-muted">{t("con.plannerSub")}</p>
      <div className="no-print mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="flex justify-between text-sm font-semibold"><span>{t("con.adoption")}</span><span className="num font-display text-2xl">{pct}%</span></span>
          <input type="range" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-2 w-full accent-[#4e7d5e]" />
        </label>
        <label className="block text-sm font-semibold">
          {t("con.scope")}
          <select value={area} onChange={(e) => setArea(Number(e.target.value))} className="mt-1 block min-h-10 w-full rounded-full border border-border bg-bg px-4 text-sm sm:w-56">
            <option value={0}>{t("con.allGujarat")}</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </div>
      {s.error && <ErrorNote message={s.error} />}
      {r && (
        <>
          <p className="mt-4 text-sm">{t("con.homes", { a: fmt.int(r.adopting_homes), s: fmt.int(r.suitable_homes) })}</p>
          <dl className={`mt-3 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
            {tiles.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-bg p-3"><dt className="text-xs text-muted">{t(k)}</dt><dd className="num mt-1 font-display text-xl font-bold">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">{t("con.per1000", { mw: r.per_1000_homes.capacity_mw.toFixed(2), t: fmt.int(r.per_1000_homes.annual_co2_avoided_t), rs: fmt.rs(r.per_1000_homes.annual_bill_savings_rs) })}</p>
          <p className="mt-1 text-xs text-muted">{r.yield_source === "pvgis" ? t("con.yieldPvgis") : t("con.yieldDefault")}</p>
        </>
      )}
    </section>
  );
}

function ago(iso: string, t: (k: MessageKey, p?: Record<string, string | number>) => string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? t("con.now") : t("con.ago", { n: m });
}

/** New activity every 15 seconds, newest first; fresh rows slide in. */
export function LiveFeed() {
  const { t } = useI18n();
  const [items, setItems] = useState<(Activity & { key: string; fresh: boolean })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const since = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    const pull = async () => {
      try {
        const got = await api.activity(since.current);
        if (!live || !got.length) return;
        since.current = got.reduce((m, a) => (a.at > m ? a.at : m), since.current ?? got[0].at);
        setItems((old) => {
          const keyed = got.map((a) => ({ ...a, key: `${a.at}-${a.kind}-${a.first_name}-${a.action_title ?? ""}`, fresh: old.length > 0 }));
          const seen = new Set(old.map((o) => o.key));
          return [...keyed.filter((k) => !seen.has(k.key)), ...old.map((o) => ({ ...o, fresh: false }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
        });
        setError(null);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : t("common.error"));
      }
    };
    void pull();
    const h = setInterval(pull, 15000);
    return () => { live = false; clearInterval(h); };
  }, [t]);
  const line = (a: Activity) => {
    const where = a.district ? ` · ${a.district}` : "";
    const what = a.action_title ?? "";
    return a.kind === "joined" ? t("con.feed.joined", { name: a.first_name, where }) : a.kind === "proof" ? t("con.feed.proof", { name: a.first_name, what, where }) : t("con.feed.action", { name: a.first_name, what, where });
  };
  const dot = { joined: SKY, action: SAGE, proof: SAFFRON };
  return (
    <section className={panel} aria-labelledby="feed">
      <div className="flex items-center gap-2">
        <span className="anim-live h-2.5 w-2.5 rounded-full bg-saffron" aria-hidden />
        <h2 id="feed" className="text-lg font-bold">{t("con.feed")}</h2>
      </div>
      <ErrorNote message={error} />
      <ul className="mt-3 max-h-[420px] space-y-1 overflow-auto pr-1" aria-live="polite">
        {items.length === 0 && <li className="text-sm text-muted">{t("con.feedEmpty")}</li>}
        {items.map((a) => (
          <li key={a.key} className={`flex items-start gap-3 rounded-2xl px-3 py-2 ${a.fresh ? "anim-rise bg-sun-soft" : ""}`}>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot[a.kind] }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{line(a)}</p>
              <p className="text-xs text-muted">{ago(a.at, t)}{a.co2_saved_kg ? ` · ${fmt.kg(a.co2_saved_kg)} CO₂` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
