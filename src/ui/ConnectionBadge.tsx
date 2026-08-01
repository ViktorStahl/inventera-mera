import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "./theme";

export function ConnectionBadge() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    Network.getNetworkStateAsync().then((state) => {
      if (active) setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const label = online === false ? "Offline · sparas på enheten" : "Sparas på enheten";
  return (
    <View style={styles.badge} accessibilityLabel={label}>
      <View style={[styles.dot, online === false && styles.dotOffline]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.green100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green700 },
  dotOffline: { backgroundColor: colors.warning },
  text: { fontSize: 13, color: colors.green900, fontWeight: "600" },
});
