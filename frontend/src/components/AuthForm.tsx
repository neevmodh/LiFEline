"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/AppShell";
import { Button, Card, ErrorNote, Field, inputClass } from "@/components/ui";
import { api, type District, type User } from "@/lib/api";
import { LanguageSwitcher, useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";

function homeFor(user: User) {
  if (user.role !== "citizen") return "/admin";
  return user.onboarded ? "/dashboard" : "/onboarding";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, signIn } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(homeFor(user));
  }, [user, router]);

  useEffect(() => {
    if (mode === "register") api.districts().then(setDistricts).catch((e) => setError(e.message));
  }, [mode]);

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
      signIn(res.token, res.user);
      router.replace(homeFor(res.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Logo />
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold">{mode === "login" ? t("auth.welcomeBack") : t("auth.join")}</h1>
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
                    {t("common.choose")}
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

          <ErrorNote message={error} />
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
