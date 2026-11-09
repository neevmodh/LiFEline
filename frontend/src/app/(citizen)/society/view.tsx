"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Campaigns } from "@/components/Campaigns";
import { Badge, Button, Card, CardTitle, ErrorNote, Field, ProgressBar, Spinner, Stat, fmt, inputClass } from "@/components/ui";
import { ApiError, api, type SocietyRank, type SocietyView } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";

function JoinOrCreate({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>{t("society.joinTitle")}</CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">{t("society.joinIntro")}</p>
        <form onSubmit={(e) => { e.preventDefault(); run(() => api.joinSociety(code)); }} className="space-y-3">
          <Field label={t("society.code")}>
            <input required minLength={4} maxLength={10} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`${inputClass} tracking-widest`} placeholder="ABCD2345" />
          </Field>
          <Button type="submit" disabled={busy}>{t("society.join")}</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>{t("society.createTitle")}</CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">{t("society.createIntro")}</p>
        <form
          onSubmit={(e) => { e.preventDefault(); run(() => api.createSociety(name, goal ? Number(goal) : null)); }}
          className="space-y-3"
        >
          <Field label={t("society.name")}>
            <input required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("society.goal")} hint={t("society.goalHint")}>
            <input type="number" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy}>{t("society.create")}</Button>
        </form>
      </Card>
      <div className="lg:col-span-2"><ErrorNote message={error} /></div>
    </div>
  );
}

function JoinCard({ code }: { code: string }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const message = t("society.shareText", { code, url: site });
  useEffect(() => {
    QRCode.toDataURL(`${site}/register`, { margin: 1, width: 220 }).then(setQr);
  }, [site]);
  return (
    <Card className="border-brand/40">
      <CardTitle>{t("society.inviteTitle")}</CardTitle>
      <div className="flex flex-wrap items-center gap-6">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={qr} alt={t("society.qrAlt")} className="h-36 w-36 rounded-xl bg-white p-1.5" />
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("society.code")}</p>
          <p className="text-3xl font-bold tracking-[0.25em]" data-testid="join-code">{code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigator.clipboard.writeText(code).then(() => setCopied(true))}>
              {copied ? t("society.copied") : t("society.copy")}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-2xl bg-[#25d366] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)]"
            >
              {t("society.whatsapp")}
            </a>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{t("society.inviteHint")}</p>
    </Card>
  );
}

export default function SocietyScreen() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [society, setSociety] = useState<SocietyView | null | undefined>(undefined);
  const [board, setBoard] = useState<SocietyRank[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [goal, setGoal] = useState("");

  async function load() {
    try {
      setSociety(await api.mySociety());
      setBoard(await api.societyLeaderboard());
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setSociety(null);
      else setError(e instanceof Error ? e.message : t("common.error"));
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }

  if (society === undefined) return error ? <ErrorNote message={error} /> : <Spinner />;
  if (society === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("society.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("society.intro")}</p>
        </div>
        <JoinOrCreate onDone={() => act(async () => undefined)} />
      </div>
    );
  }

  const committee = society.role === "committee";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{society.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {society.district} · <Badge tone={committee ? "sun" : "brand"}>{committee ? t("society.committee") : t("society.member")}</Badge>
          </p>
        </div>
        <Button variant="ghost" onClick={() => act(() => api.leaveSociety())}>{t("society.leave")}</Button>
      </div>
      <ErrorNote message={error} />

      {committee && society.join_code && <JoinCard code={society.join_code} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="brand" label={t("society.households")} value={society.member_count} />
        <Stat tone="sky" label={t("society.co2")} value={society.stats_visible ? fmt.kg(society.co2_avoided_kg ?? 0) : "–"}
          hint={society.stats_visible ? t("society.thisMonth") : undefined} />
        <Stat tone="sun" label={t("society.actions")} value={society.stats_visible ? society.actions ?? 0 : "–"} />
        <Stat tone="plain" label={t("society.rank")} value={society.rank ? `#${society.rank}` : "–"} />
      </div>

      {!society.stats_visible && (
        <Card className="bg-sky-soft/50">
          <p className="text-sm">{t("society.hidden", { n: society.min_group_size, have: society.member_count })}</p>
        </Card>
      )}

      {society.goal_progress_pct !== null && society.goal_kg_month !== null && (
        <Card>
          <CardTitle>{t("society.goalTitle")}</CardTitle>
          <p className="-mt-2 mb-3 text-sm text-muted">
            {t("society.goalLine", { done: fmt.kg(society.co2_avoided_kg ?? 0), goal: fmt.kg(society.goal_kg_month) })}
          </p>
          <ProgressBar value={society.goal_progress_pct} tone={society.goal_progress_pct >= 100 ? "sun" : "brand"} />
        </Card>
      )}

      <Campaigns />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t("society.announcements")}</CardTitle>
          {committee && (
            <form
              onSubmit={(e) => { e.preventDefault(); act(async () => { await api.postAnnouncement(text); setText(""); }); }}
              className="mb-4 flex gap-2"
            >
              <input required maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={inputClass}
                placeholder={t("society.announcePlaceholder")} aria-label={t("society.announcePlaceholder")} />
              <Button type="submit">{t("society.post")}</Button>
            </form>
          )}
          {society.announcements.length === 0 ? (
            <p className="text-sm text-muted">{t("society.noAnnouncements")}</p>
          ) : (
            <ul className="space-y-3">
              {society.announcements.map((a) => (
                <li key={a.id} className="rounded-2xl bg-surface-2 p-3 text-sm">
                  <p>{a.text}</p>
                  <p className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{a.author} · {new Date(a.created_at).toLocaleDateString("en-IN")}</span>
                    {committee && (
                      <button onClick={() => act(() => api.deleteAnnouncement(a.id))} className="text-danger">
                        {t("society.remove")}
                      </button>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>{t("society.leaderboard")}</CardTitle>
          {board.length === 0 ? (
            <p className="text-sm text-muted">{t("society.boardEmpty", { n: society.min_group_size })}</p>
          ) : (
            <ol className="space-y-1">
              {board.map((r) => (
                <li key={r.society_id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${r.is_mine ? "bg-brand-soft" : ""}`}>
                  <span><span className="mr-2 font-semibold text-muted">{r.rank}</span>{r.name}</span>
                  <span className="tabular-nums text-muted">{t("society.perMember", { kg: fmt.kg(r.co2_per_member_kg) })}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {committee && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>{t("society.manage")}</CardTitle>
            <form
              onSubmit={(e) => { e.preventDefault(); act(() => api.setSocietyGoal(goal ? Number(goal) : null)); }}
              className="flex items-end gap-2"
            >
              <Field label={t("society.goal")}>
                <input type="number" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass}
                  placeholder={society.goal_kg_month ? String(society.goal_kg_month) : ""} />
              </Field>
              <Button type="submit">{t("society.saveGoal")}</Button>
            </form>
            <div className="mt-4">
              <Button variant="ghost" disabled={!society.stats_visible}
                onClick={() => act(() => api.downloadSocietyReport())}>
                {t("society.report")}
              </Button>
            </div>
          </Card>
          <Card>
            <CardTitle>{t("society.members")}</CardTitle>
            <ul className="divide-y divide-border text-sm">
              {society.members?.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {m.first_name}{" "}
                    {m.role === "committee" && <Badge tone="sun">{t("society.committee")}</Badge>}
                    <span className="ml-2 text-xs text-muted">{t("society.memberActions", { n: m.actions_this_month })}</span>
                  </span>
                  {m.role !== "committee" && (
                    <span className="flex gap-3 text-xs font-medium">
                      <button onClick={() => act(() => api.makeCommittee(m.user_id))} className="text-brand">{t("society.makeCommittee")}</button>
                      <button onClick={() => act(() => api.removeSocietyMember(m.user_id))} className="text-danger">{t("society.remove")}</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
