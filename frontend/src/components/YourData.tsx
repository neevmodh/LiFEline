"use client";

import { useState } from "react";
import { Button, Card, CardTitle, ErrorNote, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";

/** Download everything Nidhi holds about you, or erase it for good. */
export function YourData() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await api.downloadMyData();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function erase(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      signOut();
      // A full page load gives a clean start on the landing page; the signed-in shell would
      // otherwise redirect to sign-in first.
      window.location.href = window.location.origin;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>{t("data.title")}</CardTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{t("data.intro")}</p>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={download} disabled={busy}>
          {t("data.download")}
        </Button>
        {!confirming && (
          <Button variant="ghost" onClick={() => setConfirming(true)} className="!text-danger">
            {t("data.delete")}
          </Button>
        )}
      </div>
      {confirming && (
        <form onSubmit={erase} className="mt-5 space-y-3 rounded-2xl border border-danger/30 bg-danger-soft/50 p-4">
          <p className="text-sm font-medium">{t("data.confirm")}</p>
          <Field label={t("auth.password")}>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={busy || !password}>
              {t("data.deleteForever")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setConfirming(false); setPassword(""); }}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
