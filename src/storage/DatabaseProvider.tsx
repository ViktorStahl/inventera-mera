import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "@/ui/theme";
import { getDatabase } from "./database";

type DatabaseState = { ready: true };

const DatabaseContext = createContext<DatabaseState | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getDatabase()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Databasen kunde inte öppnas.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<DatabaseState>(() => ({ ready: true }), []);
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Inventera mera kunde inte starta</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={styles.center} accessibilityLabel="Förbereder lokal databas">
        <ActivityIndicator size="large" color={colors.green700} />
        <Text style={styles.loading}>Förbereder offline-data…</Text>
      </View>
    );
  }
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabaseReady(): void {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error("useDatabaseReady must be used inside DatabaseProvider");
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.background,
  },
  loading: { marginTop: 12, color: colors.textMuted },
  errorTitle: { fontSize: 20, fontWeight: "700", color: colors.danger },
  errorText: { marginTop: 8, textAlign: "center", color: colors.text },
});
