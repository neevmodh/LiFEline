// Web build: the browser's share sheet where it can share files (phones), else a download.
import { API_URL, authHeaders } from "@/lib/api";

export async function shareImpactCard(title: string): Promise<void> {
  const resp = await fetch(`${API_URL}/api/share/card.png`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`card ${resp.status}`);
  const blob = await resp.blob();
  const file = new File([blob], "nidhi-my-month.png", { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // the person closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
