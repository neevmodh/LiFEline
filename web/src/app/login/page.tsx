"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardPage } from "@/components/Page";
import { ErrorNote, Field, inputClass } from "@/components/ui";
import { useI18n } from "@/i18n";
import { API_URL, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { APP_URL } from "@/lib/links";

export default function LoginPage() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  // The API sleeps when nobody has used it for a while; start waking it while the form is filled in.
  useEffect(() => {
    fetch(`${API_URL}/api/health`).catch(() => undefined);
  }, []);
  // A first sign-in can take a while if the server was asleep: say so instead of looking stuck.
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setSlow(true), 3500);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = f.email.trim();
      const { token, user } = await api.login(id.includes("@") ? { email: id, password: f.password } : { phone: id, password: f.password });
      if (user.role === "citizen") {
        // This sign-in is GEDA's; households have the app, so point them there instead of signing in here.
        setError(t("login.householdsUseApp"));
        setBusy(false);
        return;
      }
      signIn(token, user);
      router.replace("/geda");
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
        <Field label={t("login.id")}>
          <input className={inputClass} type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label={t("join.password")}>
          <input className={inputClass} type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" disabled={busy} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white shadow-[var(--shadow)] hover:bg-brand-strong disabled:opacity-60">
          {busy ? t("login.busy") : t("login.go")}
        </button>
        {slow && (
          <p role="status" className="text-center text-xs text-muted">
            {t("login.waking")}
          </p>
        )}
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {t("login.new")} <a href={APP_URL} className="font-semibold text-brand">{t("login.create")}</a>
      </p>
    </CardPage>
  );
}
