"use client";

import { useState } from "react";
import { Badge, Button, Card, CardTitle, ErrorNote, Field, ProgressBar, Spinner, inputClass, plural, useLoad } from "@/components/ui";
import { api, type Campaign } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const TONE = { active: "brand", upcoming: "sun", finished: "muted" } as const;
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function CampaignRow({ c, onChange }: { c: Campaign; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const reached = c.progress >= c.target;
  return (
    <li className="space-y-2 py-3" data-testid="campaign">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{c.title}</p>
          <p className="text-xs text-muted">
            {c.scope_label} · {c.action_title ?? "any green action"} · {c.starts_on} to {c.ends_on}
          </p>
        </div>
        <Badge tone={TONE[c.status]}>
          {c.status === "active" ? `${plural(c.days_left, "day")} left` : c.status === "upcoming" ? "starts soon" : reached ? "target reached" : "finished"}
        </Badge>
      </div>
      {c.description && <p className="text-sm text-muted">{c.description}</p>}
      <ProgressBar value={c.progress_pct} tone={reached ? "brand" : "sun"} />
      <p className="text-xs text-muted">
        {c.progress.toLocaleString("en-IN")} of {c.target.toLocaleString("en-IN")} actions · {c.participants.toLocaleString("en-IN")} {c.participants === 1 ? "person" : "people"} took part
        {c.my_count > 0 && ` · ${c.my_count} by you`}
      </p>
      <div className="flex flex-wrap gap-2">
        {c.certificate && (
          <Button variant="ghost" onClick={() => api.downloadCertificate(c.id, c.title).catch((e) => setError(e.message))}>
            Download certificate
          </Button>
        )}
        {c.can_delete && (
          <Button variant="ghost" onClick={() => api.deleteCampaign(c.id).then(onChange, (e) => setError(e.message))}>
            Remove
          </Button>
        )}
      </div>
      <ErrorNote message={error} />
    </li>
  );
}

function NewCampaign({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const actions = useLoad(api.actionTypes);
  const districts = useLoad(api.districts);
  const scopes: { value: "state" | "district" | "society"; label: string }[] = [];
  if (user?.role === "admin") scopes.push({ value: "state", label: "All of Gujarat" });
  if (user?.role === "admin" || user?.role === "officer") scopes.push({ value: "district", label: "A district" });
  if (user?.society_role === "committee") scopes.push({ value: "society", label: "My society" });
  const today = new Date();
  const [f, setF] = useState({
    title: "", description: "", action_code: "", target: "50", scope: scopes[0]?.value ?? "society",
    district_id: String(user?.district_id ?? ""), starts_on: iso(today), ends_on: iso(new Date(today.getTime() + 6 * 86400000)),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createCampaign({
        title: f.title, description: f.description, action_code: f.action_code || null, target: Number(f.target),
        starts_on: f.starts_on, ends_on: f.ends_on, scope: f.scope,
        scope_id: f.scope === "district" ? Number(f.district_id) || null : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the campaign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface-2 p-4">
      <Field label="Campaign name">
        <input className={inputClass} value={f.title} onChange={set("title")} minLength={3} maxLength={120} required placeholder="Cycle to work week" />
      </Field>
      <Field label="What is it about? (optional)">
        <textarea className={inputClass} value={f.description} onChange={set("description")} maxLength={500} rows={2} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Who can take part">
          <select className={inputClass} value={f.scope} onChange={set("scope")}>
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        {f.scope === "district" && user?.role === "admin" && (
          <Field label="District">
            <select className={inputClass} value={f.district_id} onChange={set("district_id")} required>
              <option value="">Choose…</option>
              {districts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Which action counts">
          <select className={inputClass} value={f.action_code} onChange={set("action_code")}>
            <option value="">Any green action</option>
            {actions.data?.map((a) => <option key={a.code} value={a.code}>{a.title}</option>)}
          </select>
        </Field>
        <Field label="Target (total actions)">
          <input className={inputClass} type="number" min={1} value={f.target} onChange={set("target")} required />
        </Field>
        <Field label="Starts">
          <input className={inputClass} type="date" value={f.starts_on} onChange={set("starts_on")} required />
        </Field>
        <Field label="Ends">
          <input className={inputClass} type="date" value={f.ends_on} onChange={set("ends_on")} required />
        </Field>
      </div>
      <ErrorNote message={error} />
      <Button type="submit" disabled={busy}>{busy ? "Starting…" : "Start campaign"}</Button>
    </form>
  );
}

/** Time-boxed challenges with a shared target. GEDA and society committees can start them. */
export function Campaigns() {
  const { user } = useAuth();
  const list = useLoad(api.campaigns);
  const [adding, setAdding] = useState(false);
  const canCreate = user?.role === "admin" || user?.role === "officer" || user?.society_role === "committee";

  return (
    <Card>
      <CardTitle aside={canCreate && <Button variant="ghost" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Start a campaign"}</Button>}>
        Campaigns
      </CardTitle>
      {adding && <NewCampaign onDone={() => { setAdding(false); list.reload(); }} />}
      {list.loading && !list.data ? (
        <Spinner />
      ) : list.error ? (
        <ErrorNote message={list.error} />
      ) : list.data?.length ? (
        <ul className="divide-y divide-border">
          {list.data.map((c) => <CampaignRow key={c.id} c={c} onChange={list.reload} />)}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No campaigns running yet.{canCreate ? " Start one and everyone in scope can help reach the target." : " GEDA and your society committee can start one."}
        </p>
      )}
    </Card>
  );
}
