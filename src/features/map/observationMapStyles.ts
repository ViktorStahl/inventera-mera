import { StyleSheet } from "react-native";

import { colors, spacing } from "@/ui/theme";

export const observationMapStyles = StyleSheet.create({
  wrapper: { flex: 1, minHeight: 0, gap: spacing.md },
  mapFrame: {
    flex: 1,
    minHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#EEF1E5",
    overflow: "hidden",
    position: "relative",
  },
  nativeMap: { flex: 1 },
  loadingMap: { alignItems: "center", justifyContent: "center" },
  notice: { backgroundColor: "#FFF7E6", borderRadius: 10, padding: spacing.md },
  noticeTitle: { color: colors.warning, fontWeight: "700" },
  noticeText: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
});
