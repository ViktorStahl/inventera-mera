import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { colors, spacing } from "./theme";

type Props = PropsWithChildren<{
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}>;

export function Card({ children, onPress, accessibilityLabel, style }: Props) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  pressed: { opacity: 0.72 },
});
