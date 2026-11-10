"use client";

import Link from "next/link";
import { BillCheck } from "@/components/BillCheck";
import { GedaStrip, LanguageSwitcher, Logo, WaveEdge } from "@/components/Shell";
import { useI18n, type MessageKey } from "@/i18n";
import { useAuth } from "@/lib/auth";

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

export default function Landing() {
  const { t } = useI18n();
  const { user } = useAuth();
  const home = user ? (user.role === "citizen" ? "/home" : "/geda") : "/login";

  return (
    <div className="flex flex-1 flex-col">
      <GedaStrip />
      <section className="hero pb-24">
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <Logo light />
          <nav aria-label="Main" className="hidden gap-1 text-sm md:flex">
            {([["#how", "nav.how"], ["#data", "nav.data"], ["#who", "nav.communities"]] as [string, MessageKey][]).map(([href, k]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 text-[#cfeee6] hover:bg-white/10 hover:text-white">{t(k)}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <LanguageSwitcher />
            <Link href={home} className="rounded-full px-4 py-2 font-medium text-[#cfeee6] hover:bg-white/10 hover:text-white">
              {user ? t("nav.home2") : t("nav.signIn2")}
            </Link>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-6 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
          <div>
            <p className="kicker text-[#8fe3cf]">{t("hero.kicker")}</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-6xl">{t("hero.title")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#cfeee6]">{t("hero.sub")}</p>
            <ul className="mt-8 space-y-2.5 text-[15px] text-[#d6efe8]">
              {(["hero.trust1", "hero.trust2", "hero.trust3"] as MessageKey[]).map((k) => (
                <li key={k} className="flex items-center gap-3">
                  <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-[#8fe3cf]/20 text-xs text-[#8fe3cf]">✓</span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
          <div id="start"><BillCheck /></div>
        </div>
        <WaveEdge />
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-8">
        <section id="how" className="scroll-mt-20 py-16">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t("how.title")}</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-3xl border border-border bg-white p-7 shadow-[var(--shadow)]">
                <span className="num grid h-11 w-11 place-items-center rounded-full bg-navy text-lg font-bold text-white">{s.n}</span>
                <h3 className="mt-5 text-xl font-semibold">{t(s.t)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{t(s.b)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="data" className="scroll-mt-20 rounded-[32px] bg-navy px-6 py-14 text-white sm:px-12">
          <p className="kicker text-[#8fe3cf]">{t("nav.data")}</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">{t("data.title")}</h2>
          <p className="mt-3 max-w-2xl text-[#cfeee6]">{t("data.sub")}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {DATA.map((d) => (
              <div key={d.t} className="rounded-2xl border border-white/15 bg-white/5 p-6">
                <h3 className="text-lg font-semibold">{t(d.t)}</h3>
                <p className="mt-2 leading-relaxed text-[#cfeee6]">{t(d.b)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="who" className="scroll-mt-20 py-16">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{t("who.title")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {WHO.map((w, i) => (
              <div key={w.t} className="rounded-3xl border border-border bg-white p-7 shadow-[var(--shadow)]">
                <span className={`kicker ${["text-brand", "text-sky", "text-sun"][i]}`}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-xl font-semibold">{t(w.t)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{t(w.b)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-[32px] bg-gradient-to-br from-[#0a7a57] to-[#06624a] px-6 py-14 text-center text-white sm:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-4xl">{t("cta.title")}</h2>
          <a href="#start" className="btn-saffron mt-8 inline-block rounded-full px-8 py-4 text-lg">{t("cta.button")}</a>
        </section>
      </main>

      <footer className="bg-abyss px-4 py-6 text-center text-xs text-[#a9d4d0]">
        {t("footer.note")} ·{" "}
        <Link href="/methodology" className="underline hover:text-white">{t("footer.method")}</Link>
      </footer>
    </div>
  );
}
