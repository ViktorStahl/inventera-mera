import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import type { SpeciesList, Taxon } from "@/domain/models";
import { taxonomySpeciesSnapshot } from "@/domain/species";
import { addSpeciesToList, getSpeciesList, searchTaxa } from "@/storage/database";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function AddSpeciesToListScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const [list, setList] = useState<SpeciesList>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Taxon[]>([]);
  const [adding, setAdding] = useState<string>();

  useEffect(() => {
    if (!listId) return;
    getSpeciesList(listId).then((loaded) => {
      if (!loaded) throw new Error("Artlistan kunde inte hittas.");
      setList(loaded);
    }).catch((error) => Alert.alert("Artlistan kunde inte öppnas", messageOf(error)));
  }, [listId]);

  useEffect(() => {
    if (!listId || !query.trim()) return;
    let active = true;
    const timeout = setTimeout(() => {
      searchTaxa(query, 50, listId, list?.taxonomyRef.packageId)
        .then((taxa) => { if (active) setResults(taxa); })
        .catch(() => { if (active) setResults([]); });
    }, 100);
    return () => { active = false; clearTimeout(timeout); };
  }, [list?.taxonomyRef.packageId, listId, query]);

  const visibleResults = query.trim() ? results : [];

  async function addTaxon(taxon: Taxon) {
    if (!listId || !list || taxon.inSpeciesList) return;
    setAdding(taxon.id);
    try {
      await addSpeciesToList(listId, taxonomySpeciesSnapshot(taxon, list.taxonomyRef));
      setResults((current) => current.map((item) => item.id === taxon.id ? { ...item, inSpeciesList: true } : item));
    } catch (error) {
      Alert.alert("Arten kunde inte läggas till", messageOf(error));
    } finally {
      setAdding(undefined);
    }
  }

  async function addFreeText() {
    if (!listId || !query.trim()) return;
    setAdding("free-text");
    try {
      await addSpeciesToList(listId, { source: "free-text", enteredName: query.trim() });
      Alert.alert("Arten har lagts till", `”${query.trim()}” finns nu i ${list?.name ?? "artlistan"}.`);
    } catch (error) {
      Alert.alert("Arten kunde inte läggas till", messageOf(error));
    } finally {
      setAdding(undefined);
    }
  }

  if (!list) return <Screen scroll={false} contentContainerStyle={styles.center}><ActivityIndicator color={colors.green700} size="large" /></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Lägg till arter" }} />
      <Text style={styles.heading}>{list.name}</Text>
      <Text style={styles.meta}>Sök i {list.taxonomyRef.name}. Arter som redan finns i listan markeras.</Text>
      <Field label="Sök arter" value={query} onChangeText={setQuery} placeholder="Svenskt eller vetenskapligt namn" autoCorrect={false} autoFocus />
      <View style={styles.results}>
        {visibleResults.map((taxon) => (
          <Card key={taxon.id}>
            <View style={styles.row}>
              <View style={styles.body}>
                <Text style={styles.species}>{taxon.preferredName}</Text>
                <Text style={styles.scientific}>{taxon.scientificName}</Text>
              </View>
              {taxon.inSpeciesList ? <Text style={styles.inList}>✓ I listan</Text> : <Button label="Lägg till" variant="ghost" loading={adding === taxon.id} onPress={() => void addTaxon(taxon)} />}
            </View>
          </Card>
        ))}
      </View>
      {query.trim() ? <Button label={`Lägg till ”${query.trim()}” som fritext`} variant="secondary" loading={adding === "free-text"} onPress={() => void addFreeText()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  heading: { color: colors.text, fontSize: 20, fontWeight: "700" },
  meta: { color: colors.textMuted },
  results: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  body: { flex: 1 },
  species: { color: colors.text, fontWeight: "700" },
  scientific: { color: colors.textMuted, fontStyle: "italic", marginTop: 2 },
  inList: { color: colors.green800, fontWeight: "700" },
});
