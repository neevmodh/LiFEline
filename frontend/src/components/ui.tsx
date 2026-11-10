"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-border/70 bg-surface text-text p-5 shadow-[var(--shadow)] sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

const STAT_TONES = {
  brand: "bg-brand-soft/60",
  sky: "bg-sky-soft/70",
  sun: "bg-sun-soft/70",
  plain: "bg-surface",
};

/** A headline number. Pass a tone so a row of stats reads as separate things at a glance. */
export function Stat({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className={`lift rounded-3xl border border-border/60 p-4 shadow-[var(--shadow)] ${STAT_TONES[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary:
      "bg-gradient-to-br from-[#0a8157] to-[#10a073] text-white shadow-[var(--shadow-lg)] hover:brightness-105 active:brightness-95",
    ghost: "border border-border bg-surface text-text shadow-[var(--shadow)] hover:bg-surface-2",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text shadow-[inset_0_1px_2px_rgb(15_42_30/0.04)] outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-4 focus:ring-brand-soft";

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {label}
    </div>
  );
}

export function Badge({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "sun" | "muted" | "danger" }) {
  const styles = {
    brand: "bg-brand-soft text-brand-strong",
    sun: "bg-sun-soft text-[#9a5b00]",
    muted: "bg-surface-2 text-muted",
    danger: "bg-danger-soft text-danger",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "sun" }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={`energy-fill h-full rounded-full ${tone === "brand" ? "bg-gradient-to-r from-[#0a8157] to-[#34b27a]" : "bg-gradient-to-r from-[#d98a06] to-[#f2a516]"}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Load data on mount with loading/error state and a reload function. */
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);

  const load = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload, setData };
}

export function plural(n: number, word: string): string {
  return `${Math.round(n).toLocaleString("en-IN")} ${word}${Math.round(n) === 1 ? "" : "s"}`;
}

export const fmt = {
  kg: (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} t` : `${n.toFixed(n < 10 ? 1 : 0)} kg`),
  rs: (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`,
  int: (n: number) => Math.round(n).toLocaleString("en-IN"),
  month: (ym: string) => {
    const d = new Date(`${ym}-01T00:00:00`);
    return `${d.toLocaleDateString("en-IN", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
  },
};
