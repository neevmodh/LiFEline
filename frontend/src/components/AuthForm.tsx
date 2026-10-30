"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/AppShell";
import { Button, Card, ErrorNote, Field, inputClass } from "@/components/ui";
import { api, type District, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function homeFor(user: User) {
  if (user.role === "admin") return "/admin";
  return user.onboarded ? "/dashboard" : "/onboarding";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, signIn } = useAuth();
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold">{mode === "login" ? "Welcome back" : "Join Mission LiFE"}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Sign in to see today's nudges." : "It takes two minutes to find your baseline."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <Field label="Your name">
              <input name="name" required maxLength={120} className={inputClass} autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <input name="email" type="email" required className={inputClass} autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === "register" ? "At least 8 characters" : undefined}>
            <input
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 8 : undefined}
              className={inputClass}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="District">
                <select name="district_id" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ward / area">
                <input name="ward" maxLength={80} placeholder="Optional" className={inputClass} />
              </Field>
            </div>
          )}

          <ErrorNote message={error} />
          <Button type="submit" disabled={busy} className="w-full py-2.5">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href="/register" className="font-medium text-brand">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already joined?{" "}
              <Link href="/login" className="font-medium text-brand">
                Sign in
              </Link>
            </>
          )}
        </p>
        {mode === "login" && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            Demo: <code>citizen1@ecosetu.demo</code> or <code>admin@ecosetu.demo</code>, password <code>demo1234</code>
          </p>
        )}
      </Card>
    </div>
  );
}
