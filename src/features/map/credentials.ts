import * as SecureStore from "expo-secure-store";

import type { LantmaterietCredentials } from "./lantmateriet";

const CREDENTIALS_KEY = "lantmateriet-wmts-credentials";

export async function getLantmaterietCredentials(): Promise<LantmaterietCredentials | null> {
  const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!stored) return null;
  try {
    const credentials = JSON.parse(stored) as Partial<LantmaterietCredentials>;
    if (typeof credentials.username !== "string" || typeof credentials.password !== "string") {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      return null;
    }
    return { username: credentials.username, password: credentials.password };
  } catch {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    return null;
  }
}

export async function saveLantmaterietCredentials(
  credentials: LantmaterietCredentials,
): Promise<void> {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearLantmaterietCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}
