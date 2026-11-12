// Share my month: the household's impact card (GET /api/share/card.png, first name and district
// only) saved to the phone's cache and handed to the share sheet, so it goes straight to WhatsApp.
// share-card.web.ts uses the browser's share sheet or downloads it.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { API_URL, authHeaders } from "@/lib/api";

export async function shareImpactCard(title: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}nidhi-my-month.png`;
  const res = await FileSystem.downloadAsync(`${API_URL}/api/share/card.png`, uri, { headers: authHeaders() });
  if (res.status !== 200) throw new Error(`card ${res.status}`);
  await Sharing.shareAsync(res.uri, { mimeType: "image/png", dialogTitle: title, UTI: "public.png" });
}
