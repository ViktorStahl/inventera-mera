import * as DocumentPicker from "expo-document-picker";
import { Stack, useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Switch,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SurveyListItem } from "@/domain/models";
import { readJsonFile } from "@/export/files";
import { listSurveys, restoreSurveyBackup } from "@/storage/database";
import { Button } from "@/ui/Button";
import { useAchievements } from "@/features/achievements/AchievementProvider";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { ConnectionBadge } from "@/ui/ConnectionBadge";
import { EmptyState } from "@/ui/EmptyState";
import { Field } from "@/ui/Field";
import { floatingActionLayout } from "@/ui/floatingActionLayout";
import { colors, spacing } from "@/ui/theme";

export default function SurveyListScreen() {
  const { awards } = useAchievements();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showArchived, setShowArchived] = useState(false);
  const floatingAction = floatingActionLayout(insets);
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSurveys(await listSurveys(search, showArchived));
    } finally {
      setLoading(false);
    }
  }, [search, showArchived]);

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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: floatingAction.contentPaddingBottom },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ConnectionBadge />
            <Field
              label="Sök inventeringar"
              value={search}
              onChangeText={setSearch}
              placeholder="Titel, beskrivning eller lokal"
              returnKeyType="search"
            />
            <View style={styles.archiveToggle}>
              <Text style={styles.archiveToggleLabel}>Visa arkiverade inventeringar</Text>
              <Switch
                accessibilityLabel="Visa arkiverade inventeringar"
                value={showArchived}
                onValueChange={setShowArchived}
                trackColor={{ false: colors.border, true: colors.green700 }}
                thumbColor={colors.surface}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.green700} />
          ) : (
            <EmptyState
              title={search ? "Inga träffar" : showArchived ? "Ingen inventering ännu" : "Inga aktiva inventeringar"}
              body={search ? "Prova ett annat sökord." : showArchived ? "Tryck på plusknappen för att börja." : "Skapa en inventering eller visa arkiverade inventeringar."}
            />
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({ pathname: "/surveys/[surveyId]", params: { surveyId: item.id } })
            }
            accessibilityLabel={`${item.title}${item.status === "archived" ? ", arkiverad" : ""}, ${item.localeCount} lokaler och ${item.observationCount} observationer`}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardText}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.status === "archived" ? (
                    <Text style={styles.archiveBadge}>Arkiverad</Text>
                  ) : null}
                </View>
                <Text style={styles.cardMeta}>
                  {item.localeCount} {item.localeCount === 1 ? "lokal" : "lokaler"} · {item.observationCount} {item.observationCount === 1 ? "observation" : "observationer"}
                </Text>
                <Text style={styles.cardMeta}>{item.surveyDate}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              label="Hantera artlistor"
              variant="secondary"
              onPress={() => router.push("/species-lists" as Href)}
            />
            <Button
              label="Inställningar"
              variant="secondary"
              onPress={() => router.push("/settings" as Href)}
            />
            {awards.length > 0 ? (
              <Button
                label="Statistik"
                variant="secondary"
                onPress={() => router.push("/statistics" as Href)}
              />
            ) : null}
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
        style={({ pressed }) => [
          styles.fab,
          { bottom: floatingAction.bottom, right: floatingAction.right },
          pressed && styles.fabPressed,
        ]}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: spacing.lg,
  },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  archiveToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  archiveToggleLabel: { color: colors.text, fontWeight: "600", flex: 1 },
  separator: { height: spacing.sm },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  archiveBadge: { color: colors.warning, fontSize: 12, fontWeight: "700" },
  cardMeta: { marginTop: spacing.xs, color: colors.textMuted },
  chevron: { fontSize: 34, color: colors.textMuted },
  footer: { marginTop: spacing.xl, gap: spacing.sm },
  fab: {
    position: "absolute",
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
