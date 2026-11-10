"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardPage } from "@/components/Page";
import { ErrorNote, Field, inputClass } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api.login(f);
      signIn(token, user);
      // One door for everyone: the role decides where you land.
      router.replace(user.role === "citizen" ? (user.onboarded ? "/home" : "/join") : "/geda");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <CardPage>
      <h1 className="text-2xl font-bold">{t("login.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("login.sub")}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={t("join.email")}>
          <input className={inputClass} type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label={t("join.password")}>
          <input className={inputClass} type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" disabled={busy} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white shadow-[var(--shadow)] hover:bg-brand-strong disabled:opacity-60">
          {t("login.go")}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {t("login.new")} <Link href="/#start" className="font-semibold text-brand">{t("login.create")}</Link>
      </p>
    </CardPage>
  );
}
