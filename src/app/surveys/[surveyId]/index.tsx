import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { Observation, Survey } from "@/domain/models";
import { localTimeFromIso } from "@/domain/time";
import { shareSurveyBackup, shareSurveyExcel } from "@/export/files";
import { buildSurveyBackup, getSurvey, listObservations } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ConnectionBadge } from "@/ui/ConnectionBadge";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function SurveyDetailScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey>();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"excel" | "json">();

  const load = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    try {
      const [loadedSurvey, loadedObservations] = await Promise.all([
        getSurvey(surveyId),
        listObservations(surveyId),
      ]);
      if (!loadedSurvey) throw new Error("Inventeringen kunde inte hittas.");
      setSurvey(loadedSurvey);
      setObservations(loadedObservations);
    } catch (error) {
      Alert.alert("Kunde inte öppna inventeringen", messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function exportExcel() {
    if (!surveyId) return;
    setExporting("excel");
    try {
      await shareSurveyExcel(surveyId);
    } catch (error) {
      Alert.alert("Excel-export", messageOf(error));
    } finally {
      setExporting(undefined);
    }
  }

  async function exportJson() {
    if (!surveyId) return;
    setExporting("json");
    try {
      await shareSurveyBackup(await buildSurveyBackup(surveyId));
    } catch (error) {
      Alert.alert("JSON-backup", messageOf(error));
    } finally {
      setExporting(undefined);
    }
  }

  if (loading && !survey) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.green700} size="large" />
      </Screen>
    );
  }
  if (!survey) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: survey.title }} />
      <ConnectionBadge />
      <Card>
        <Text style={styles.surveyTitle}>{survey.title}</Text>
        {survey.description ? <Text style={styles.description}>{survey.description}</Text> : null}
        <Text style={styles.meta}>▣ {survey.surveyDate}</Text>
        <Text style={styles.meta}>
          ⌖ {survey.region.municipalityName ?? survey.region.countyName}
          {survey.region.freeText ? ` · ${survey.region.freeText}` : ""}
        </Text>
        <Text style={styles.meta}>♧ {survey.taxonomyRef?.name ?? "Fritext"}</Text>
      </Card>
      <View style={styles.tabs} accessibilityRole="tablist">
        <View style={[styles.tab, styles.activeTab]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={styles.activeTabText}>Observationer ({observations.length})</Text>
        </View>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: false }}
          onPress={() => router.push({ pathname: "/surveys/[surveyId]/map", params: { surveyId } })}
          style={styles.tab}
        >
          <Text style={styles.tabText}>Karta</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {observations.length === 0 ? (
          <EmptyState title="Inga observationer" body="Lägg till den första observationen i inventeringen." />
        ) : (
          observations.map((observation) => (
            <Card key={observation.id}>
              <View style={styles.observationRow}>
                <Text style={styles.time}>{localTimeFromIso(observation.observedAt)}</Text>
                <View style={styles.observationBody}>
                  <Text style={styles.species}>
                    {observation.species.preferredName ?? observation.species.enteredName}
                  </Text>
                  {observation.species.scientificName ? (
                    <Text style={styles.scientific}>{observation.species.scientificName}</Text>
                  ) : (
                    <Text style={styles.freeText}>Fritext</Text>
                  )}
                  <Text style={styles.locality}>{observation.localityName}</Text>
                </View>
                <Text style={styles.amount}>
                  {observation.amount ? `${observation.amount.value} ${observation.amount.unit}` : "–"}
                </Text>
              </View>
              {observation.publicComment ? (
                <Text style={styles.comment}>{observation.publicComment}</Text>
              ) : null}
            </Card>
          ))
        )}
      </View>
      <Button
        label="Lägg till observation"
        onPress={() =>
          router.push({
            pathname: "/surveys/[surveyId]/observations/new",
            params: { surveyId },
          })
        }
      />
      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>Export och backup</Text>
        <Button
          label="Exportera till Excel"
          variant="secondary"
          loading={exporting === "excel"}
          disabled={Boolean(exporting)}
          onPress={() => void exportExcel()}
        />
        <Button
          label="Skapa JSON-backup"
          variant="secondary"
          loading={exporting === "json"}
          disabled={Boolean(exporting)}
          onPress={() => void exportJson()}
        />
      </View>
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  surveyTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  description: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
  meta: { color: colors.text, marginTop: spacing.xs },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  activeTab: { borderBottomWidth: 3, borderColor: colors.green700 },
  tabText: { color: colors.textMuted, fontWeight: "600" },
  activeTabText: { color: colors.green800, fontWeight: "700" },
  list: { gap: spacing.sm },
  observationRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  time: { color: colors.textMuted, width: 44 },
  observationBody: { flex: 1 },
  species: { color: colors.text, fontWeight: "700", fontSize: 16 },
  scientific: { color: colors.textMuted, fontStyle: "italic", marginTop: 2 },
  freeText: { color: colors.green800, fontSize: 12, marginTop: 2 },
  locality: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  amount: { color: colors.text, textAlign: "right", maxWidth: 86 },
  comment: { color: colors.textMuted, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  exportSection: { gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
});
