import * as DocumentPicker from "expo-document-picker";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { SurveyListItem } from "@/domain/models";
import { readJsonFile } from "@/export/files";
import { listSurveys, restoreSurveyBackup } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ConnectionBadge } from "@/ui/ConnectionBadge";
import { EmptyState } from "@/ui/EmptyState";
import { Field } from "@/ui/Field";
import { colors, spacing } from "@/ui/theme";

export default function SurveyListScreen() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSurveys(await listSurveys(search));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function restoreBackup() {
    setRestoring(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error("Ingen backupfil valdes.");
      const value = await readJsonFile(asset.uri);
      const surveyId = await restoreSurveyBackup(value);
      await load();
      router.push({ pathname: "/surveys/[surveyId]", params: { surveyId } });
    } catch (error) {
      Alert.alert("Backupen kunde inte återställas", messageOf(error));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Inventeringar" }} />
      <FlatList
        data={surveys}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ConnectionBadge />
            <Field
              label="Sök inventeringar"
              value={search}
              onChangeText={setSearch}
              placeholder="Titel, län, kommun eller område"
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.green700} />
          ) : (
            <EmptyState
              title={search ? "Inga träffar" : "Ingen inventering ännu"}
              body={search ? "Prova ett annat sökord." : "Tryck på plusknappen för att börja."}
            />
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({ pathname: "/surveys/[surveyId]", params: { surveyId: item.id } })
            }
            accessibilityLabel={`${item.title}, ${item.observationCount} observationer`}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.observationCount} {item.observationCount === 1 ? "observation" : "observationer"}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.region.municipalityName ?? item.region.countyName} · {item.surveyDate}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              label="Återställ JSON-backup"
              variant="secondary"
              loading={restoring}
              onPress={() => void restoreBackup()}
            />
          </View>
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skapa ny inventering"
        onPress={() => router.push("/surveys/new")}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  separator: { height: spacing.sm },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  cardMeta: { marginTop: spacing.xs, color: colors.textMuted },
  chevron: { fontSize: 34, color: colors.textMuted },
  footer: { marginTop: spacing.xl },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green700,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabPressed: { opacity: 0.75 },
  fabText: { color: "#fff", fontSize: 32, lineHeight: 36 },
});
