import Link from "next/link";
import { Logo } from "@/components/AppShell";

const FEATURES = [
  {
    title: "Know your footprint",
    body: "A two-minute setup turns your electricity bill, cooking gas and commute into a monthly CO₂ baseline, then tracks how it falls.",
  },
  {
    title: "Nudges at the right moment",
    body: "Live tips tied to grid peak hours, solar hours and today's temperature in your district, not generic advice.",
  },
  {
    title: "Act together",
    body: "One daily challenge for everyone, ward and district leaderboards, and photo-verified actions so points stay honest.",
  },
  {
    title: "Go solar with real numbers",
    body: "Rooftop sizing from satellite solar data for your location, with PM Surya Ghar subsidy, net cost and payback.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-xl px-3 py-2 text-muted hover:text-text">
            Sign in
          </Link>
          <Link href="/register" className="rounded-xl bg-brand px-4 py-2 font-medium text-white dark:text-bg">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-14 sm:py-20">
          <p className="text-sm font-medium text-brand">Mission LiFE · Lifestyle for Environment</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Small daily choices, measured. Your household&apos;s path to a lower-carbon life.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            LiFEline connects Gujarat&apos;s climate goals to what happens in your home every day: when you run the
            washing machine, how you get to work, and whether your roof could power your house.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-brand px-5 py-3 font-medium text-white dark:text-bg">
              Calculate my footprint
            </Link>
            <Link href="/login" className="rounded-xl border border-border bg-surface px-5 py-3 font-medium">
              I have an account
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Built for HackCult &apos;26 · Problem statement HC26-GEDA01
      </footer>
    </div>
  );
}
