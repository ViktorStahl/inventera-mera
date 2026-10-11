import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { LocaleListItem, SpeciesList, Survey } from "@/domain/models";
import { localDateFromIso, localTimeFromIso } from "@/domain/time";
import { shareSurveyBackup, shareSurveyExcel, shareSurveyGpx } from "@/export/files";
import { dismissToSurveyList } from "@/navigation/hierarchy";
import { archiveSurvey, buildSurveyBackup, deleteSurvey, getSpeciesList, getSurvey, listLocales, restoreSurvey } from "@/storage/database";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { confirmDestructive } from "@/ui/confirm";
import { ConnectionBadge } from "@/ui/ConnectionBadge";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function SurveyDetailScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey>();
  const [speciesList, setSpeciesList] = useState<SpeciesList>();
  const [locales, setLocales] = useState<LocaleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [exporting, setExporting] = useState<"excel" | "gpx" | "json">();
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    try {
      const [loadedSurvey, loadedLocales] = await Promise.all([
        getSurvey(surveyId),
        listLocales(surveyId),
      ]);
      if (!loadedSurvey) throw new Error("Inventeringen kunde inte hittas.");
      setSurvey(loadedSurvey);
      setSpeciesList(loadedSurvey.speciesListId
        ? ((await getSpeciesList(loadedSurvey.speciesListId)) ?? undefined)
        : undefined);
      setLocales(loadedLocales);
    } catch (error) {
      Alert.alert("Kunde inte öppna inventeringen", messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useFocusEffect(useCallback(() => void load(), [load]));

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

  async function exportGpx() {
    if (!surveyId) return;
    setExporting("gpx");
    try {
      await shareSurveyGpx(surveyId);
    } catch (error) {
      Alert.alert("GPX-export", messageOf(error));
    } finally {
      setExporting(undefined);
    }
  }

  async function archiveCurrentSurvey() {
    if (!surveyId) return;
    setUpdatingStatus(true);
    try {
      setSurvey(await archiveSurvey(surveyId));
    } catch (error) {
      Alert.alert("Inventeringen kunde inte arkiveras", messageOf(error));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function restoreArchivedSurvey() {
    if (!surveyId) return;
    setUpdatingStatus(true);
    try {
      setSurvey(await restoreSurvey(surveyId));
    } catch (error) {
      Alert.alert("Inventeringen kunde inte återställas", messageOf(error));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function removeSurvey() {
    if (!surveyId || !survey || survey.status !== "archived") return;
    const observationCount = locales.reduce((sum, locale) => sum + locale.observationCount, 0);
    const confirmed = await confirmDestructive(
      "Radera inventering?",
      `”${survey.title}”, dess ${locales.length} lokaler och ${observationCount} observationer raderas permanent från den här enheten. Åtgärden kan inte ångras.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteSurvey(surveyId);
      dismissToSurveyList(router);
    } catch (error) {
      Alert.alert("Inventeringen kunde inte raderas", messageOf(error));
      setDeleting(false);
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
      {survey.status === "archived" ? (
        <Card style={styles.archivedBanner}>
          <Text style={styles.archivedTitle}>Inventeringen är arkiverad</Text>
          <Text style={styles.description}>Innehållet är skrivskyddat. Lokaler och observationer kan bara visas och exporteras.</Text>
          <Button label="Återställ inventering" variant="secondary" loading={updatingStatus} disabled={deleting} onPress={() => void restoreArchivedSurvey()} />
          <Button label="Radera inventering" variant="danger" loading={deleting} disabled={updatingStatus || Boolean(exporting)} onPress={() => void removeSurvey()} />
        </Card>
      ) : null}
      <ConnectionBadge />
      <Card>
        <Text style={styles.surveyTitle}>{survey.title}</Text>
        {survey.description ? <Text style={styles.description}>{survey.description}</Text> : null}
        <Text style={styles.meta}>▣ {survey.surveyDate}</Text>
        <Text style={styles.meta}>♧ {survey.taxonomyRef?.name ?? "Fritext"}</Text>
        <Text style={styles.meta}>☷ Artlista: {speciesList?.name ?? "Ingen"}</Text>
      </Card>
      <View style={styles.tabs} accessibilityRole="tablist">
        <View style={[styles.tab, styles.activeTab]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={styles.activeTabText}>Lokaler ({locales.length})</Text>
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
        {locales.length === 0 ? (
          <EmptyState title="Inga lokaler" body={survey.status === "active" ? "Lägg till den första lokalen i inventeringen." : "Inga lokaler i den här inventeringen."} />
        ) : (
          locales.map((locale) => (
            <Card
              key={locale.id}
              onPress={() => router.push({
                pathname: "/surveys/[surveyId]/locales/[localeId]",
                params: { surveyId, localeId: locale.id },
              })}
              accessibilityLabel={`${locale.name}, ${locale.observationCount} observationer`}
            >
              <View style={styles.localeRow}>
                <View style={styles.localeBody}>
                  <Text style={styles.localeName}>{locale.name}</Text>
                  <Text style={styles.localeMeta}>
                    {locale.observationCount} {locale.observationCount === 1 ? "observation" : "observationer"}
                  </Text>
                </View>
                <View style={styles.localeDate}>
                  <Text style={styles.localeMeta}>{localDateFromIso(locale.observedAt)}</Text>
                  <Text style={styles.localeMeta}>{localTimeFromIso(locale.observedAt)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Card>
          ))
        )}
      </View>
      {survey.status === "active" ? (
        <Button
        label="Lägg till lokal"
        onPress={() => router.push({ pathname: "/surveys/[surveyId]/locales/new", params: { surveyId } })}
        />
      ) : null}
      {survey.status === "active" ? <View style={styles.manageSection}>
        <Text style={styles.sectionTitle}>Hantera inventering</Text>
        <Button label="Redigera inventering" variant="secondary" disabled={deleting || updatingStatus} onPress={() => router.push({ pathname: "/surveys/[surveyId]/edit", params: { surveyId } })} />
        <Button label="Arkivera inventering" variant="secondary" loading={updatingStatus} disabled={deleting || Boolean(exporting)} onPress={() => void archiveCurrentSurvey()} />
      </View> : null}
      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>Export och backup</Text>
        <Button label="Exportera till Excel" variant="secondary" loading={exporting === "excel"} disabled={Boolean(exporting)} onPress={() => void exportExcel()} />
        <Button label="Exportera som GPX" variant="secondary" loading={exporting === "gpx"} disabled={Boolean(exporting)} onPress={() => void exportGpx()} />
        <Button label="Skapa JSON-backup" variant="secondary" loading={exporting === "json"} disabled={Boolean(exporting)} onPress={() => void exportJson()} />
      </View>
    </Screen>
  );
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
  localeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  localeBody: { flex: 1 },
  localeName: { color: colors.text, fontWeight: "700", fontSize: 16 },
  localeMeta: { color: colors.textMuted, marginTop: 3 },
  localeDate: { alignItems: "flex-end" },
  chevron: { color: colors.textMuted, fontSize: 28 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  archivedBanner: { backgroundColor: "#FFF7E2", borderColor: colors.warning, gap: spacing.sm },
  archivedTitle: { color: colors.warning, fontSize: 17, fontWeight: "700" },
  manageSection: { gap: spacing.sm, marginTop: spacing.md },
  exportSection: { gap: spacing.sm },
});
