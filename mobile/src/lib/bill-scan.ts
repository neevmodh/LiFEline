// Reading an electricity bill from a photo, shared by onboarding, My progress and Bill X-ray. The
// camera is tried first and falls back to the gallery; the API reads the units with a vision model
// (the photo isn't kept). 503 means no vision model is configured, so the user types the units.
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

import type { MessageKey } from "@/i18n";
import { api, ApiError, type BillScan } from "@/lib/api";

export type ScanState =
  | { state: "idle" | "busy" }
  | { state: "done"; kwh: number; bill: BillScan }
  | { state: "error"; message: MessageKey };

/** Units for one month: the bill's own monthly figure, else its units, else nothing. */
export function monthlyUnits(bill: BillScan): number | null {
  const n = bill.monthly_kwh ?? bill.units_kwh;
  return n && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function useBillScan(onRead?: (kwh: number, bill: BillScan) => void) {
  const [scan, setScan] = useState<ScanState>({ state: "idle" });

  async function pick(source: "camera" | "library"): Promise<void> {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return pick("library");
    }
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    setScan({ state: "busy" });
    try {
      const bill = await api.scanBill(res.assets[0]);
      const kwh = monthlyUnits(bill);
      if (!kwh) throw new ApiError(422, "unreadable");
      onRead?.(kwh, bill);
      setScan({ state: "done", kwh, bill });
    } catch (e) {
      setScan({ state: "error", message: e instanceof ApiError && e.status === 503 ? "onboard.scanUnavailable" : "onboard.scanFailed" });
    }
  }

  return { scan, pick, reset: () => setScan({ state: "idle" }) };
}
