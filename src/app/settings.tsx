import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text } from "react-native";

import { AVAILABLE_TAXONOMIES } from "@/data/taxonomies";
import { getAppSettings, updateDefaultTaxonomy } from "@/storage/database";
import { Card } from "@/ui/Card";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function SettingsScreen() {
  const [defaultTaxonomyPackageId, setDefaultTaxonomyPackageId] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((settings) => setDefaultTaxonomyPackageId(settings.defaultTaxonomyPackageId))
      .catch((error) => Alert.alert("Inställningarna kunde inte läsas", messageOf(error)));
  }, []);

  async function selectTaxonomy(packageId: string) {
    if (saving || packageId === defaultTaxonomyPackageId) return;
    const previous = defaultTaxonomyPackageId;
    setDefaultTaxonomyPackageId(packageId);
    setSaving(true);
    try {
      await updateDefaultTaxonomy(packageId);
    } catch (error) {
      setDefaultTaxonomyPackageId(previous);
      Alert.alert("Inställningen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Inställningar" }} />
      <Text style={styles.heading}>Standardtaxonomi</Text>
      <Text style={styles.hint}>
        Väljs automatiskt när du skapar en ny inventering eller artlista. Befintliga data ändras inte.
      </Text>
      {defaultTaxonomyPackageId == null ? (
        <ActivityIndicator color={colors.green700} />
      ) : (
        AVAILABLE_TAXONOMIES.map((taxonomy) => {
          const selected = taxonomy.packageId === defaultTaxonomyPackageId;
          return (
            <Card
              key={taxonomy.packageId}
              onPress={() => void selectTaxonomy(taxonomy.packageId)}
              style={selected ? styles.selected : undefined}
              accessibilityLabel={`Använd ${taxonomy.name} som standardtaxonomi`}
            >
              <Text style={styles.title}>{selected ? "✓ " : ""}{taxonomy.name}</Text>
              <Text style={styles.meta}>{taxonomy.description}</Text>
              <Text style={styles.offline}>{taxonomy.downloaded ? "Tillgänglig offline" : "Inte hämtad"}</Text>
            </Card>
          );
        })
      )}
      {saving ? <Text style={styles.saving}>Sparar …</Text> : null}
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 20, fontWeight: "700" },
  hint: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
  selected: { borderColor: colors.green700, borderWidth: 2, backgroundColor: colors.green100 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  offline: { color: colors.green800, fontSize: 13, marginTop: spacing.sm },
  saving: { color: colors.textMuted, textAlign: "center" },
});
