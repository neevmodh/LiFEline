"use client";

// GEDA console panels: the participation funnel, Mission LiFE themes, communities and duels, and
// campaigns with Peak Hour Challenges, and rooftop solar survey requests. The API scopes every panel: district officers only ever
// receive their own district, so nothing here filters by role.
import { useState } from "react";
import { Badge, ErrorNote, Field, ProgressBar, Spinner, fmt, inputClass, useLoad } from "@/components/ui";
import { dateTag, maybe, useI18n, type MessageKey } from "@/i18n";
import { CAMPAIGN_TEMPLATES, templateDates, type CampaignTemplate } from "@/lib/campaign-templates";
import { project, type Spread } from "@/lib/projection";
import { api, type AdminSolarLead, type Campaign, type CampaignInput, type LeadStatus } from "@/lib/api";

const panel = "rounded-3xl bg-surface p-5 shadow-[var(--shadow)] sm:p-6";

export function FunnelPanel() {
  const { t } = useI18n();
  const f = useLoad(api.adminFunnel);
  if (f.loading && !f.data) return <section className={panel}><Spinner /></section>;
  if (!f.data) return <ErrorNote message={f.error} />;
  const steps: [MessageKey, number][] = [
    ["geda.funnelRegistered", f.data.registered],
    ["geda.funnelOnboarded", f.data.onboarded],
    ["geda.funnelActive", f.data.active_7d],
    ["geda.funnelVerified", f.data.verified],
  ];
  const top = Math.max(f.data.registered, 1);
  return (
    <section className={panel} aria-labelledby="funnel">
      <h2 id="funnel" className="text-lg font-bold">{t("geda.funnel")}{f.data.district && ` · ${f.data.district}`}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map(([k, n], i) => (
          <li key={k}>
            <div className="flex items-baseline justify-between text-sm">
              <span>{t(k)}</span>
              <span className="num font-bold">
                {fmt.int(n)}
                {i > 0 && steps[i - 1][1] > 0 && <span className="ml-2 text-xs font-normal text-muted">{Math.round((n / steps[i - 1][1]) * 100)}%</span>}
              </span>
            </div>
            <div className="mt-1 h-3 rounded-full bg-surface-2"><div className="h-3 rounded-full bg-brand" style={{ width: `${(n / top) * 100}%` }} /></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ThemesPanel() {
  const { t, locale } = useI18n();
  const q = useLoad(api.adminThemes);
  return (
    <section className={panel} aria-labelledby="themes">
      <h2 id="themes" className="text-lg font-bold">{t("geda.themes")}</h2>
      <p className="mt-1 text-xs text-muted">{t("geda.themesNote")}</p>
      {q.loading && !q.data ? <Spinner /> : <ErrorNote message={q.error} />}
      <ul className="mt-3 divide-y divide-border">
        {q.data?.map((th) => (
          <li key={th.theme} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">{maybe(locale, `theme.${th.theme}`, th.label)}</p>
              <p className="text-xs text-muted">{t("geda.themeActions", { n: th.actions, v: th.verified_actions, h: th.households })}</p>
            </div>
            <p className="num text-sm font-bold">{th.co2_kg > 0 ? fmt.kg(th.co2_kg) : "–"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CommunitiesPanel() {
  const { t, locale } = useI18n();
  const q = useLoad(api.adminCommunities);
  const c = q.data;
  return (
    <section className={panel} aria-labelledby="communities">
      <h2 id="communities" className="text-lg font-bold">{t("geda.communities")}</h2>
      {q.loading && !c ? <Spinner /> : <ErrorNote message={q.error} />}
      {c && (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="kicker text-brand">{t("geda.kinds")}</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {c.by_kind.map((k) => (
                <li key={k.kind}><span className="font-semibold capitalize">{maybe(locale, `comm.kind.${k.kind}`, k.kind)}</span> · <span className="text-muted">{t("geda.kindLine", { c: k.communities, h: k.households })}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="kicker text-brand">{t("geda.top")}</h3>
            <ol className="mt-2 divide-y divide-border text-sm">
              {c.top.map((s, i) => (
                <li key={s.society_id} className="flex items-center gap-3 py-2">
                  <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-saffron text-abyss" : "bg-surface-2 text-text"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.name}</span>
                    <span className="block text-xs text-muted capitalize">{maybe(locale, `comm.kind.${s.kind}`, s.kind)} · {s.district}</span>
                  </span>
                  <span className="num shrink-0 text-right text-xs font-semibold text-brand-strong">{s.co2_per_household_kg} kg</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="kicker text-brand">{t("geda.duels")}</h3>
            {c.duels.length === 0 && <p className="mt-2 text-sm text-muted">{t("geda.duelsNone")}</p>}
            <ul className="mt-2 space-y-3 text-sm">
              {c.duels.map((d) => (
                <li key={d.id} className="rounded-2xl bg-surface-2 p-3">
                  <p className="font-semibold">{d.challenger.name} <span className="text-muted">vs</span> {d.opponent.name}</p>
                  {d.status === "pending" ? (
                    <p className="mt-1 text-xs text-muted">{t("geda.duelPending", { name: d.opponent.name })}</p>
                  ) : (
                    <>
                      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white">
                        <div className="bg-brand" style={{ width: `${Math.min(50, d.challenger.participation_pct / 2)}%` }} />
                        <div className="flex-1" />
                        <div className="bg-saffron" style={{ width: `${Math.min(50, d.opponent.participation_pct / 2)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {t("geda.duelLine", { a: Math.round(d.challenger.participation_pct), b: Math.round(d.opponent.participation_pct), days: d.days_left ?? 0 })}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export function CampaignsPanel({ canRunState }: { canRunState: boolean }) {
  const { t } = useI18n();
  const q = useLoad(api.adminCampaigns);
  const districts = useLoad(api.districts);
  const actions = useLoad(api.actionTypes);
  const [form, setForm] = useState<"campaign" | "peak" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(c: Campaign) {
    try {
      await api.deleteCampaign(c.id);
      q.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <section className={panel} aria-labelledby="campaigns">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="campaigns" className="text-lg font-bold">{t("geda.campaigns")}</h2>
        <div className="flex gap-2">
          <button onClick={() => setForm(form === "campaign" ? null : "campaign")} className="min-h-11 rounded-full border-2 border-brand px-4 text-sm font-semibold text-brand-strong hover:bg-brand-soft">{t("geda.newCampaign")}</button>
          <button onClick={() => setForm(form === "peak" ? null : "peak")} className="min-h-11 rounded-full bg-saffron px-4 text-sm font-semibold text-abyss hover:brightness-105">⚡ {t("geda.newPeak")}</button>
        </div>
      </div>
      {form && (
        <CampaignForm
          kind={form}
          canRunState={canRunState}
          districts={districts.data ?? []}
          actions={(actions.data ?? []).map((a) => ({ code: a.code, title: a.title }))}
          onDone={() => { setForm(null); q.reload(); }}
        />
      )}
      <ErrorNote message={error ?? q.error} />
      {q.loading && !q.data ? <Spinner /> : q.data?.length === 0 ? <p className="mt-3 text-muted">{t("geda.campaignsNone")}</p> : null}
      <ul className="mt-3 divide-y divide-border">
        {q.data?.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {c.kind === "peak" && "⚡ "}{c.title} {c.live && <Badge tone="danger">{t("geda.live")}</Badge>}
              </p>
              <p className="text-xs text-muted">
                {c.scope_label} · {c.kind === "peak" ? t("geda.cPeakWindow", { day: c.starts_on, from: c.start_hour ?? 0, to: c.end_hour ?? 0 }) : `${c.starts_on} → ${c.ends_on}`}
                {c.action_title && ` · ${c.action_title}`}
              </p>
              <div className="mt-2 max-w-md"><ProgressBar value={c.progress_pct} tone={c.kind === "peak" ? "sun" : "brand"} /></div>
              <p className="mt-1 text-xs text-muted">{t("geda.cProgress", { p: c.progress, t: c.target, people: c.participants })}</p>
            </div>
            {c.can_delete && <button onClick={() => remove(c)} className="min-h-11 rounded-full border-2 border-border px-4 text-sm font-semibold hover:bg-surface-2">{t("geda.cDelete")}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CampaignForm({ kind, canRunState, districts, actions, onDone }: {
  kind: "campaign" | "peak";
  canRunState: boolean;
  districts: { id: number; name: string }[];
  actions: { code: string; title: string }[];
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState(() => {
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST date
    return {
      title: "", description: "", target: "100", starts_on: today, ends_on: today, start_hour: "18", end_hour: "20",
      scope: (canRunState ? "state" : "district") as "state" | "district", scope_id: "", action_code: "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const peak = kind === "peak";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: CampaignInput = {
      title: f.title, description: f.description, target: Number(f.target), starts_on: f.starts_on,
      ends_on: peak ? f.starts_on : f.ends_on, scope: f.scope, scope_id: f.scope === "district" && f.scope_id ? Number(f.scope_id) : null,
      action_code: peak ? null : f.action_code || null,
      ...(peak ? { kind: "peak" as const, start_hour: Number(f.start_hour), end_hour: Number(f.end_hour) } : {}),
    };
    try {
      await api.createCampaign(body);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  function applyTemplate(tpl: CampaignTemplate) {
    setF((p) => ({
      ...p,
      title: t(`geda.tpl.${tpl.key}.title` as Parameters<typeof t>[0]),
      description: t(`geda.tpl.${tpl.key}.body` as Parameters<typeof t>[0]),
      target: String(tpl.target),
      action_code: tpl.action_code,
      ...templateDates(tpl, p.starts_on),
    }));
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 rounded-2xl bg-surface-2 p-4 sm:grid-cols-2">
      {!peak && (
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("geda.tpl.pick")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CAMPAIGN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="min-h-10 rounded-full border border-border bg-surface px-4 text-sm font-semibold hover:border-brand hover:bg-brand-soft"
              >
                {t(`geda.tpl.${tpl.key}.chip` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>
      )}
      <Field label={t("geda.cTitle")}><input className={inputClass} required minLength={3} maxLength={120} value={f.title} onChange={set("title")} /></Field>
      <Field label={t("geda.cTarget")}><input className={inputClass} type="number" required min={1} value={f.target} onChange={set("target")} /></Field>
      <Field label={t("geda.cDescription")}><input className={inputClass} maxLength={500} value={f.description} onChange={set("description")} /></Field>
      <Field label={t("geda.cScope")}>
        <select className={inputClass} value={f.scope} onChange={set("scope")}>
          {canRunState && <option value="state">{t("geda.cState")}</option>}
          <option value="district">{t("geda.cDistrict")}</option>
        </select>
      </Field>
      {f.scope === "district" && canRunState && (
        <Field label={t("geda.cDistrict")}>
          <select className={inputClass} required value={f.scope_id} onChange={set("scope_id")}>
            <option value="">{t("join.districtPick")}</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      )}
      <Field label={peak ? t("geda.cDay") : t("geda.cStarts")}><input className={inputClass} type="date" required value={f.starts_on} onChange={set("starts_on")} /></Field>
      {peak ? (
        <>
          <Field label={t("geda.cFrom")}><input className={inputClass} type="number" required min={0} max={23} value={f.start_hour} onChange={set("start_hour")} /></Field>
          <Field label={t("geda.cTo")}><input className={inputClass} type="number" required min={1} max={24} value={f.end_hour} onChange={set("end_hour")} /></Field>
        </>
      ) : (
        <>
          <Field label={t("geda.cEnds")}><input className={inputClass} type="date" required value={f.ends_on} onChange={set("ends_on")} /></Field>
          <Field label={t("geda.cAction")}>
            <select className={inputClass} value={f.action_code} onChange={set("action_code")}>
              <option value="">{t("geda.cAnyAction")}</option>
              {actions.map((a) => <option key={a.code} value={a.code}>{a.title}</option>)}
            </select>
          </Field>
        </>
      )}
      <div className="sm:col-span-2">
        <ErrorNote message={error} />
        <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60">{t("geda.cCreate")}</button>
      </div>
    </form>
  );
}


const LEAD_ORDER: LeadStatus[] = ["new", "contacted", "survey_done", "quoted", "installed", "dropped"];

/** Rooftop survey requests from households, and where each has got to. */
export function SolarLeadsPanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useI18n();
  const q = useLoad(api.adminSolarLeads);
  const d = q.data;
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function move(lead: AdminSolarLead, status: LeadStatus) {
    setBusy(lead.id);
    setError(null);
    try {
      await api.updateSolarLead(lead.id, { status });
      await q.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }
  const total = d ? LEAD_ORDER.reduce((s, k) => s + (d.counts[k] ?? 0), 0) : 0;
  return (
    <section className={panel} aria-labelledby="solar-leads">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="solar-leads" className="text-lg font-bold">{t("geda.leads.title")}</h2>
        {d && <p className="text-sm text-muted">{t("geda.leads.kwp", { n: total, kwp: d.kwp_requested })}</p>}
      </div>
      <p className="mt-1 text-sm text-muted">{t("geda.leads.sub")}</p>
      {q.loading && !d ? <Spinner /> : <ErrorNote message={q.error ?? error} />}
      {d && (
        <>
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {LEAD_ORDER.map((k) => (
              <li key={k} className={`rounded-2xl p-3 ${k === "installed" ? "bg-brand-soft" : k === "dropped" ? "bg-surface-2" : "bg-sun-soft"}`}>
                <p className="num text-2xl font-bold">{d.counts[k] ?? 0}</p>
                <p className="text-xs font-semibold text-muted">{t(`geda.leads.${k}` as MessageKey)}</p>
              </li>
            ))}
          </ol>
          {d.leads.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("geda.leads.none")}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-3">{t("geda.leads.who")}</th>
                    <th className="py-2 pr-3">{t("geda.leads.system")}</th>
                    <th className="py-2 pr-3">{t("geda.leads.note")}</th>
                    <th className="py-2 pr-3">{t("geda.leads.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.leads.map((lead) => (
                    <tr key={lead.id} className="align-top">
                      <td className="py-2 pr-3">
                        <p className="font-semibold">{lead.name}</p>
                        <p className="text-xs text-muted">{[lead.district, lead.phone, lead.email].filter(Boolean).join(" · ")}</p>
                        <p className="text-xs text-muted">{new Date(lead.created_at).toLocaleDateString(dateTag(), { day: "numeric", month: "short" })}</p>
                      </td>
                      <td className="num py-2 pr-3">{lead.kwp} kW · {Math.round(lead.roof_area_sqm)} m² · {Math.round(lead.monthly_kwh)} kWh</td>
                      <td className="py-2 pr-3 text-muted">{lead.note || "—"}</td>
                      <td className="py-2 pr-3">
                        {canEdit ? (
                          <select
                            aria-label={t("geda.leads.status")}
                            className={`${inputClass} min-w-[9.5rem] py-1.5`}
                            value={lead.status}
                            disabled={busy === lead.id}
                            onChange={(e) => void move(lead, e.target.value as LeadStatus)}
                          >
                            {LEAD_ORDER.map((k) => (
                              <option key={k} value={k}>{t(`geda.leads.${k}` as MessageKey)}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={lead.status === "installed" ? "brand" : lead.status === "dropped" ? "muted" : "sun"}>{t(`geda.leads.${lead.status}` as MessageKey)}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}


const HOME_PRESETS = [10_000, 100_000, 1_000_000];
const mwh = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en-IN") : n.toFixed(1));
const range = (s: Spread, f: (n: number) => string) => `${f(s.low)} – ${f(s.high)}`;

/** With vs without Mission LiFE: real households' savings, scaled to any number of homes. */
export function HabitProjectionPanel() {
  const { t } = useI18n();
  const q = useLoad(api.adminHabitScenario);
  const d = q.data;
  const [homes, setHomes] = useState<number | null>(null);
  const [adoption, setAdoption] = useState(25);
  const n = homes ?? d?.registered_households ?? 0;
  const p = d ? project(d, n, adoption) : null;
  const top = p ? Math.max(p.withoutMwh, 0.001) : 1;
  return (
    <section className={panel} aria-labelledby="projection">
      <h2 id="projection" className="text-lg font-bold">{t("geda.proj.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("geda.proj.sub")}</p>
      {q.loading && !d ? <Spinner /> : <ErrorNote message={q.error} />}
      {d && p && (
        <div className="mt-4 grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Field label={t("geda.proj.homes")}>
              <input className={inputClass} type="number" min={0} value={n} onChange={(e) => setHomes(Number(e.target.value) || 0)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setHomes(null)} className="min-h-9 rounded-full border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-2">
                {t("geda.proj.registered", { n: fmt.int(d.registered_households) })}
              </button>
              {HOME_PRESETS.map((h) => (
                <button key={h} type="button" onClick={() => setHomes(h)} className="min-h-9 rounded-full border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-2">
                  {fmt.int(h)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-medium">{t("geda.proj.adoption", { pct: adoption })}</span>
              <input type="range" min={0} max={100} step={5} value={adoption} onChange={(e) => setAdoption(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand)]" />
            </label>
            <p className="text-xs text-muted">{t("geda.proj.taking", { n: fmt.int(p.homesTakingPart) })}</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-3" aria-live="polite">
              <div>
                <div className="flex justify-between text-sm"><span className="font-semibold">{t("geda.proj.without")}</span><span className="num">{mwh(p.withoutMwh)} MWh</span></div>
                <div className="mt-1 h-4 rounded-full bg-clay/70" style={{ width: "100%" }} />
              </div>
              <div>
                <div className="flex justify-between text-sm"><span className="font-semibold text-brand-strong">{t("geda.proj.with")}</span><span className="num">{mwh(p.withMwh)} MWh{p.withoutMwh > 0 && <span className="text-brand-strong"> (−{((p.savedMwh.mid / p.withoutMwh) * 100).toFixed(1)}%)</span>}</span></div>
                <div className="mt-1 h-4 rounded-full bg-brand" style={{ width: `${Math.max(1, (p.withMwh / top) * 100)}%` }} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-brand-soft p-4">
                <p className="text-xs font-semibold text-muted">{t("geda.proj.savedMwh")}</p>
                <p className="num mt-1 text-2xl font-bold">{mwh(p.savedMwh.mid)}</p>
                <p className="num text-xs text-muted">{range(p.savedMwh, mwh)}</p>
              </div>
              <div className="rounded-2xl bg-sun-soft p-4">
                <p className="text-xs font-semibold text-muted">{t("geda.proj.savedRs")}</p>
                <p className="num mt-1 text-2xl font-bold">{fmt.rs(p.savedRsMonth.mid)}</p>
                <p className="num text-xs text-muted">{range(p.savedRsMonth, fmt.rs)}</p>
              </div>
              <div className="rounded-2xl bg-sky-soft p-4">
                <p className="text-xs font-semibold text-muted">{t("geda.proj.co2")}</p>
                <p className="num mt-1 text-2xl font-bold">{fmt.int(p.co2TonnesYear.mid)} t</p>
                <p className="num text-xs text-muted">{range(p.co2TonnesYear, (x) => `${fmt.int(x)} t`)}</p>
              </div>
            </div>
            <p className="text-xs text-muted">
              {t("geda.proj.basis", { n: fmt.int(d.active_households), district: d.district })}
              {d.active_households < 5 && ` ${t("geda.proj.few")}`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
