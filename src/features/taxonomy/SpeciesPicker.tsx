import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Taxon } from "@/domain/models";
import { searchTaxa } from "@/storage/database";
import { Field } from "@/ui/Field";
import { colors, spacing } from "@/ui/theme";

export function SpeciesPicker({
  query,
  selectedTaxon,
  onQueryChange,
  onSelect,
  error,
}: {
  query: string;
  selectedTaxon?: Taxon;
  onQueryChange: (query: string) => void;
  onSelect: (taxon: Taxon | undefined) => void;
  error?: string;
}) {
  const [results, setResults] = useState<Taxon[]>([]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      searchTaxa(query)
        .then((taxa) => {
          if (active) setResults(taxa);
        })
        .catch(() => {
          if (active) setResults([]);
        });
    }, 100);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <View style={styles.wrapper}>
      <Field
        label="Artnamn"
        value={query}
        onChangeText={(value) => {
          onQueryChange(value);
          if (selectedTaxon && value !== selectedTaxon.preferredName) onSelect(undefined);
        }}
        placeholder="Sök svenskt eller vetenskapligt namn"
        autoCorrect={false}
        error={error}
      />
      {selectedTaxon ? (
        <View style={styles.selected}>
          <Text style={styles.selectedLabel}>Vald från startlistan</Text>
          <Text style={styles.name}>{selectedTaxon.preferredName}</Text>
          <Text style={styles.scientific}>{selectedTaxon.scientificName}</Text>
          <Text style={styles.rank}>{selectedTaxon.rank}</Text>
        </View>
      ) : query.trim() ? (
        <Text style={styles.freeText}>Sparas som fritext om du inte väljer ett förslag.</Text>
      ) : null}
      {query.trim() && !selectedTaxon ? (
        <View style={styles.results}>
          {results.map((taxon) => (
            <Pressable
              key={taxon.id}
              accessibilityRole="button"
              accessibilityLabel={`Välj ${taxon.preferredName}, ${taxon.scientificName}`}
              onPress={() => {
                onSelect(taxon);
                onQueryChange(taxon.preferredName);
              }}
              style={({ pressed }) => [styles.result, pressed && styles.pressed]}
            >
              <Text style={styles.name}>{taxon.preferredName}</Text>
              <Text style={styles.scientific}>{taxon.scientificName}</Text>
              <Text style={styles.rank}>{taxon.rank}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={styles.source}>
        Offline-startlista för MVP · fullständigt Dyntaxa-paket ansluts separat
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  selected: {
    backgroundColor: colors.green100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.green700,
    padding: spacing.md,
  },
  selectedLabel: { color: colors.green800, fontSize: 12, fontWeight: "700" },
  results: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  result: { padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.green100 },
  name: { color: colors.text, fontSize: 16, fontWeight: "600" },
  scientific: { color: colors.textMuted, fontSize: 14, fontStyle: "italic", marginTop: 2 },
  rank: { color: colors.green800, fontSize: 12, marginTop: 3, textTransform: "capitalize" },
  freeText: { color: colors.textMuted, fontSize: 13 },
  source: { color: colors.textMuted, fontSize: 12 },
});
