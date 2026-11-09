"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/AppShell";
import { Button, Card, ErrorNote, Field, inputClass } from "@/components/ui";
import { api, type District, type User } from "@/lib/api";
import { LanguageSwitcher, useI18n } from "@/i18n";
import type { Audience } from "@/components/LoginHub";
import { useAuth } from "@/lib/auth";

function homeFor(user: User, audience?: Audience) {
  if (user.role !== "citizen") return "/admin";
  if (!user.onboarded) return "/onboarding";
  return audience === "society" ? "/society" : "/dashboard";
}

export function AuthForm({
  mode,
  audience,
  onBack,
}: {
  mode: "login" | "register";
  audience?: Audience;
  onBack?: () => void;
}) {
  const { user, signIn } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(homeFor(user, audience));
  }, [user, router, audience]);

  // The API may be waking up (free hosting sleeps when idle), so keep trying for about a minute
  // instead of leaving the district list empty.
  const [districtsFailed, setDistrictsFailed] = useState(false);
  const [districtsTry, setDistrictsTry] = useState(0);
  useEffect(() => {
    if (mode !== "register") return;
    let live = true;
    (async () => {
      for (let attempt = 0; attempt < 12 && live; attempt++) {
        try {
          const list = await api.districts();
          if (live) {
            setDistricts(list);
            setDistrictsFailed(false);
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, Math.min(2000 + attempt * 1000, 6000)));
        }
      }
      if (live) {
        setDistrictsFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [mode, districtsTry, t]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({
              email,
              password,
              name: String(form.get("name")),
              district_id: Number(form.get("district_id")),
              ward: String(form.get("ward") || "") || undefined,
            });
      // GEDA sign-in is for GEDA accounts only; a citizen who picked it by mistake is told, not silently let in.
      if (audience === "geda" && res.user.role === "citizen") {
        throw new Error(t("hub.notGeda"));
      }
      signIn(res.token, res.user);
      router.replace(homeFor(res.user, audience));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-soft/70 to-transparent" />
      <div className="mb-6 flex items-center gap-4">
        <Logo />
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-[var(--shadow-lg)] sm:p-8">
        {onBack && (
          <button type="button" onClick={onBack} className="mb-3 text-sm font-medium text-muted hover:text-text">
            ← {t("hub.back")}
          </button>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "register"
            ? t("auth.join")
            : audience === "geda"
              ? t("hub.gedaSignIn")
              : audience === "society"
                ? t("hub.societySignIn")
                : t("auth.welcomeBack")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? t("auth.loginSub") : t("auth.registerSub")}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <Field label={t("auth.name")}>
              <input name="name" required maxLength={120} className={inputClass} autoComplete="name" />
            </Field>
          )}
          <Field label={t("auth.email")}>
            <input name="email" type="email" required className={inputClass} autoComplete="email" />
          </Field>
          <Field label={t("auth.password")} hint={mode === "register" ? t("auth.passwordHint") : undefined}>
            <input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 8 : undefined}
              maxLength={mode === "register" ? 72 : undefined}
              className={inputClass}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("auth.district")}>
                <select name="district_id" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    {districts.length === 0 && !districtsFailed ? t("auth.districtsLoading") : t("common.choose")}
                  </option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("auth.ward")}>
                <input name="ward" maxLength={80} placeholder={t("common.optional")} className={inputClass} />
              </Field>
            </div>
          )}

          <ErrorNote message={error ?? (districtsFailed ? t("auth.districtsFailed") : null)} />
          {mode === "register" && districtsFailed && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDistrictsFailed(false);
                setDistrictsTry((n) => n + 1);
              }}
            >
              {t("auth.districtsRetry")}
            </Button>
          )}
          <Button type="submit" disabled={busy} className="w-full py-2.5">
            {busy ? t("common.wait") : mode === "login" ? t("nav.signIn") : t("auth.create")}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              {t("auth.newHere")}{" "}
              <Link href="/register" className="font-medium text-brand">
                {t("auth.createLink")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.alreadyJoined")}{" "}
              <Link href="/login" className="font-medium text-brand">
                {t("nav.signIn")}
              </Link>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
