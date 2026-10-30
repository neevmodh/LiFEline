"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FootprintBar } from "@/components/FootprintBar";
import { Button, Card, ErrorNote, Field, fmt, inputClass } from "@/components/ui";
import { api, type CommuteMode, type Footprint, type HouseholdInput } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STEPS = ["Your home", "Electricity", "Cooking & travel"];

const COMMUTE_OPTIONS: { value: CommuteMode; label: string }[] = [
  { value: "two_wheeler", label: "Two-wheeler" },
  { value: "car", label: "Car" },
  { value: "bus", label: "Bus" },
  { value: "metro", label: "Metro" },
  { value: "cycle_walk", label: "Cycle / walk" },
];

const DEFAULTS: HouseholdInput = {
  members: 4,
  home_type: "apartment",
  roof_area_sqm: null,
  monthly_kwh: 250,
  ac_count: 1,
  has_geyser: true,
  has_washing_machine: true,
  has_ev: false,
  has_solar: false,
  lpg_cylinders_per_month: 1,
  commute_mode: "two_wheeler",
  commute_km_per_day: 12,
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`rounded-xl border px-3 py-2 text-sm transition ${
        checked ? "border-brand bg-brand-soft font-medium text-brand-strong" : "border-border bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}

export default function OnboardingView() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<HouseholdInput>(DEFAULTS);
  const [preview, setPreview] = useState<Footprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof HouseholdInput>(key: K, value: HouseholdInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const num = (key: keyof HouseholdInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, (e.target.value === "" ? 0 : Number(e.target.value)) as never);

  // Live preview, debounced so typing doesn't spam the API.
  const { monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day } = form;
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .previewFootprint({ monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day]);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api.saveHousehold(form);
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <ol className="mb-6 flex gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`flex-1 rounded-full py-1.5 text-center ${
                i === step ? "bg-brand text-white dark:text-bg" : i < step ? "bg-brand-soft text-brand-strong" : "bg-surface-2 text-muted"
              }`}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold">Tell us about your home</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="People in the household">
                <input type="number" min={1} max={30} value={form.members} onChange={num("members")} className={inputClass} />
              </Field>
              <Field label="Home type">
                <select
                  value={form.home_type}
                  onChange={(e) => set("home_type", e.target.value as HouseholdInput["home_type"])}
                  className={inputClass}
                >
                  <option value="apartment">Apartment</option>
                  <option value="independent">Independent house</option>
                  <option value="row_house">Row house</option>
                </select>
              </Field>
            </div>
            <Field label="Usable roof area (m²)" hint="Shadow-free area for solar panels. Leave empty if you don't know.">
              <input
                type="number"
                min={0}
                value={form.roof_area_sqm ?? ""}
                onChange={(e) => set("roof_area_sqm", e.target.value === "" ? null : Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold">Your electricity use</h1>
            <Field label="Units (kWh) on your last monthly bill" hint="Bi-monthly bill? Divide the units by two.">
              <input type="number" min={0} value={form.monthly_kwh} onChange={num("monthly_kwh")} className={inputClass} />
            </Field>
            <Field label="Number of air conditioners">
              <input type="number" min={0} max={20} value={form.ac_count} onChange={num("ac_count")} className={inputClass} />
            </Field>
            <div>
              <p className="text-sm font-medium">Which of these do you have?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Toggle label="Electric geyser" checked={form.has_geyser} onChange={(v) => set("has_geyser", v)} />
                <Toggle label="Washing machine" checked={form.has_washing_machine} onChange={(v) => set("has_washing_machine", v)} />
                <Toggle label="Electric vehicle" checked={form.has_ev} onChange={(v) => set("has_ev", v)} />
                <Toggle label="Rooftop solar" checked={form.has_solar} onChange={(v) => set("has_solar", v)} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold">Cooking and getting around</h1>
            <Field label="LPG cylinders used per month" hint="A 14.2 kg cylinder every two months = 0.5">
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.lpg_cylinders_per_month}
                onChange={num("lpg_cylinders_per_month")}
                className={inputClass}
              />
            </Field>
            <Field label="How do you usually commute?">
              <select value={form.commute_mode} onChange={(e) => set("commute_mode", e.target.value as CommuteMode)} className={inputClass}>
                {COMMUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kilometres per day (round trip)">
              <input type="number" min={0} value={form.commute_km_per_day} onChange={num("commute_km_per_day")} className={inputClass} />
            </Field>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button onClick={finish} disabled={busy}>
              {busy ? "Saving…" : "See my dashboard"}
            </Button>
          )}
        </div>
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-20">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Your monthly footprint</p>
        {preview ? (
          <>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{fmt.kg(preview.total_kg)}</p>
            <p className="text-sm text-muted">CO₂ per month · {fmt.kg(preview.per_capita_kg)} per person</p>
            <div className="mt-5">
              <FootprintBar footprint={preview} />
            </div>
            <p className="mt-5 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              Estimated electricity bill: <strong>{fmt.rs(preview.monthly_bill_rs)}</strong>/month
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Fill in the form to see your footprint.</p>
        )}
      </Card>
    </div>
  );
}
