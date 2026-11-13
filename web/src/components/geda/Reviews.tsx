"use client";

// The photo review queue: an AI pre-screens each proof photo, a person approves or rejects it.
import { useEffect, useState } from "react";
import { Badge, ErrorNote, Spinner, useLoad } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type ReviewItem } from "@/lib/api";

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
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 text-xs text-muted">
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

export function ReviewQueue({ onChange }: { onChange?: () => void }) {
  const { t } = useI18n();
  const q = useLoad(api.reviews);
  return (
    <section className="rounded-3xl bg-surface p-6 shadow-[var(--shadow)]">
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
