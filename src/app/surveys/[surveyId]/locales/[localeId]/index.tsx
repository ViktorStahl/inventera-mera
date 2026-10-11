import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { Observation, Survey, SurveyLocale } from "@/domain/models";
import { localDateFromIso, localTimeFromIso } from "@/domain/time";
import { localeDeviationLabel } from "@/features/observations/localeDeviation";
import { getLocale, getSurvey, listLocaleObservations } from "@/storage/database";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function LocaleDetailScreen() {
  const { surveyId, localeId } = useLocalSearchParams<{ surveyId: string; localeId: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey>();
  const [locale, setLocale] = useState<SurveyLocale>();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!surveyId || !localeId) return;
    setLoading(true);
    try {
      const [loadedSurvey, loadedLocale, loadedObservations] = await Promise.all([
        getSurvey(surveyId),
        getLocale(surveyId, localeId),
        listLocaleObservations(localeId),
      ]);
      if (!loadedSurvey) throw new Error("Inventeringen kunde inte hittas.");
      if (!loadedLocale) throw new Error("Lokalen kunde inte hittas.");
      setSurvey(loadedSurvey);
      setLocale(loadedLocale);
      setObservations(loadedObservations);
    } catch (error) {
      Alert.alert("Kunde inte öppna lokalen", messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [localeId, surveyId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (loading && !locale) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.green700} size="large" />
      </Screen>
    );
  }
  if (!survey || !locale) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: locale.name }} />
      <Card>
        <View style={styles.headingRow}>
          <View style={styles.headingBody}>
            <Text style={styles.title}>{locale.name}</Text>
            <Text style={styles.meta}>▣ {localDateFromIso(locale.observedAt)} {localTimeFromIso(locale.observedAt)}</Text>
            <Text style={styles.meta}>⌖ RT90 2,5 gon V</Text>
            <Text style={styles.meta}>
              Nord {Math.round(locale.position.rt90.northing)} · Öst {Math.round(locale.position.rt90.easting)}
            </Text>
          </View>
          {survey.status === "active" ? (
            <Button label="Redigera" variant="ghost" onPress={() => router.push({ pathname: "/surveys/[surveyId]/locales/[localeId]/edit", params: { surveyId, localeId } })} />
          ) : null}
        </View>
        {locale.note ? <Text style={styles.note}>{locale.note}</Text> : null}
      </Card>
      <View style={styles.tabs} accessibilityRole="tablist">
        <View style={[styles.tab, styles.activeTab]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={styles.activeTabText}>Observationer ({observations.length})</Text>
        </View>
        <Pressable
          accessibilityRole="tab"
          onPress={() => router.push({
            pathname: "/surveys/[surveyId]/map",
            params: { surveyId, localeId },
          })}
          style={styles.tab}
        >
          <Text style={styles.tabText}>Karta</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {observations.length === 0 ? (
          <EmptyState title="Inga observationer" body={survey.status === "active" ? "Lägg till den första observationen i lokalen." : "Inga observationer i lokalen."} />
        ) : (
          observations.map((observation) => {
            const deviation = localeDeviationLabel(locale, observation);
            return (
              <Card
                key={observation.id}
                onPress={() => router.push({
                  pathname: "/surveys/[surveyId]/observations/[observationId]",
                  params: { surveyId, observationId: observation.id },
                })}
                accessibilityLabel={`${survey.status === "active" ? "Redigera" : "Visa"} ${observation.species.preferredName ?? observation.species.enteredName}`}
              >
                <View style={styles.observationRow}>
                  <Text style={styles.time}>{localTimeFromIso(observation.observedAt)}</Text>
                  <View style={styles.observationBody}>
                    <Text style={styles.species}>{observation.species.preferredName ?? observation.species.enteredName}</Text>
                    {observation.species.scientificName ? <Text style={styles.scientific}>{observation.species.scientificName}</Text> : <Text style={styles.freeText}>Fritext</Text>}
                    {deviation ? (
                      <Text style={styles.override}>Avviker från lokalens {deviation}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.amount}>{observation.amount ? `${observation.amount.value} ${observation.amount.unit}` : "–"}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card>
            );
          })
        )}
      </View>
      {survey.status === "active" ? <Button
        label="Lägg till observation"
        onPress={() => router.push({
          pathname: "/surveys/[surveyId]/locales/[localeId]/observations/new",
          params: { surveyId, localeId },
        })}
      /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headingBody: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  note: { color: colors.text, lineHeight: 20, marginTop: spacing.md },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  activeTab: { borderBottomWidth: 3, borderColor: colors.green700 },
  tabText: { color: colors.textMuted, fontWeight: "600" },
  activeTabText: { color: colors.green800, fontWeight: "700" },
  list: { gap: spacing.sm },
  observationRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  time: { color: colors.textMuted, width: 44 },
  observationBody: { flex: 1 },
  species: { color: colors.text, fontWeight: "700", fontSize: 16 },
  scientific: { color: colors.textMuted, fontStyle: "italic", marginTop: 2 },
  freeText: { color: colors.green800, fontSize: 12, marginTop: 2 },
  override: { color: colors.warning, fontSize: 12, marginTop: spacing.xs },
  amount: { color: colors.text, maxWidth: 90 },
  chevron: { color: colors.textMuted, fontSize: 28 },
});
