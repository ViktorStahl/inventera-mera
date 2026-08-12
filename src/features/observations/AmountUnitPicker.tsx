import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  OBSERVATION_UNITS,
  type ObservationUnit,
} from "@/domain/amount";
import { colors, spacing } from "@/ui/theme";

export function AmountUnitPicker({
  value,
  onChange,
  error,
}: {
  value: ObservationUnit | "";
  onChange: (unit: ObservationUnit | "") => void;
  error?: string;
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Enhet</Text>
      <View style={styles.options}>
        {OBSERVATION_UNITS.map((unit) => {
          const selected = value === unit;
          return (
            <Pressable
              key={unit}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={selected ? `Avmarkera enhet ${unit}` : `Enhet ${unit}`}
              onPress={() => onChange(selected ? "" : unit)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.selectedOption,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.selectedOptionText]}>
                {selected ? "✓ " : ""}
                {unit}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : (
        <Text style={styles.hint}>
          Välj en fast enhet när antal anges. Tryck på den valda enheten igen för att rensa.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    minHeight: 48,
    minWidth: "46%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedOption: {
    borderColor: colors.green700,
    borderWidth: 2,
    backgroundColor: colors.green100,
  },
  pressed: { opacity: 0.72 },
  optionText: { color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  selectedOptionText: { color: colors.green800 },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13 },
});
