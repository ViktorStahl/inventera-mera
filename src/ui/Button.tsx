import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";

import { colors, spacing } from "./theme";

type Props = PressableProps & {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.green700} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primary: { backgroundColor: colors.green700, borderColor: colors.green700 },
  secondary: { backgroundColor: colors.surface, borderColor: colors.green700 },
  danger: { backgroundColor: colors.surface, borderColor: colors.danger },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 16, fontWeight: "700" },
  primaryLabel: { color: "#fff" },
  secondaryLabel: { color: colors.green800 },
  dangerLabel: { color: colors.danger },
  ghostLabel: { color: colors.green800 },
});
