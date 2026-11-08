"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardTitle, ErrorNote, Field, Spinner, fmt, inputClass, useLoad } from "@/components/ui";
import { api, type ActionLog, type ActionType } from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  energy: "Energy",
  mobility: "Travel",
  cooking: "Cooking",
  waste: "Waste",
  water: "Water",
  nature: "Nature",
  solar: "Solar",
};

const STATUS: Record<ActionLog["status"], { label: string; tone: "brand" | "sun" | "muted" | "danger" }> = {
  self_reported: { label: "Self-reported", tone: "muted" },
  pending: { label: "Awaiting review", tone: "sun" },
  verified: { label: "Verified", tone: "brand" },
  rejected: { label: "Rejected", tone: "danger" },
};

/** What this action saves for the signed-in household. */
function impactLabel(t: ActionType): string {
  if (t.co2_saved_kg <= 0) return "a step towards bigger savings";
  const kwh = t.kwh_saved > 0 ? `${t.kwh_saved.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kWh, ` : "";
  return `${kwh}${fmt.kg(t.co2_saved_kg)} CO₂ avoided`;
}

function LogDialog({ action, onClose, onLogged }: { action: ActionType; onClose: () => void; onLogged: (log: ActionLog) => void }) {
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
      setError(err instanceof Error ? err.message : "Could not log action");
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
            For your household: <strong>{impactLabel(action)}</strong>
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Note" hint="Optional">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
            </Field>
            <Field
              label="Photo proof"
              hint={`Optional. Without a photo you get ${Math.round(action.points * 0.4)} points now; with a verified photo you get the full ${action.points}.`}
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
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Logging…" : proof ? "Submit for review" : "Log action"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function ActionsView() {
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
        <h1 className="text-2xl font-semibold">Green actions</h1>
        <p className="mt-1 text-sm text-muted">
          Log what you did today. Savings are worked out for your household. Add a photo for full points; each photo can
          only be used once.
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
            {c === "all" ? "All" : (CATEGORY_LABEL[c] ?? c)}
          </button>
        ))}
      </div>

      {types.loading && !types.data ? (
        <Spinner />
      ) : (
        <>
          <ErrorNote message={types.error} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <button
                key={t.code}
                onClick={() => setSelected(t)}
                disabled={!t.applicable}
                title={t.not_applicable_reason ?? undefined}
                className="rounded-2xl border border-border bg-surface p-4 text-left transition enabled:hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <Badge tone="muted">{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                  <span className="text-sm font-semibold text-brand">+{t.points}</span>
                </div>
                <p className="mt-3 font-medium">{t.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {t.applicable ? (
                    <>
                      {t.co2_saved_kg > 0 ? `${fmt.kg(t.co2_saved_kg)} CO₂ avoided` : "Enables bigger savings"}
                      {t.max_per_day > 1 && ` · up to ${t.max_per_day}× a day`}
                    </>
                  ) : (
                    `Not for your home: ${t.not_applicable_reason}`
                  )}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      <Card>
        <CardTitle>Your recent actions</CardTitle>
        {history.loading && !history.data ? (
          <Spinner />
        ) : history.data?.length ? (
          <ul className="divide-y divide-border">
            {history.data.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {log.action.title}
                    {log.is_daily_challenge && <span className="ml-2 text-xs text-sun">Daily challenge</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(log.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS[log.status].tone}>{STATUS[log.status].label}</Badge>
                  <span className="w-14 text-right text-sm tabular-nums">+{log.points_awarded}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing yet. Pick an action above to get started.</p>
        )}
      </Card>

      {selected && (
        <LogDialog
          action={selected}
          onClose={() => setSelected(null)}
          onLogged={(log) => {
            setSelected(null);
            setFlash(
              log.status === "pending"
                ? `Submitted "${log.action.title}" for review. Points arrive once verified.`
                : `+${log.points_awarded} points for "${log.action.title}"`,
            );
            history.reload();
          }}
        />
      )}
    </div>
  );
}
