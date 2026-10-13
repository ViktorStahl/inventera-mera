import { StyleSheet, Switch, Text, View } from "react-native";

import { colors, spacing } from "@/ui/theme";

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function IdentificationUncertainSwitch({ value, onValueChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Osäker artbestämning</Text>
      <Switch
        accessibilityLabel="Osäker artbestämning"
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.green700 }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  label: { color: colors.text, fontWeight: "600" },
});
