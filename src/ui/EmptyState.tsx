import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "./theme";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>⌁</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  icon: { fontSize: 36, color: colors.green700 },
  title: { fontSize: 19, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { color: colors.textMuted, textAlign: "center", lineHeight: 20 },
});
