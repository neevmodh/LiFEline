"use client";

import { useRef, useState } from "react";
import { Badge, Button, ErrorNote, fmt } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { parseBillText } from "@/lib/billParser";

export interface BillResult {
  monthlyKwh: number;
  /** YYYY-MM the bill ends in, when the reader could tell. */
  month: string | null;
}

interface Found {
  unitsKwh: number | null;
  billingDays: number | null;
  amountRs: number | null;
  monthlyKwh: number | null;
  month: string | null;
  source: "groq" | "anthropic" | "device";
}

const SOURCE_LABEL: Record<Found["source"], string> = {
  groq: "Read by AI (Groq)",
  anthropic: "Read by AI (Claude)",
  device: "Read on your device",
};

const MAX_EDGE_PX = 1600;

/** Shrink large phone photos before upload: faster, cheaper, and within provider size limits. */
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // Unsupported format or browser API; send the original.
  }
}

/** Reads on this device with Tesseract. Used when the server has no AI bill reader configured. */
async function readOnDevice(file: File, onProgress: (pct: number) => void): Promise<Found> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const bill = parseBillText(data.text);
    return { ...bill, month: null, source: "device" };
  } finally {
    await worker.terminate();
  }
}

export function BillScanner({
  onResult,
  compact = false,
  title,
}: {
  onResult: (r: BillResult) => void;
  /** Compact: no box or helper text; just a title row with the button. */
  compact?: boolean;
  title?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFound(null);
    setError(null);
    setStatus("Reading your bill…");
    try {
      let result: Found;
      try {
        const scan = await api.scanBill(await shrinkPhoto(file));
        result = {
          unitsKwh: scan.units_kwh,
          billingDays: scan.billing_days,
          amountRs: scan.bill_amount_rs,
          monthlyKwh: scan.monthly_kwh,
          month: scan.billing_period_end && /^\d{4}-\d{2}$/.test(scan.billing_period_end) ? scan.billing_period_end : null,
          source: scan.provider,
        };
      } catch (e) {
        // 503: no AI reader available (not configured, busy or unreachable). Read the photo here instead.
        if (!(e instanceof ApiError) || e.status !== 503) throw e;
        setStatus("Reading on your device…");
        result = await readOnDevice(file, (pct) => setStatus(`Reading on your device… ${pct}%`));
      }
      setFound(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the bill");
    } finally {
      setStatus(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-dashed border-border bg-surface-2/50 p-4"}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        aria-label="Electricity bill photo"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {compact ? (
          <p className="text-sm font-medium">{title}</p>
        ) : (
          <div>
            <p className="text-sm font-medium">Have your electricity bill?</p>
            <p className="text-xs text-muted">Snap a photo and we&apos;ll fill in the units for you.</p>
          </div>
        )}
        <Button type="button" variant="ghost" disabled={status !== null} onClick={() => input.current?.click()}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {status ?? "Scan bill"}
        </Button>
      </div>

      <div className="mt-3 space-y-2 empty:hidden">
        <ErrorNote message={error} />
        {found &&
          (found.monthlyKwh ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-soft px-3 py-2" role="status">
              <div className="text-sm">
                <p className="font-medium text-brand-strong">
                  {fmt.int(found.monthlyKwh)} kWh per month
                  {found.billingDays && found.billingDays > 35 && found.unitsKwh && (
                    <span className="font-normal">
                      {" "}
                      ({fmt.int(found.unitsKwh)} units over {found.billingDays} days)
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {found.amountRs ? `Bill ${fmt.rs(found.amountRs)} · ` : ""}
                  <Badge tone="muted">{SOURCE_LABEL[found.source]}</Badge>
                </p>
              </div>
              <Button type="button" onClick={() => onResult({ monthlyKwh: found.monthlyKwh!, month: found.month })}>
                Use this
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-sun-soft px-3 py-2 text-sm">
              Couldn&apos;t find the units on this photo. Try a sharper, well-lit photo, or type the units in.
            </p>
          ))}
      </div>
    </div>
  );
}
