"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote, Field, inputClass } from "@/components/ui";
import { LanguageSwitcher } from "@/components/Shell";
import { useI18n } from "@/i18n";
import { api, setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function YouPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.deleteAccount(pw);
      setToken(null);
      window.location.href = window.location.origin; // a clean reload, so no stale signed-in state survives
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">{t("you.title")}</h1>
      <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted">{t("you.name")}</dt><dd className="font-medium">{user?.name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">{t("you.email")}</dt><dd className="font-medium">{user?.email}</dd></div>
          <div className="flex items-center justify-between gap-4"><dt className="text-muted">{t("you.language")}</dt><dd><LanguageSwitcher /></dd></div>
        </dl>
      </section>
      <section className="rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow)]">
        <h2 className="font-semibold">{t("you.data")}</h2>
        <p className="mt-1 text-sm text-muted">{t("you.dataBody")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => api.downloadMyData().catch((e) => setError(e.message))} className="min-h-11 rounded-full border-2 border-brand px-6 text-sm font-semibold text-brand-strong hover:bg-brand-soft">{t("you.download")}</button>
          {!confirming && <button onClick={() => setConfirming(true)} className="min-h-11 rounded-full px-6 text-sm font-semibold text-danger hover:bg-danger-soft">{t("you.delete")}</button>}
        </div>
        {confirming && (
          <form onSubmit={remove} className="mt-4 space-y-3 rounded-2xl bg-danger-soft p-4">
            <p className="text-sm">{t("you.deleteConfirm")}</p>
            <Field label={t("join.password")}><input className={inputClass} type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
            <button type="submit" className="min-h-11 rounded-full bg-danger px-6 text-sm font-semibold text-white">{t("you.deleteGo")}</button>
          </form>
        )}
        <ErrorNote message={error} />
      </section>
    </div>
  );
}
