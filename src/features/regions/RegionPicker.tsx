import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { searchRegions, type RegionOption } from "@/data/regions";
import { Field } from "@/ui/Field";
import { colors, spacing } from "@/ui/theme";

export function RegionPicker({
  value,
  onChange,
  error,
}: {
  value?: RegionOption;
  onChange: (option: RegionOption) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRegions(query), [query]);

  return (
    <View style={styles.wrapper}>
      <Field
        label="Län eller kommun"
        value={query}
        onChangeText={setQuery}
        placeholder="Sök namn eller SCB-kod"
        error={error}
      />
      {value ? (
        <View style={styles.selected} accessibilityLabel={`Vald region: ${value.label}`}>
          <Text style={styles.selectedLabel}>Vald region</Text>
          <Text style={styles.selectedText}>{value.label}</Text>
        </View>
      ) : null}
      <View style={styles.results}>
        {results.slice(0, query ? 20 : 8).map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={`Välj ${option.label}`}
            onPress={() => {
              onChange(option);
              setQuery("");
            }}
            style={({ pressed }) => [styles.result, pressed && styles.pressed]}
          >
            <Text style={styles.resultTitle} numberOfLines={1}>
              {option.municipalityName ?? option.countyName}
            </Text>
            <Text style={styles.resultMeta} numberOfLines={1}>
              {option.municipalityCode
                ? `${option.municipalityCode} · ${option.countyName}`
                : `${option.countyCode} · Län`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  selected: {
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.green100,
    borderWidth: 1,
    borderColor: colors.green700,
  },
  selectedLabel: { fontSize: 12, color: colors.green800, fontWeight: "700" },
  selectedText: { marginTop: 2, fontSize: 16, color: colors.text },
  results: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  result: { minHeight: 52, padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  resultTitle: { fontSize: 15, color: colors.text, fontWeight: "600" },
  resultMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  pressed: { backgroundColor: colors.green100 },
});
