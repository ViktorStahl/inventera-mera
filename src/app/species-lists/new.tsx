import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AVAILABLE_TAXONOMIES, findTaxonomy } from "@/data/taxonomies";
import { dismissToSpeciesList } from "@/navigation/hierarchy";
import { createSpeciesList, getAppSettings } from "@/storage/database";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function NewSpeciesListScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [taxonomyPackageId, setTaxonomyPackageId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((settings) => setTaxonomyPackageId(settings.defaultTaxonomyPackageId))
      .catch((error) => Alert.alert("Inställningarna kunde inte läsas", messageOf(error)));
  }, []);

  async function save() {
    const taxonomy = findTaxonomy(taxonomyPackageId);
    if (!taxonomy || !name.trim()) return;
    setSaving(true);
    try {
      const list = await createSpeciesList(name, taxonomy);
      dismissToSpeciesList(router, list.id);
    } catch (error) {
      Alert.alert("Artlistan kunde inte skapas", messageOf(error));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ny artlista" }} />
      <Field label="Namn" value={name} onChangeText={setName} placeholder="Till exempel Fjällväxter" autoFocus />
      <Text style={styles.heading}>Taxonomi</Text>
      {AVAILABLE_TAXONOMIES.map((taxonomy) => (
        <Card key={taxonomy.packageId} onPress={() => setTaxonomyPackageId(taxonomy.packageId)} style={taxonomy.packageId === taxonomyPackageId ? styles.selected : undefined}>
          <Text style={styles.title}>{taxonomy.packageId === taxonomyPackageId ? "✓ " : ""}{taxonomy.name}</Text>
          <Text style={styles.meta}>{taxonomy.description}</Text>
        </Card>
      ))}
      <View style={styles.actions}>
        <Button label="Skapa artlista" loading={saving} disabled={!name.trim() || !taxonomyPackageId} onPress={() => void save()} />
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: "700" },
  selected: { borderColor: colors.green700, borderWidth: 2 },
  title: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  actions: { gap: spacing.sm },
});
