"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardTitle, ErrorNote, Field, Spinner, fmt, inputClass, useLoad } from "@/components/ui";
import { ApiError, api, type ActionLog, type ActionType } from "@/lib/api";
import { queueAction } from "@/lib/offline";
import { translate, useI18n, type Locale, type MessageKey } from "@/i18n";

const CATEGORY_LABEL: Record<string, MessageKey> = {
  energy: "category.energy",
  mobility: "category.mobility",
  cooking: "category.cooking",
  waste: "category.waste",
  water: "category.water",
  nature: "category.nature",
  solar: "category.solar",
};

const STATUS: Record<ActionLog["status"], { label: MessageKey; tone: "brand" | "sun" | "muted" | "danger" }> = {
  self_reported: { label: "status.self_reported", tone: "muted" },
  pending: { label: "status.pending", tone: "sun" },
  verified: { label: "status.verified", tone: "brand" },
  rejected: { label: "status.rejected", tone: "danger" },
};

/** What this action saves for the signed-in household. */
function impactLabel(a: ActionType, locale: Locale): string {
  if (a.co2_saved_kg <= 0) return translate(locale, "actions.stepTowards");
  const kwh = a.kwh_saved > 0 ? `${a.kwh_saved.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kWh, ` : "";
  return `${kwh}${translate(locale, "actions.co2Avoided", { co2: fmt.kg(a.co2_saved_kg) })}`;
}

function LogDialog({
  action,
  onClose,
  onLogged,
  onQueued,
}: {
  action: ActionType;
  onClose: () => void;
  onLogged: (log: ActionLog) => void;
  onQueued: () => void;
}) {
  const { t, locale } = useI18n();
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogged(await api.logAction(action.code, note || undefined, proof));
    } catch (err) {
      // No signal: keep a self-reported action on the phone and send it later.
      if (err instanceof ApiError && err.status === 0 && !proof) {
        queueAction(action.code, note || undefined);
        onQueued();
        return;
      }
      setError(err instanceof Error ? err.message : t("actions.logFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md" role="dialog" aria-modal aria-labelledby="log-title">
        <Card>
          <h2 id="log-title" className="text-lg font-semibold">
            {action.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{action.description}</p>
          <p className="mt-2 text-sm">
            {t("actions.forYourHousehold")} <strong>{impactLabel(action, locale)}</strong>
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label={t("actions.note")} hint={t("common.optional")}>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
            </Field>
            <Field
              label={t("actions.photo")}
              hint={t("actions.photoHint", { now: Math.round(action.points * 0.4), full: action.points })}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm"
              />
            </Field>
            <ErrorNote message={error} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("actions.logging") : proof ? t("actions.submitReview") : t("actions.log")}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function ActionsView() {
  const { t } = useI18n();
  const types = useLoad(api.actionTypes);
  const history = useLoad(api.myActions);
  const [selected, setSelected] = useState<ActionType | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [flash, setFlash] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(types.data?.map((t) => t.category) ?? [])), [types.data]);
  const visible = types.data?.filter((t) => filter === "all" || t.category === filter) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("actions.title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("actions.intro")}
        </p>
      </div>
      {flash && (
        <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong" role="status">
          {flash}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {["all", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-sm ${filter === c ? "bg-brand text-white dark:text-bg" : "bg-surface-2 text-muted"}`}
          >
            {c === "all" ? t("actions.all") : CATEGORY_LABEL[c] ? t(CATEGORY_LABEL[c]) : c}
          </button>
        ))}
      </div>

      {types.loading && !types.data ? (
        <Spinner />
      ) : (
        <>
          <ErrorNote message={types.error} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <button
                key={a.code}
                onClick={() => setSelected(a)}
                disabled={!a.applicable}
                title={a.not_applicable_reason ?? undefined}
                className="rounded-2xl border border-border bg-surface p-4 text-left transition enabled:hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <Badge tone="muted">{CATEGORY_LABEL[a.category] ? t(CATEGORY_LABEL[a.category]) : a.category}</Badge>
                  <span className="text-sm font-semibold text-brand">+{a.points}</span>
                </div>
                <p className="mt-3 font-medium">{a.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {a.applicable ? (
                    <>
                      {a.co2_saved_kg > 0 ? t("actions.co2Avoided", { co2: fmt.kg(a.co2_saved_kg) }) : t("actions.enables")}
                      {a.max_per_day > 1 && ` · ${t("actions.perDay", { n: a.max_per_day })}`}
                    </>
                  ) : (
                    t("actions.notForYou", { reason: a.not_applicable_reason ?? "" })
                  )}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      <Card>
        <CardTitle>{t("actions.recent")}</CardTitle>
        {history.loading && !history.data ? (
          <Spinner />
        ) : history.data?.length ? (
          <ul className="divide-y divide-border">
            {history.data.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {log.action.title}
                    {log.is_daily_challenge && <span className="ml-2 text-xs text-sun">{t("actions.dailyChallenge")}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(log.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS[log.status].tone}>{t(STATUS[log.status].label)}</Badge>
                  <span className="w-14 text-right text-sm tabular-nums">+{log.points_awarded}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("actions.empty")}</p>
        )}
      </Card>

      {selected && (
        <LogDialog
          action={selected}
          onClose={() => setSelected(null)}
          onQueued={() => {
            setSelected(null);
            setFlash(t("actions.flashQueued", { title: selected.title }));
          }}
          onLogged={(log) => {
            setSelected(null);
            setFlash(
              log.status === "pending"
                ? t("actions.flashPending", { title: log.action.title })
                : t("actions.flashLogged", { points: log.points_awarded, title: log.action.title }),
            );
            history.reload();
          }}
        />
      )}
    </div>
  );
}
