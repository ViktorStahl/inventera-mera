import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { filterMapObservations, listSpeciesFilterOptions } from "@/domain/mapFilters";
import type { LocaleListItem, Observation, Survey } from "@/domain/models";
import { ObservationMap } from "@/features/map/ObservationMap";
import { dismissToSurvey } from "@/navigation/hierarchy";
import { getSurvey, listLocales, listObservations } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function SurveyMapScreen() {
  const { surveyId, localeId } = useLocalSearchParams<{ surveyId: string; localeId?: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey>();
  const [locales, setLocales] = useState<LocaleListItem[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selectedLocaleIds, setSelectedLocaleIds] = useState<string[]>(localeId ? [localeId] : []);
  const [selectedSpeciesKeys, setSelectedSpeciesKeys] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(Boolean(localeId));
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!surveyId) return;
      setLoading(true);
      Promise.all([getSurvey(surveyId), listLocales(surveyId), listObservations(surveyId)])
        .then(([loadedSurvey, loadedLocales, loadedObservations]) => {
          if (!loadedSurvey) throw new Error("Inventeringen kunde inte hittas.");
          setSurvey(loadedSurvey);
          setLocales(loadedLocales);
          setObservations(loadedObservations);
        })
        .catch((error) => Alert.alert("Kartan kunde inte öppnas", messageOf(error)))
        .finally(() => setLoading(false));
    }, [surveyId]),
  );

  const speciesOptions = useMemo(() => listSpeciesFilterOptions(observations), [observations]);
  const filtered = useMemo(
    () => filterMapObservations(observations, {
      localeIds: selectedLocaleIds,
      speciesKeys: selectedSpeciesKeys,
      date: date.trim() || undefined,
    }),
    [date, observations, selectedLocaleIds, selectedSpeciesKeys],
  );
  const activeFilterCount = selectedLocaleIds.length + selectedSpeciesKeys.length + (date.trim() ? 1 : 0);

  function toggle(items: string[], value: string, setItems: (items: string[]) => void) {
    setItems(items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  }

  function clearFilters() {
    setSelectedLocaleIds([]);
    setSelectedSpeciesKeys([]);
    setDate("");
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
    <Screen scroll={false} contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: "Karta" }} />
      <View style={styles.tabs} accessibilityRole="tablist">
        <Button label={`Lokaler (${locales.length})`} variant="ghost" onPress={() => dismissToSurvey(router, surveyId)} />
        <View style={styles.activeTab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={styles.activeTabText}>Karta</Text>
        </View>
      </View>
      <View style={styles.filterHeader}>
        <Button
          label={`Filter${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
          variant="secondary"
          onPress={() => setFiltersOpen(true)}
        />
        {activeFilterCount ? <Button label="Rensa" variant="ghost" onPress={clearFilters} /> : null}
      </View>
      <ObservationMap
        observations={filtered}
        fillAvailableSpace
        showObservationList={false}
      />
      <Card>
        <Text style={styles.summaryTitle}>Visar {filtered.length} av {observations.length} observationer</Text>
        <Text style={styles.summaryText}>{new Set(filtered.map((observation) => observation.localeId)).size} lokaler · {new Set(filtered.map((observation) => observation.species.enteredName.toLocaleLowerCase("sv"))).size} arter</Text>
      </Card>
      <Modal
        visible={filtersOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <SafeAreaView style={styles.filterModal}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalTitle}>Filtrera karta</Text>
            <Button label="Klar" variant="ghost" onPress={() => setFiltersOpen(false)} />
          </View>
          <ScrollView
            style={styles.filterModalScroll}
            contentContainerStyle={styles.filterModalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.filterTitle}>Lokaler</Text>
            <View style={styles.chips}>
              {locales.map((locale) => {
                const selected = selectedLocaleIds.includes(locale.id);
                return (
                  <Pressable
                    key={locale.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggle(selectedLocaleIds, locale.id, setSelectedLocaleIds)}
                    style={[styles.chip, selected && styles.selectedChip]}
                  >
                    <Text style={[styles.chipText, selected && styles.selectedChipText]}>{locale.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.filterTitle}>Arter</Text>
            <View style={styles.chips}>
              {speciesOptions.length ? speciesOptions.map((species) => {
                const selected = selectedSpeciesKeys.includes(species.key);
                return (
                  <Pressable
                    key={species.key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggle(selectedSpeciesKeys, species.key, setSelectedSpeciesKeys)}
                    style={[styles.chip, selected && styles.selectedChip]}
                  >
                    <Text style={[styles.chipText, selected && styles.selectedChipText]}>{species.name} ({species.count})</Text>
                  </Pressable>
                );
              }) : <Text style={styles.emptyFilter}>Inga arter att filtrera.</Text>}
            </View>
            <Field
              label="Datum (valfritt)"
              value={date}
              onChangeText={setDate}
              placeholder="ÅÅÅÅ-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.filterHint}>Val inom samma grupp kombineras med eller. Lokal, art och datum kombineras med och.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  screen: { padding: spacing.lg, gap: spacing.md },
  tabs: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border },
  activeTab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderColor: colors.green700 },
  activeTabText: { color: colors.green800, fontWeight: "700" },
  filterHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  filterModal: { flex: 1, backgroundColor: colors.background },
  filterModalHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterModalTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  filterModalScroll: { flex: 1 },
  filterModalContent: { padding: spacing.lg, paddingBottom: 96 },
  filterTitle: { color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  selectedChip: { backgroundColor: colors.green700, borderColor: colors.green700 },
  chipText: { color: colors.text },
  selectedChipText: { color: "#FFFFFF", fontWeight: "700" },
  emptyFilter: { color: colors.textMuted },
  filterHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  summaryTitle: { color: colors.text, fontWeight: "700" },
  summaryText: { color: colors.textMuted, marginTop: spacing.xs },
});
