import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AVAILABLE_TAXONOMIES, findTaxonomy } from "@/data/taxonomies";
import type { SpeciesListSummary } from "@/domain/models";
import { createSpeciesList, listSpeciesLists } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { colors, spacing } from "@/ui/theme";

export function TaxonomySpeciesListFields({
  taxonomyPackageId,
  speciesListId,
  onTaxonomyChange,
  onSpeciesListChange,
  taxonomyError,
}: {
  taxonomyPackageId: string;
  speciesListId: string;
  onTaxonomyChange: (packageId: string) => void;
  onSpeciesListChange: (listId: string) => void;
  taxonomyError?: string;
}) {
  const [lists, setLists] = useState<SpeciesListSummary[]>([]);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!taxonomyPackageId) return;
    let active = true;
    listSpeciesLists("", taxonomyPackageId)
      .then((loaded) => { if (active) setLists(loaded); })
      .catch((error) => { if (active) Alert.alert("Artlistor kunde inte läsas", messageOf(error)); });
    return () => { active = false; };
  }, [taxonomyPackageId]);

  async function createList() {
    const taxonomy = findTaxonomy(taxonomyPackageId);
    if (!taxonomy || !newListName.trim()) return;
    setCreating(true);
    try {
      const list = await createSpeciesList(newListName, taxonomy);
      setLists((current) => [{ ...list, speciesCount: 0 }, ...current]);
      setNewListName("");
      onSpeciesListChange(list.id);
    } catch (error) {
      Alert.alert("Artlistan kunde inte skapas", messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View>
        <Text style={styles.sectionTitle}>Taxonomi (artkälla)</Text>
        <Text style={styles.hint}>Taxonomin avgör vilka arter som kan föreslås.</Text>
      </View>
      {AVAILABLE_TAXONOMIES.map((taxonomy) => {
        const selected = taxonomy.packageId === taxonomyPackageId;
        return (
          <Card
            key={taxonomy.packageId}
            onPress={() => {
              if (taxonomy.packageId === taxonomyPackageId) return;
              onTaxonomyChange(taxonomy.packageId);
              onSpeciesListChange("");
            }}
            style={selected ? styles.selectedCard : undefined}
            accessibilityLabel={`Välj taxonomi ${taxonomy.name}`}
          >
            <Text style={styles.cardTitle}>{selected ? "✓ " : ""}{taxonomy.name}</Text>
            <Text style={styles.cardMeta}>{taxonomy.description}</Text>
            <Text style={styles.downloaded}>{taxonomy.downloaded ? "Tillgänglig offline" : "Inte hämtad"}</Text>
          </Card>
        );
      })}
      {taxonomyError ? <Text style={styles.error}>{taxonomyError}</Text> : null}

      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>Artlista (valfri)</Text>
        <Text style={styles.hint}>Arter i listan prioriteras i förslagen.</Text>
      </View>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: !speciesListId }}
        onPress={() => onSpeciesListChange("")}
        style={[styles.option, !speciesListId && styles.selectedOption]}
      >
        <Text style={styles.optionTitle}>{!speciesListId ? "✓ " : ""}Ingen artlista</Text>
      </Pressable>
      {lists.map((list) => {
        const selected = list.id === speciesListId;
        return (
          <Pressable
            key={list.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onSpeciesListChange(list.id)}
            style={[styles.option, selected && styles.selectedOption]}
          >
            <Text style={styles.optionTitle}>{selected ? "✓ " : ""}{list.name}</Text>
            <Text style={styles.cardMeta}>{list.speciesCount} {list.speciesCount === 1 ? "art" : "arter"}</Text>
          </Pressable>
        );
      })}
      <Field
        label="Ny artlista"
        value={newListName}
        onChangeText={setNewListName}
        placeholder="Till exempel Fjällväxter"
      />
      <Button
        label="Skapa och välj artlista"
        variant="secondary"
        loading={creating}
        disabled={!taxonomyPackageId || !newListName.trim()}
        onPress={() => void createList()}
      />
    </View>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  listHeading: { marginTop: spacing.md },
  selectedCard: { borderColor: colors.green700, borderWidth: 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cardMeta: { color: colors.textMuted, marginTop: spacing.xs },
  downloaded: { color: colors.green800, fontSize: 13, marginTop: spacing.sm },
  option: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  selectedOption: { borderColor: colors.green700, borderWidth: 2, backgroundColor: colors.green100 },
  optionTitle: { color: colors.text, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13 },
});
