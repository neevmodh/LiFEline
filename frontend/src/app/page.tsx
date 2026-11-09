"use client";

import Link from "next/link";
import { Logo } from "@/components/AppShell";
import { GedaStrip, OceanBand } from "@/components/Ocean";
import { GuestCheck } from "@/components/GuestCheck";
import { LanguageSwitcher, useI18n, type MessageKey } from "@/i18n";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const FEATURES: { icon: React.ReactNode; tint: string; title: MessageKey; body: MessageKey }[] = [
  { icon: <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>, tint: "bg-brand-soft text-brand-strong", title: "landing.f1.title", body: "landing.f1.body" },
  { icon: <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></svg>, tint: "bg-sun-soft text-[#9a6200]", title: "landing.f2.title", body: "landing.f2.body" },
  { icon: <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M10 17h4" /></svg>, tint: "bg-sky-soft text-sky", title: "landing.f3.title", body: "landing.f3.body" },
  { icon: <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>, tint: "bg-sun-soft text-[#9a6200]", title: "landing.f4.title", body: "landing.f4.body" },
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
      <GedaStrip />
      <OceanBand className="pb-24 sm:pb-28" waveColor="#f5faf7" rise={620}>
        <div className="sun-orb -right-40 top-40" aria-hidden />
        {[["12%", "22%", "3s", "-1s"], ["38%", "12%", "4s", "-2s"], ["64%", "30%", "3.4s", "-0.5s"], ["86%", "18%", "4.2s", "-3s"], ["24%", "52%", "3.6s", "-2.4s"]].map(([l, tp, d, dl], i) => (
          <span key={i} className="spark" aria-hidden style={{ left: l, top: tp, "--d": d, "--l": dl } as React.CSSProperties} />
        ))}
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <Logo light />
          <div className="flex items-center gap-2 text-sm">
            <LanguageSwitcher />
            <Link href="/login" className="rounded-full px-4 py-2 font-medium text-[#cfeee6] transition hover:bg-white/10 hover:text-white">
              {t("nav.signIn")}
            </Link>
            <Link href="/register" className="btn-saffron rounded-full px-5 py-2.5 font-semibold">
              {t("landing.getStarted")}
            </Link>
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-6 pt-8 sm:pt-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="depth-tag">{t("landing.kicker")}</p>
            <h1 className="glow-text mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{t("landing.headline")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#cfeee6]">{t("landing.intro")}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#check" className="btn-saffron rounded-full px-7 py-3.5 text-base font-semibold">
                {t("landing.ctaFootprint")}
              </a>
              <Link
                href="/login"
                className="rounded-full border-[1.5px] border-[#8fe3cf]/60 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
              >
                {t("landing.ctaAccount")}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-[#a9d4d0]">
              {(["landing.pill1", "landing.pill2", "landing.pill3"] as MessageKey[]).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-xs text-[#8fe3cf]">✓</span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>

          {/* A taste of the dashboard on a tilting phone, with cards floating at different depths. */}
          <div className="flex justify-center" aria-hidden>
            <div className="stage3d relative h-[600px] w-[500px] max-w-full">
              <div className="rig3d absolute inset-0">
                <div className="absolute left-[100px] top-4 h-[560px] w-[290px] rounded-[44px] bg-[#0b1f26] p-2.5 shadow-[0_60px_80px_-20px_rgb(0_0_0/0.6),inset_0_0_0_2px_#1d4756]">
                  <div className="h-full space-y-3 overflow-hidden rounded-[34px] bg-[#f4faf7] p-4 text-text">
                    <div className="rounded-3xl bg-gradient-to-br from-[#0a8157] to-[#34b27a] p-4 text-white">
                      <p className="text-[11px] font-medium uppercase tracking-widest opacity-90">{t("landing.card1")}</p>
                      <p className="mt-1 text-4xl font-bold tracking-tight">241 kg</p>
                      <p className="text-xs opacity-90">{t("landing.card1Hint")}</p>
                    </div>
                    <div className="rounded-2xl bg-sun-soft p-3">
                      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">{t("landing.card2")}</p>
                      <p className="text-2xl font-bold tracking-tight">11–2</p>
                      <p className="text-xs text-muted">{t("landing.card2Hint")}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-3">
                      <p className="text-sm font-semibold">{t("landing.card3")}</p>
                      <div className="mt-2 flex h-16 items-end gap-1.5">
                        {[62, 74, 58, 49, 41, 36].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-[#0a8157] to-[#5cc99a]" style={{ height: `${h}%`, opacity: 0.55 + i * 0.09 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="chip3d absolute left-0 top-24 w-44" style={{ transform: "translateZ(120px)", animationDelay: "-2s" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8fe3cf]">{t("landing.f4.title")}</p>
                </div>
                <div className="chip3d absolute right-0 top-72 w-44" style={{ transform: "translateZ(150px)", animationDelay: "-4s" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#ffd58a]">{t("landing.f2.title")}</p>
                </div>
                <div className="chip3d absolute bottom-24 left-2 w-44" style={{ transform: "translateZ(90px)", animationDelay: "-1s" }}>
                  <p className="text-sm font-semibold">🔥 {t("landing.card4")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </OceanBand>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="mb-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#06394d] to-[#04202e] p-6 text-white shadow-[var(--shadow-lg)] sm:p-9">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <p className="depth-tag">{t("landing.flow.title")}</p>
              <p className="mt-4 text-lg leading-relaxed text-[#cfeee6]">{t("landing.flow.body")}</p>
            </div>
            <div className="relative h-44" aria-hidden>
              <svg viewBox="0 0 520 176" className="absolute inset-0 h-full w-full">
                <path className="flow-path" d="M 70 88 C 150 88 170 88 240 88" />
                <path className="flow-path grid" d="M 280 88 C 350 88 370 88 450 88" />
              </svg>
              {[
                { left: "0%", label: "landing.flow.sun" as MessageKey, glow: true, icon: <circle cx="12" cy="12" r="4" /> },
                { left: "41%", label: "landing.flow.home" as MessageKey, glow: false, icon: <path d="M4 11 12 4l8 7v9H4z" /> },
                { left: "82%", label: "landing.flow.grid" as MessageKey, glow: false, icon: <path className="bolt" d="M13 3 5 14h6l-1 7 8-11h-6z" /> },
              ].map((n) => (
                <div key={n.label} className="absolute top-1/2 w-[18%] -translate-y-1/2 text-center" style={{ left: n.left }}>
                  <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f5a623]/20 text-[#ffd58a] ring-1 ring-[#f5a623]/50 ${n.glow ? "node-glow" : ""}`}>
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{n.icon}</svg>
                  </span>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#cfeee6]">{t(n.label)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-12 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="lift rounded-3xl border border-border/70 bg-white p-6 shadow-[var(--shadow)]">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${f.tint}`} aria-hidden>
                  {f.icon}
                </span>
                <h2 className="mt-4 text-lg font-semibold">{t(f.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(f.body)}</p>
              </div>
            ))}
          </div>
        </section>

        <GuestCheck />

        <OceanBand abyss rays={false} waveColor={null} className="mb-16 rounded-[2rem] p-8 shadow-[var(--shadow-lg)] sm:p-12" rise={380}>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("landing.stepsTitle")}</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f5a623] text-lg font-bold text-[#04202e]">
                  {s.n}
                </span>
                <p className="pt-1.5 text-base leading-snug text-white/95">{t(s.key)}</p>
              </li>
            ))}
          </ol>
          <Link href="/register" className="btn-saffron mt-9 inline-block rounded-full px-7 py-3.5 text-base font-semibold">
            {t("landing.ctaBottom")}
          </Link>
        </OceanBand>
      </main>

      <footer className="bg-[#04202e] px-4 py-6 text-center text-xs text-[#a9d4d0]">
        Built for HackCult &apos;26 · Problem statement HC26-GEDA01 · An independent project, not an official GEDA website ·{" "}
        <Link href="/methodology" className="underline hover:text-white">
          {t("nav.methodology")}
        </Link>
      </footer>
    </div>
  );
}
