import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import type { SpeciesList, SpeciesListEntry } from "@/domain/models";
import { normalizeSpeciesName } from "@/domain/species";
import { dismissToSpeciesLists } from "@/navigation/hierarchy";
import { deleteSpeciesList, getSpeciesList, listSpeciesListEntries, removeSpeciesFromList, renameSpeciesList } from "@/storage/database";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { confirmDestructive } from "@/ui/confirm";
import { EmptyState } from "@/ui/EmptyState";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function SpeciesListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();
  const [list, setList] = useState<SpeciesList>();
  const [entries, setEntries] = useState<SpeciesListEntry[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const [loadedList, loadedEntries] = await Promise.all([
        getSpeciesList(listId),
        listSpeciesListEntries(listId),
      ]);
      if (!loadedList) throw new Error("Artlistan kunde inte hittas.");
      setList(loadedList);
      setName(loadedList.name);
      setEntries(loadedEntries);
    } catch (error) {
      Alert.alert("Artlistan kunde inte öppnas", messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const filtered = useMemo(() => {
    const query = normalizeSpeciesName(search);
    if (!query) return entries;
    return entries.filter((entry) => normalizeSpeciesName([
      entry.species.preferredName,
      entry.species.scientificName,
      entry.species.enteredName,
    ].filter(Boolean).join(" ")).includes(query));
  }, [entries, search]);

  async function saveName() {
    if (!listId || !name.trim()) return;
    setSavingName(true);
    try {
      setList(await renameSpeciesList(listId, name));
    } catch (error) {
      Alert.alert("Namnet kunde inte sparas", messageOf(error));
    } finally {
      setSavingName(false);
    }
  }

  async function removeEntry(entry: SpeciesListEntry) {
    if (!listId) return;
    try {
      await removeSpeciesFromList(listId, entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (error) {
      Alert.alert("Arten kunde inte tas bort", messageOf(error));
    }
  }

  async function removeList() {
    if (!listId || !list) return;
    const confirmed = await confirmDestructive(
      "Radera artlista?",
      `”${list.name}” raderas. Inventeringar som använder den behålls men får ingen vald artlista. Observationer påverkas inte.`,
    );
    if (!confirmed) return;
    try {
      await deleteSpeciesList(listId);
      dismissToSpeciesLists(router);
    } catch (error) {
      Alert.alert("Artlistan kunde inte raderas", messageOf(error));
    }
  }

  if (loading && !list) {
    return <Screen scroll={false} contentContainerStyle={styles.center}><ActivityIndicator color={colors.green700} size="large" /></Screen>;
  }
  if (!list) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: list.name }} />
      <Card>
        <Field label="Listans namn" value={name} onChangeText={setName} />
        <Button label="Spara namn" variant="secondary" loading={savingName} disabled={!name.trim() || name.trim() === list.name} onPress={() => void saveName()} />
        <Text style={styles.meta}>{entries.length} {entries.length === 1 ? "art" : "arter"} · {list.taxonomyRef.name}</Text>
      </Card>
      <Button label="Lägg till arter" onPress={() => router.push({ pathname: "/species-lists/[listId]/add", params: { listId } } as unknown as Href)} />
      <Field label="Sök i listan" value={search} onChangeText={setSearch} placeholder="Svenskt eller vetenskapligt namn" />
      <View style={styles.entries}>
        {filtered.length ? filtered.map((entry) => (
          <Card key={entry.id}>
            <View style={styles.row}>
              <View style={styles.body}>
                <Text style={styles.species}>{entry.species.preferredName ?? entry.species.enteredName}</Text>
                {entry.species.scientificName ? <Text style={styles.scientific}>{entry.species.scientificName}</Text> : <Text style={styles.freeText}>Fritext</Text>}
              </View>
              <Button label="Ta bort" variant="ghost" onPress={() => void removeEntry(entry)} />
            </View>
          </Card>
        )) : <EmptyState title="Inga arter" body={search ? "Ingen art matchar sökningen." : "Lägg till arter från taxonomin eller som fritext."} />}
      </View>
      <Button label="Radera artlista" variant="danger" onPress={() => void removeList()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  meta: { color: colors.textMuted, marginTop: spacing.sm },
  entries: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  body: { flex: 1 },
  species: { color: colors.text, fontWeight: "700" },
  scientific: { color: colors.textMuted, fontStyle: "italic", marginTop: 2 },
  freeText: { color: colors.green800, fontSize: 12, marginTop: 2 },
});
