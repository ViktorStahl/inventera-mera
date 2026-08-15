import type { LantmaterietCredentials } from "./lantmateriet";

let sessionCredentials: LantmaterietCredentials | null = null;

export async function getLantmaterietCredentials(): Promise<LantmaterietCredentials | null> {
  return sessionCredentials ? { ...sessionCredentials } : null;
}

export async function saveLantmaterietCredentials(
  credentials: LantmaterietCredentials,
): Promise<void> {
  sessionCredentials = { ...credentials };
}

export async function clearLantmaterietCredentials(): Promise<void> {
  sessionCredentials = null;
}
