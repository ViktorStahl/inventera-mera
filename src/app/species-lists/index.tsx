import { Stack, useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";

import type { SpeciesListSummary } from "@/domain/models";
import { listSpeciesLists } from "@/storage/database";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { Field } from "@/ui/Field";
import { colors, spacing } from "@/ui/theme";

export default function SpeciesListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState<SpeciesListSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await listSpeciesLists(search));
    } catch (error) {
      Alert.alert("Artlistor kunde inte läsas", messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Artlistor" }} />
      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Field label="Sök artlistor" value={search} onChangeText={setSearch} placeholder="Namn" />
            <Button label="Skapa artlista" onPress={() => router.push("/species-lists/new" as Href)} />
          </View>
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.green700} /> : (
            <EmptyState title={search ? "Inga träffar" : "Inga artlistor"} body={search ? "Prova ett annat namn." : "Skapa en tom lista och fyll den med arter."} />
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => router.push({ pathname: "/species-lists/[listId]", params: { listId: item.id } } as unknown as Href)}
            accessibilityLabel={`${item.name}, ${item.speciesCount} arter`}
          >
            <View style={styles.row}>
              <View style={styles.body}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.meta}>{item.speciesCount} {item.speciesCount === 1 ? "art" : "arter"}</Text>
                <Text style={styles.meta}>Uppdaterad {item.updatedAt.slice(0, 10)}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: spacing.lg, paddingBottom: 96 },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  separator: { height: spacing.sm },
  row: { flexDirection: "row", alignItems: "center" },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  chevron: { color: colors.textMuted, fontSize: 30 },
});
