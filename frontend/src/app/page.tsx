"use client";

import Link from "next/link";
import { Logo } from "@/components/AppShell";
import { LanguageSwitcher, useI18n, type MessageKey } from "@/i18n";

const FEATURES: { icon: string; tint: string; title: MessageKey; body: MessageKey }[] = [
  { icon: "📸", tint: "bg-brand-soft", title: "landing.f1.title", body: "landing.f1.body" },
  { icon: "⚡", tint: "bg-sun-soft", title: "landing.f2.title", body: "landing.f2.body" },
  { icon: "🏆", tint: "bg-sky-soft", title: "landing.f3.title", body: "landing.f3.body" },
  { icon: "☀️", tint: "bg-sun-soft", title: "landing.f4.title", body: "landing.f4.body" },
];

const STEPS: { n: string; key: MessageKey }[] = [
  { n: "1", key: "landing.step1" },
  { n: "2", key: "landing.step2" },
  { n: "3", key: "landing.step3" },
];

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          <LanguageSwitcher />
          <Link href="/login" className="rounded-full px-4 py-2 font-medium text-muted transition hover:bg-white hover:text-text">
            {t("nav.signIn")}
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-br from-[#0a8157] to-[#10a073] px-5 py-2.5 font-semibold text-white shadow-[var(--shadow-lg)] transition hover:brightness-105"
          >
            {t("landing.getStarted")}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-strong">
              <span aria-hidden>🌱</span> {t("landing.kicker")}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
              {t("landing.headline")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{t("landing.intro")}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-2xl bg-gradient-to-br from-[#0a8157] to-[#10a073] px-7 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-lg)] transition hover:brightness-105"
              >
                {t("landing.ctaFootprint")}
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-border bg-white px-7 py-3.5 text-base font-semibold shadow-[var(--shadow)] transition hover:bg-surface-2"
              >
                {t("landing.ctaAccount")}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted">
              {(["landing.pill1", "landing.pill2", "landing.pill3"] as MessageKey[]).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-soft text-xs text-brand-strong">✓</span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>

          {/* A taste of the dashboard, built from the same colours as the app. */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden>
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-soft via-sky-soft to-sun-soft opacity-80 blur-2xl" />
            <div className="relative space-y-3 rounded-[2rem] border border-white bg-white/80 p-5 shadow-[var(--shadow-lg)] backdrop-blur">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-brand-soft/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("landing.card1")}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">241 kg</p>
                  <p className="text-xs text-muted">{t("landing.card1Hint")}</p>
                </div>
                <div className="rounded-2xl bg-sun-soft/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("landing.card2")}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">11–2</p>
                  <p className="text-xs text-muted">{t("landing.card2Hint")}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white p-4">
                <p className="text-sm font-semibold">{t("landing.card3")}</p>
                <div className="mt-3 flex h-20 items-end gap-2">
                  {[62, 74, 58, 49, 41, 36].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-lg bg-gradient-to-t from-[#0a8157] to-[#5cc99a]"
                      style={{ height: `${h}%`, opacity: 0.55 + i * 0.09 }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-sky-soft/80 px-4 py-3">
                <p className="text-sm font-semibold">🔥 {t("landing.card4")}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky">+30</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl border border-border/70 bg-white p-6 shadow-[var(--shadow)]">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${f.tint}`} aria-hidden>
                  {f.icon}
                </span>
                <h2 className="mt-4 text-lg font-semibold">{t(f.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(f.body)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-[2rem] bg-gradient-to-br from-[#0a8157] to-[#10a073] p-8 text-white shadow-[var(--shadow-lg)] sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("landing.stepsTitle")}</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-lg font-bold text-brand-strong">
                  {s.n}
                </span>
                <p className="pt-1.5 text-base leading-snug text-white/95">{t(s.key)}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/register"
            className="mt-9 inline-block rounded-2xl bg-white px-7 py-3.5 text-base font-semibold text-brand-strong shadow-lg transition hover:bg-brand-soft"
          >
            {t("landing.ctaBottom")}
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        Built for HackCult &apos;26 · Problem statement HC26-GEDA01 ·{" "}
        <Link href="/methodology" className="underline hover:text-text">
          {t("nav.methodology")}
        </Link>
      </footer>
    </div>
  );
}
