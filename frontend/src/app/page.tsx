"use client";

import Link from "next/link";
import { Logo } from "@/components/AppShell";
import { LanguageSwitcher, useI18n, type MessageKey } from "@/i18n";

const FEATURES: [MessageKey, MessageKey][] = [
  ["landing.f1.title", "landing.f1.body"],
  ["landing.f2.title", "landing.f2.body"],
  ["landing.f3.title", "landing.f3.body"],
  ["landing.f4.title", "landing.f4.body"],
];

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          <LanguageSwitcher />
          <Link href="/login" className="rounded-xl px-3 py-2 text-muted hover:text-text">
            {t("nav.signIn")}
          </Link>
          <Link href="/register" className="rounded-xl bg-brand px-4 py-2 font-medium text-white dark:text-bg">
            {t("landing.getStarted")}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-14 sm:py-20">
          <p className="text-sm font-medium text-brand">{t("landing.kicker")}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t("landing.headline")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            {t("landing.intro")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-brand px-5 py-3 font-medium text-white dark:text-bg">
              {t("landing.ctaFootprint")}
            </Link>
            <Link href="/login" className="rounded-xl border border-border bg-surface px-5 py-3 font-medium">
              {t("landing.ctaAccount")}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-semibold">{t(title)}</h2>
              <p className="mt-2 text-sm text-muted">{t(body)}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Built for HackCult &apos;26 · Problem statement HC26-GEDA01 ·{" "}
        <Link href="/methodology" className="underline hover:text-text">
          {t("nav.methodology")}
        </Link>
      </footer>
    </div>
  );
}
