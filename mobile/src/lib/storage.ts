// The session token lives in the device keychain (expo-secure-store). storage.web.ts uses localStorage.
import * as SecureStore from "expo-secure-store";

export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string | null): Promise<void> {
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
