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
  taxonomyPackageId,
  speciesListId,
  speciesListName,
  error,
}: {
  query: string;
  selectedTaxon?: Taxon;
  onQueryChange: (query: string) => void;
  onSelect: (taxon: Taxon | undefined) => void;
  taxonomyPackageId: string;
  speciesListId?: string;
  speciesListName?: string;
  error?: string;
}) {
  const [results, setResults] = useState<Taxon[]>([]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      searchTaxa(query, 20, speciesListId, taxonomyPackageId)
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
  }, [query, speciesListId, taxonomyPackageId]);

  const listResults = results.filter((taxon) => taxon.inSpeciesList);
  const taxonomyResults = results.filter((taxon) => !taxon.inSpeciesList);

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
          <Text style={styles.selectedLabel}>
            {selectedTaxon.inSpeciesList && speciesListName
              ? `Vald från ${speciesListName}`
              : "Vald från taxonomin"}
          </Text>
          <Text style={styles.name}>{selectedTaxon.preferredName}</Text>
          {selectedTaxon.scientificName ? <Text style={styles.scientific}>{selectedTaxon.scientificName}</Text> : null}
          <Text style={styles.rank}>{selectedTaxon.source === "free-text" ? "fritext" : selectedTaxon.rank}</Text>
        </View>
      ) : query.trim() ? (
        <Text style={styles.freeText}>Sparas som fritext om du inte väljer ett förslag.</Text>
      ) : null}
      {query.trim() && !selectedTaxon ? (
        <View style={styles.results}>
          {listResults.length ? (
            <ResultGroup
              title={`Från artlistan ${speciesListName ?? ""}`.trim()}
              taxa={listResults}
              onSelect={(taxon) => {
                onSelect(taxon);
                onQueryChange(taxon.preferredName);
              }}
            />
          ) : null}
          {taxonomyResults.length ? (
            <ResultGroup
              title={speciesListId ? "Övriga i taxonomin" : "Från taxonomin"}
              taxa={taxonomyResults}
              onSelect={(taxon) => {
                onSelect(taxon);
                onQueryChange(taxon.preferredName);
              }}
            />
          ) : null}
        </View>
      ) : null}
      <Text style={styles.source}>
        Offline-startlista för MVP · fullständigt Dyntaxa-paket ansluts separat
      </Text>
    </View>
  );
}

function ResultGroup({
  title,
  taxa,
  onSelect,
}: {
  title: string;
  taxa: Taxon[];
  onSelect: (taxon: Taxon) => void;
}) {
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      {taxa.map((taxon) => (
        <Pressable
          key={taxon.id}
          accessibilityRole="button"
          accessibilityLabel={`Välj ${taxon.preferredName}, ${taxon.scientificName}`}
          onPress={() => onSelect(taxon)}
          style={({ pressed }) => [styles.result, pressed && styles.pressed]}
        >
          <Text style={styles.name}>{taxon.preferredName}</Text>
          {taxon.scientificName ? <Text style={styles.scientific}>{taxon.scientificName}</Text> : null}
          <Text style={styles.rank}>{taxon.source === "free-text" ? "fritext" : taxon.rank}</Text>
        </Pressable>
      ))}
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
  groupTitle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.green800,
    backgroundColor: colors.green100,
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: { backgroundColor: colors.green100 },
  name: { color: colors.text, fontSize: 16, fontWeight: "600" },
  scientific: { color: colors.textMuted, fontSize: 14, fontStyle: "italic", marginTop: 2 },
  rank: { color: colors.green800, fontSize: 12, marginTop: 3, textTransform: "capitalize" },
  freeText: { color: colors.textMuted, fontSize: 13 },
  source: { color: colors.textMuted, fontSize: 12 },
});
