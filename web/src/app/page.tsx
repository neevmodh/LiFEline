"use client";

// The landing page, in the app's paper look: a sunrise over Gujarati rooftops behind the free bill
// check, the real app in phone frames, what's inside it, how it works, the data behind it, and who
// it is for. Everything moves gently and stands still under reduce-motion.
import Link from "next/link";
import { BillCheck } from "@/components/BillCheck";
import { Qr } from "@/components/Qr";
import { GedaStrip, LanguageSwitcher, Logo, LogoMark } from "@/components/Shell";
import { useI18n, type MessageKey } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { APK_URL, APP_URL } from "@/lib/links";

const STEPS: { n: string; t: MessageKey; b: MessageKey }[] = [
  { n: "1", t: "how.1.t", b: "how.1.b" },
  { n: "2", t: "how.2.t", b: "how.2.b" },
  { n: "3", t: "how.3.t", b: "how.3.b" },
];
const DATA: { t: MessageKey; b: MessageKey }[] = [
  { t: "data.c1.t", b: "data.c1.b" },
  { t: "data.c2.t", b: "data.c2.b" },
  { t: "data.c3.t", b: "data.c3.b" },
];
const WHO: { t: MessageKey; b: MessageKey }[] = [
  { t: "who.1.t", b: "who.1.b" },
  { t: "who.2.t", b: "who.2.b" },
  { t: "who.3.t", b: "who.3.b" },
];
// Each feature's tint, ink and a simple stroke icon (24x24).
const FEATURES: { t: MessageKey; b: MessageKey; tint: string; ink: string; icon: string }[] = [
  { t: "feat.1.t", b: "feat.1.b", tint: "bg-sun-soft", ink: "text-sun", icon: "M4 6h12v14H4zM8 3h12v14" },
  { t: "feat.2.t", b: "feat.2.b", tint: "bg-brand-soft", ink: "text-brand-strong", icon: "M12 3c1 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 2-6 1 1 2 2 2 3 0-3 1-5 2-7z" },
  { t: "feat.3.t", b: "feat.3.b", tint: "bg-sky-soft", ink: "text-sky", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { t: "feat.4.t", b: "feat.4.b", tint: "bg-danger-soft", ink: "text-clay", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" },
  { t: "feat.5.t", b: "feat.5.b", tint: "bg-sun-soft", ink: "text-sun", icon: "M13 2 4 14h7l-1 8 9-12h-7z" },
  { t: "feat.6.t", b: "feat.6.b", tint: "bg-brand-soft", ink: "text-brand-strong", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" },
];

export default function Landing() {
  const { t } = useI18n();
  const { user } = useAuth();
  const staff = !!user && user.role !== "citizen";

  return (
    <div className="flex flex-1 flex-col overflow-x-clip bg-bg">
      <GedaStrip />

      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Logo />
          <nav aria-label="Main" className="hidden gap-1 text-sm md:flex">
            {([["#features", "feat.kicker"], ["#how", "nav.how"], ["#data", "nav.data"], ["#who", "nav.communities"]] as [string, MessageKey][]).map(([href, k]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 font-medium text-muted hover:bg-surface-2 hover:text-text">{t(k)}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <LanguageSwitcher />
            <Link href={staff ? "/geda" : "/login"} className="hidden rounded-full px-4 py-2 font-medium text-muted hover:bg-surface-2 hover:text-text sm:inline-block">
              {t("get.gedaSignIn")}
            </Link>
            <a href={APP_URL} className="rounded-full bg-navy px-4 py-2 font-semibold text-[#f6f2ea] hover:bg-abyss">{t("hero.ctaApp")}</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <Sunrise />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-44 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-56 lg:pt-16">
          <div className="anim-rise">
            <p className="kicker text-sun">{t("hero.kicker")}</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.04] text-text sm:text-6xl">{t("hero.title")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t("hero.sub")}</p>
            <ul className="mt-7 space-y-2.5 text-[15px]">
              {(["hero.trust1", "hero.trust2", "hero.trust3"] as MessageKey[]).map((k) => (
                <li key={k} className="flex items-center gap-3">
                  <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-brand-strong">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={APP_URL} className="btn-saffron inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-base">
                {t("hero.ctaApp")}
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
              <a href="#start" className="inline-flex min-h-12 items-center rounded-full border border-border bg-surface px-6 text-base font-semibold hover:bg-surface-2">{t("hero.ctaCheck")}</a>
            </div>
          </div>
          <div id="start" className="anim-rise scroll-mt-24 [animation-delay:.15s]"><BillCheck /></div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-8">
        <section id="get" aria-labelledby="get-title" className="scroll-mt-24 pt-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="relative mx-auto h-[480px] w-full max-w-[520px] sm:h-[560px]" aria-hidden>
              <div className="absolute inset-x-8 bottom-4 top-20 rounded-[48px] bg-sun-soft" />
              <Phone src="/app-quests.png" alt="" className="anim-bob absolute left-0 top-16 w-[150px] -rotate-6 [animation-delay:-2s] sm:w-[190px]" />
              <Phone src="/app-act.png" alt="" className="anim-bob absolute right-0 top-20 w-[150px] rotate-6 [animation-delay:-4s] sm:w-[190px]" />
              <Phone src="/app-home.png" alt={t("get.phoneAlt")} className="anim-bob absolute left-1/2 top-0 w-[200px] -translate-x-1/2 sm:w-[230px]" />
            </div>
            <div>
              <h2 id="get-title" className="text-3xl font-bold sm:text-4xl">{t("get.title")}</h2>
              <p className="mt-3 max-w-xl text-muted">{t("get.sub")}</p>
              <div className="mt-6 grid gap-4">
                <div className="tilt flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-surface p-6 shadow-[var(--shadow)]">
                  <Qr value={APK_URL || APP_URL} label={t("get.qrAlt")} />
                  <div className="min-w-[200px] flex-1">
                    <h3 className="text-xl font-semibold">{t("get.android")}</h3>
                    <p className="mt-1 text-sm text-muted">{APK_URL ? t("get.androidBody") : t("get.androidSoon")}</p>
                    {APK_URL && <a href={APK_URL} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-[#f6f2ea] hover:bg-abyss">{t("get.androidDownload")}</a>}
                  </div>
                </div>
                <div className="tilt flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-3xl bg-surface p-6 shadow-[var(--shadow)]">
                  <div className="min-w-[200px] flex-1"><h3 className="text-xl font-semibold">{t("get.web")}</h3><p className="mt-1 text-sm text-muted">{t("get.webBody")}</p></div>
                  <a href={APP_URL} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-strong">{t("get.webOpen")}</a>
                </div>
                <div className="tilt flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-3xl bg-surface p-6 shadow-[var(--shadow)]">
                  <div className="min-w-[200px] flex-1"><h3 className="text-xl font-semibold">{t("get.geda")}</h3><p className="mt-1 text-sm text-muted">{t("get.gedaBody")}</p></div>
                  <Link href={staff ? "/geda" : "/login"} className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold hover:bg-surface-2">{t("get.gedaSignIn")}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 py-20">
          <p className="kicker text-sun">{t("feat.kicker")}</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">{t("feat.title")}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="tilt rounded-3xl bg-surface p-7 shadow-[var(--shadow)]">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${f.tint} ${f.ink}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={f.icon} /></svg>
                </span>
                <h3 className="mt-5 text-xl font-semibold">{t(f.t)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{t(f.b)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-24 pb-20">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t("how.title")}</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative rounded-3xl border border-border bg-surface p-7">
                <span className="num grid h-11 w-11 place-items-center rounded-full bg-navy text-lg font-bold text-[#f6f2ea]">{s.n}</span>
                <h3 className="mt-5 text-xl font-semibold">{t(s.t)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{t(s.b)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="data" className="scroll-mt-24 rounded-[32px] bg-navy px-6 py-14 text-[#f6f2ea] sm:px-12">
          <p className="kicker text-foam">{t("nav.data")}</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">{t("data.title")}</h2>
          <p className="mt-3 max-w-2xl text-[#d5dccf]">{t("data.sub")}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {DATA.map((d) => (
              <div key={d.t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold">{t(d.t)}</h3>
                <p className="mt-2 leading-relaxed text-[#d5dccf]">{t(d.b)}</p>
              </div>
            ))}
          </div>
          <Link href="/methodology" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[#f6f2ea] px-5 text-sm font-semibold text-text hover:bg-white">{t("footer.method")}</Link>
        </section>

        <section id="who" className="scroll-mt-24 py-20">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t("who.title")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {WHO.map((w, i) => (
              <div key={w.t} className="tilt rounded-3xl bg-surface p-7 shadow-[var(--shadow)]">
                <span className={`kicker ${["text-brand-strong", "text-sky", "text-sun"][i]}`}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-xl font-semibold">{t(w.t)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{t(w.b)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mb-16 overflow-hidden rounded-[32px] bg-sun-soft px-6 py-16 text-center sm:px-12">
          <div className="anim-sun absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-foam/60" aria-hidden />
          <div className="relative">
            <LogoMark size={56} />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold sm:text-4xl">{t("cta.title")}</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#start" className="btn-saffron inline-flex min-h-12 items-center rounded-full px-8 text-lg">{t("cta.button")}</a>
              <a href={APP_URL} className="inline-flex min-h-12 items-center rounded-full border border-[#e2cfae] bg-surface px-8 text-lg font-semibold hover:bg-white">{t("hero.ctaApp")}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-navy px-4 py-10 text-[#d5dccf] sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <LogoMark size={40} />
            <div><p className="font-display text-xl font-bold text-[#f6f2ea]">Nidhi</p><p className="text-sm">{t("footer.tag")}</p></div>
          </div>
          <p className="max-w-xl text-xs leading-relaxed">
            {t("footer.note")} · <Link href="/methodology" className="underline hover:text-white">{t("footer.method")}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** The hero's backdrop: the sun rising over rooftops with solar panels, clouds drifting, a tree swaying. */
function Sunrise() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[#efe6d6]" />
      <div className="anim-sun absolute -right-16 top-2 h-44 w-44 rounded-full bg-foam/30 sm:right-[8%] sm:top-[18%] sm:h-80 sm:w-80 sm:bg-foam/40" />
      <div className="anim-sun absolute -right-6 top-10 h-24 w-24 rounded-full bg-foam/70 sm:right-[12%] sm:top-[26%] sm:h-52 sm:w-52 sm:bg-foam" />
      <svg className="anim-cloud absolute left-0 top-16 h-8 w-24" viewBox="0 0 72 26"><path d="M0 24h70a16 16 0 0 0-22-20 22 22 0 0 0-40 6A12 12 0 0 0 0 24z" fill="#fbf7ef" /></svg>
      <svg className="anim-cloud-slow absolute left-0 top-40 h-6 w-20" viewBox="0 0 58 20"><path d="M0 18h56a13 13 0 0 0-18-16 18 18 0 0 0-32 5A10 10 0 0 0 0 18z" fill="#fbf7ef" /></svg>
      <svg className="absolute bottom-0 left-0 h-44 w-full lg:h-56" viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice">
        <path d="M0 120 140 80l120 40 160-70 140 60 120-40 220 70 160-50 200 60 180-40v170H0z" fill="#c9d3be" />
        <rect x="90" y="100" width="170" height="120" fill="#e3c9a8" /><path d="M76 104 175 52l100 52z" fill="#b5674a" />
        <rect x="120" y="140" width="34" height="40" rx="5" fill="#f6f2ea" /><rect x="190" y="140" width="34" height="40" rx="5" fill="#f6f2ea" />
        <rect x="320" y="60" width="200" height="160" fill="#ebdcc5" />
        <g transform="translate(340 40) skewX(-18)"><rect width="70" height="22" fill="#476a86" /><rect x="76" width="70" height="22" fill="#476a86" /></g>
        <rect x="346" y="90" width="34" height="38" rx="5" fill="#f6f2ea" /><rect x="404" y="90" width="34" height="38" rx="5" fill="#e9b872" /><rect x="462" y="90" width="34" height="38" rx="5" fill="#f6f2ea" />
        <rect x="346" y="150" width="34" height="38" rx="5" fill="#f6f2ea" /><rect x="404" y="150" width="34" height="38" rx="5" fill="#f6f2ea" /><rect x="462" y="150" width="34" height="38" rx="5" fill="#f6f2ea" />
        <g className="anim-sway"><rect x="568" y="140" width="12" height="80" fill="#7a5a3f" /><circle cx="574" cy="128" r="38" fill="#4e7d5e" /><circle cx="550" cy="150" r="22" fill="#6f9a7b" /></g>
        <rect x="640" y="110" width="180" height="110" fill="#dcc6a6" /><path d="M628 114h204l-20-34H648z" fill="#8e5a43" />
        <rect x="666" y="140" width="38" height="44" rx="5" fill="#f6f2ea" /><rect x="752" y="140" width="38" height="44" rx="5" fill="#f6f2ea" />
        <rect x="880" y="70" width="230" height="150" fill="#ebdcc5" />
        <g transform="translate(905 52) skewX(-18)"><rect width="80" height="22" fill="#476a86" /><rect x="86" width="80" height="22" fill="#476a86" /></g>
        <rect x="910" y="100" width="40" height="40" rx="5" fill="#f6f2ea" /><rect x="976" y="100" width="40" height="40" rx="5" fill="#f6f2ea" /><rect x="1042" y="100" width="40" height="40" rx="5" fill="#e9b872" />
        <rect x="1170" y="120" width="160" height="100" fill="#e3c9a8" /><path d="M1156 124 1250 74l94 50z" fill="#b5674a" />
        <rect x="1196" y="150" width="34" height="40" rx="5" fill="#f6f2ea" /><rect x="1270" y="150" width="34" height="40" rx="5" fill="#f6f2ea" />
        <rect y="206" width="1440" height="14" fill="#f6f2ea" />
      </svg>
    </div>
  );
}

/** A phone frame around an app screenshot. */
function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[34px] border-[7px] border-[#23312a] bg-[#23312a] shadow-[var(--shadow-lg)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot, sized by its frame */}
      <img src={src} alt={alt} width={390} height={844} className="block h-auto w-full rounded-[26px]" />
    </div>
  );
}
