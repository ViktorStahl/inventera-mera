import { useEffect } from "react";
import { AppState } from "react-native";

import { saveDraft } from "./database";

export function useDraftAutosave<T>(
  key: string | undefined,
  draft: T | undefined,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled || !key || draft === undefined) return;
    const timeout = setTimeout(() => void saveDraft(key, draft), 300);
    return () => clearTimeout(timeout);
  }, [draft, enabled, key]);

  useEffect(() => {
    if (!enabled || !key || draft === undefined) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void saveDraft(key, draft);
    });
    return () => subscription.remove();
  }, [draft, enabled, key]);
}
