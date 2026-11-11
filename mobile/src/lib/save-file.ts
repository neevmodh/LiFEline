// Phones: write the file to the app's cache and open the share sheet, so the person chooses where
// it goes (Files, Drive, WhatsApp to themselves...). save-file.web.ts downloads it in the browser.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function saveTextFile(name: string, contents: string, mimeType: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, contents);
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: name });
}
