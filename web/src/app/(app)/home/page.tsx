"use client";

import { useState } from "react";
import { ErrorNote, Spinner, fmt, useLoad } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type PlanItem } from "@/lib/api";
import { hoursLabel } from "@/lib/config";
import { useAuth } from "@/lib/auth";

function Ring({ done, total }: { done: number; total: number }) {
  const r = 34, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${done}/${total}`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f5a623" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 44 44)" style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="44" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff" className="num">{done}/{total}</text>
    </svg>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const plan = useLoad(api.plan);
  const sun = useLoad(api.greenHours);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  async function did(item: PlanItem) {
    if (!item.action_code) return;
    setBusy(item.code);
    setError(null);
    try {
      await api.logAction(item.action_code);
      await plan.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  if (plan.loading && !plan.data) return <Spinner />;
  if (plan.error || !plan.data) return <ErrorNote message={plan.error ?? t("home.empty")} />;
  const p = plan.data;
  const habits = p.items.filter((i) => i.kind === "habit" && i.action_code);
  const bigger = p.items.find((i) => i.kind === "investment");
  const done = habits.filter((i) => i.logged_today).length;
  const win = sun.data?.today ?? sun.data?.tomorrow;
  const isTomorrow = !sun.data?.today && !!sun.data?.tomorrow;
  const shown = all ? habits : habits.slice(0, 3);

  return (
    <div className="space-y-6">
      <p className="text-muted">{t("home.hello", { name: user?.name.split(" ")[0] ?? "" })}</p>

      <section className="hero rounded-[28px] p-6 sm:p-8">
        <div className="relative z-10 flex items-start justify-between gap-4 sm:items-center">
          <div>
            <p className="kicker text-[#8fe3cf]">{t("home.planKicker")}</p>
            <h1 className="num mt-2 text-3xl font-bold sm:text-5xl">{t("home.save", { rs: fmt.rs(p.total_rs_month) })}</h1>
            {p.slab_note && <p className="mt-3 max-w-xl text-[#cfeee6]">{p.slab_note}</p>}
          </div>
          <div className="shrink-0 text-center">
            <Ring done={done} total={habits.length} />
            <p className="mt-1 hidden max-w-24 text-xs text-[#cfeee6] sm:block">{t("home.progress", { done, total: habits.length })}</p>
          </div>
        </div>
      </section>

      <ErrorNote message={error} />

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("home.stepsTitle")}</h2>
        <ul className="space-y-3">
          {shown.map((i) => (
            <li key={i.code} className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow)]">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.title}</p>
                <p className="mt-1 text-sm text-muted">{i.why}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {i.rs_month > 0 && <span className="num rounded-full bg-brand-soft px-3 py-1 text-brand-strong">{fmt.rs(i.rs_month)} / month</span>}
                  <span className="num rounded-full bg-surface-2 px-3 py-1 text-muted">{Math.round(i.co2_month_kg)} kg CO₂</span>
                </div>
              </div>
              <button
                onClick={() => did(i)}
                disabled={i.logged_today || busy === i.code}
                className={`min-h-12 rounded-full px-6 text-sm font-semibold transition ${i.logged_today ? "bg-brand text-white disabled:opacity-100" : "border-2 border-brand text-brand-strong hover:bg-brand-soft"}`}
              >
                {i.logged_today ? `✓ ${t("home.done")}` : t("home.did")}
              </button>
            </li>
          ))}
        </ul>
        {habits.length > 3 && (
          <button onClick={() => setAll((a) => !a)} className="mt-3 rounded-full px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
            {all ? t("home.less") : t("home.more", { n: habits.length - 3 })}
          </button>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
          <p className="kicker text-sun">{t("home.sunTitle")}</p>
          <p className="mt-3 text-lg leading-snug">
            {win ? t(isTomorrow ? "home.sunBodyTomorrow" : "home.sunBody", { hours: hoursLabel([win.start_hour, win.end_hour]), district: sun.data?.district ?? "Gujarat" }) : t("home.sunNone")}
          </p>
        </section>
        {bigger && (
          <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
            <p className="kicker text-sky">{t("home.bigger")}</p>
            <p className="mt-3 text-lg font-semibold">{bigger.title}</p>
            <p className="mt-1 text-sm text-muted">{bigger.why}</p>
          </section>
        )}
      </div>
    </div>
  );
}
