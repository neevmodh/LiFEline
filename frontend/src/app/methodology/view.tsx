"use client";

import Link from "next/link";
import { Logo } from "@/components/AppShell";
import { Card, Spinner } from "@/components/ui";
import { useConfig } from "@/lib/config";

/** Every number the app shows comes from these factors; served by the API so this page can't drift from the code. */
export default function MethodologyView() {
  const config = useConfig();

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
        <Logo />
        <Link href="/login" className="text-sm text-muted hover:text-text">
          Sign in
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 pb-16">
        <div>
          <h1 className="text-2xl font-semibold">How we calculate</h1>
          <p className="mt-2 text-sm text-muted">
            Your footprint, bill, savings and solar estimate are worked out from your own answers and these published
            figures. There is no sample data: every citizen, reading and action in LiFEline comes from a real person.
          </p>
        </div>

        <Card>
          <h2 className="font-semibold">Your numbers</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>Footprint:</strong> monthly electricity × grid factor, plus LPG cylinders × emissions per cylinder,
              plus commute distance × 22 working days × the factor for how you travel.
            </li>
            <li>
              <strong>Bill:</strong> your DISCOM&apos;s telescopic slabs for urban or rural connections, plus fixed
              charge, fuel adjustment (FPPAS) and electricity duty.
            </li>
            <li>
              <strong>Action savings:</strong> worked out for your household. Bus instead of car uses your own commute
              distance, the AC set-point uses how many ACs you have, and actions that don&apos;t fit your home are switched
              off.
            </li>
            <li>
              <strong>Peak-hour shifts</strong> save no units, but move them away from the evening peak, when extra demand
              is met by fossil plants (the grid&apos;s operating margin).
            </li>
            <li>
              <strong>Real saving:</strong> a cooler month lowers bills without anyone saving. LiFEline fits monthly
              units = base load + slope × cooling degree days (heat above 24°C, from observed weather for your district),
              learned from your own bills, or from households in your district until you have three months. Your saving is
              how far a bill came in under what that month&apos;s weather alone would predict.
            </li>
            <li>
              <strong>Photo proof:</strong> each photo is fingerprinted, so the same picture (even resized) can&apos;t back two
              claims. An AI pre-screens photos for reviewers; a person always decides.
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold">Figures and sources</h2>
          {!config ? (
            <Spinner />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">What</th>
                    <th className="py-2 pr-4 font-medium">Value</th>
                    <th className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {config.sources.map((s) => (
                    <tr key={s.topic} className="align-top">
                      <td className="py-2 pr-4 font-medium">{s.topic}</td>
                      <td className="py-2 pr-4">{s.value}</td>
                      <td className="py-2 text-muted">
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-text">
                            {s.source}
                          </a>
                        ) : (
                          s.source
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
