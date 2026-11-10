"use client";

import { useState } from "react";
import { ErrorNote, Field, ProgressBar, Spinner, fmt, inputClass, useLoad } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ApiError, api, type SocietyView } from "@/lib/api";
import { useAuth } from "@/lib/auth";

async function mySociety(): Promise<SocietyView | null> {
  try {
    return await api.mySociety();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

function SocietyCard() {
  const { t } = useI18n();
  const soc = useLoad(mySociety);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await soc.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }

  if (soc.loading && soc.data === null && !soc.error) return <Spinner />;
  const s = soc.data;

  return (
    <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
      <p className="kicker text-sky">{t("tog.society")}</p>
      {s ? (
        <div className="mt-3 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{s.name}</h2>
            <p className="text-sm text-muted">{t("tog.members", { n: s.member_count })} · {s.district}</p>
          </div>
          {s.stats_visible && s.co2_avoided_kg !== null ? (
            <div>
              {s.goal_progress_pct !== null && <ProgressBar value={s.goal_progress_pct} tone="sun" />}
              <p className="num mt-2 text-sm text-muted">{t("tog.progress", { kg: Math.round(s.co2_avoided_kg), pct: Math.round(s.goal_progress_pct ?? 0) })}</p>
            </div>
          ) : (
            <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">{t("tog.hidden", { n: s.min_group_size })}</p>
          )}
          {s.join_code && (
            <div className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-xs text-muted">{t("tog.share")}</p>
              <p data-testid="join-code" className="num mt-1 text-2xl font-bold tracking-[0.2em]">{s.join_code}</p>
            </div>
          )}
          {s.announcements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">{t("tog.messages")}</h3>
              <ul className="mt-2 space-y-2">
                {s.announcements.slice(0, 3).map((a) => (
                  <li key={a.id} className="rounded-2xl border border-border px-4 py-3 text-sm">{a.text}<span className="mt-1 block text-xs text-muted">{a.author}</span></li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => act(api.leaveSociety)} className="text-sm font-medium text-muted underline hover:text-text">{t("tog.leave")}</button>
        </div>
      ) : (
        <div className="mt-3 space-y-6">
          <p className="text-muted">{t("tog.societyNone")}</p>
          <form onSubmit={(e) => { e.preventDefault(); act(() => api.joinSociety(code.trim())); }} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1"><Field label={t("tog.joinCode")} hint={t("tog.joinHint")}>
              <input className={`${inputClass} uppercase tracking-widest`} maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} required />
            </Field></div>
            <button type="submit" className="min-h-11 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-strong">{t("tog.join")}</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); act(() => api.createSociety(name, goal ? Number(goal) : null)); }} className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">{t("tog.create")}</h3>
            <Field label={t("tog.createName")}><input className={inputClass} minLength={3} maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t("tog.createGoal")}><input className={inputClass} type="number" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
            <button type="submit" className="min-h-11 rounded-full border-2 border-brand px-6 text-sm font-semibold text-brand-strong hover:bg-brand-soft">{t("tog.create")}</button>
          </form>
        </div>
      )}
      <ErrorNote message={error ?? soc.error} />
    </section>
  );
}

export default function TogetherPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const rank = useLoad(api.districtLeaderboard);
  const mine = rank.data?.find((d) => d.district_id === user?.district_id);
  const top = (rank.data ?? []).filter((d) => d.participants > 0).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("tog.title")}</h1>
        <p className="mt-1 text-muted">{t("tog.sub")}</p>
      </div>

      <section className="hero rounded-[28px] p-6 sm:p-8">
        <div className="relative z-10">
          <p className="kicker text-[#8fe3cf]">{t("tog.district")}</p>
          {rank.loading && !rank.data ? <Spinner /> : mine && mine.participants > 1 ? (
            <>
              <h2 className="mt-2 text-3xl font-bold">{mine.district}</h2>
              <p className="num mt-1 text-[#cfeee6]">{t("tog.people", { n: mine.participants })} · {t("tog.saved", { kg: fmt.int(mine.co2_saved_kg) })}</p>
              <div className="mt-4 max-w-md"><ProgressBar value={mine.goal_progress_pct} tone="sun" /></div>
              <p className="num mt-2 text-sm text-[#cfeee6]">{Math.round(mine.goal_progress_pct)}% {t("tog.goal")}</p>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-3xl font-bold">{mine?.district ?? ""}</h2>
              <p className="mt-2 max-w-xl text-[#cfeee6]">{t("tog.districtEmpty", { district: mine?.district ?? "your district" })}</p>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <SocietyCard />
        <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
          <p className="kicker text-brand">{t("tog.topDistricts")}</p>
          {top.length ? (
            <ol className="mt-3 space-y-2">
              {top.map((d) => (
                <li key={d.district_id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${d.district_id === user?.district_id ? "bg-brand-soft" : "bg-surface-2"}`}>
                  <span className="num w-5 font-bold text-muted">{d.rank}</span>
                  <span className="flex-1 font-medium">{d.district}</span>
                  <span className="num text-sm text-muted">{fmt.kg(d.co2_saved_kg)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-muted">{t("tog.noDistricts")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
