import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { findRegion, type RegionOption } from "@/data/regions";
import type { Region, SurveyDraft } from "@/domain/models";
import { hasErrors, validateSurveyDraft, type ValidationErrors } from "@/domain/validation";
import { RegionPicker } from "@/features/regions/RegionPicker";
import { dismissToSurvey } from "@/navigation/hierarchy";
import {
  getSurvey,
  loadDraft,
  saveDraft,
  surveyEditDraftKey,
  updateSurvey,
} from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function EditSurveyScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<SurveyDraft>();
  const [selectedRegion, setSelectedRegion] = useState<RegionOption>();
  const [errors, setErrors] = useState<ValidationErrors<SurveyDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    Promise.all([getSurvey(surveyId), loadDraft<SurveyDraft>(surveyEditDraftKey(surveyId))])
      .then(([survey, stored]) => {
        if (!survey) throw new Error("Inventeringen kunde inte hittas.");
        const initial =
          stored ??
          ({
            title: survey.title,
            description: survey.description ?? "",
            surveyDate: survey.surveyDate,
            countyCode: survey.region.countyCode,
            municipalityCode: survey.region.municipalityCode ?? "",
            regionFreeText: survey.region.freeText ?? "",
          } satisfies SurveyDraft);
        setDraft(initial);
        setSelectedRegion(findRegion(initial.countyCode, initial.municipalityCode || undefined));
      })
      .catch((error) => Alert.alert("Kunde inte öppna inventeringen", messageOf(error)))
      .finally(() => setHydrated(true));
  }, [surveyId]);

  useEffect(() => {
    if (!hydrated || !surveyId || !draft) return;
    const timeout = setTimeout(
      () => void saveDraft(surveyEditDraftKey(surveyId), draft),
      300,
    );
    return () => clearTimeout(timeout);
  }, [draft, hydrated, surveyId]);

  const canSave = useMemo(
    () => Boolean(draft && selectedRegion && hydrated && !saving),
    [draft, hydrated, saving, selectedRegion],
  );

  function update<K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function chooseRegion(option: RegionOption) {
    setSelectedRegion(option);
    setDraft((current) =>
      current
        ? {
            ...current,
            countyCode: option.countyCode,
            municipalityCode: option.municipalityCode ?? "",
          }
        : current,
    );
    setErrors((current) => ({ ...current, countyCode: undefined }));
  }

  async function save() {
    if (!surveyId || !draft || !selectedRegion) return;
    const nextErrors = validateSurveyDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    setSaving(true);
    try {
      const region: Region = {
        countyCode: selectedRegion.countyCode,
        countyName: selectedRegion.countyName,
        municipalityCode: selectedRegion.municipalityCode,
        municipalityName: selectedRegion.municipalityName,
        freeText: draft.regionFreeText.trim() || undefined,
        source: "SCB",
        sourceVersion: "2026",
      };
      await updateSurvey(surveyId, draft, region);
      dismissToSurvey(router, surveyId);
    } catch (error) {
      Alert.alert("Inventeringen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.green700} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Redigera inventering" }} />
      <Field
        label="Titel"
        value={draft.title}
        onChangeText={(value) => update("title", value)}
        placeholder="Till exempel Ängsmark vid Lillåsen"
        error={errors.title}
        autoFocus
      />
      <Field
        label="Beskrivning (valfri)"
        value={draft.description}
        onChangeText={(value) => update("description", value)}
        placeholder="Syfte eller avgränsning"
        multiline
      />
      <Field
        label="Inventeringsdatum"
        value={draft.surveyDate}
        onChangeText={(value) => update("surveyDate", value)}
        placeholder="ÅÅÅÅ-MM-DD"
        keyboardType="numbers-and-punctuation"
        error={errors.surveyDate}
      />
      <RegionPicker value={selectedRegion} onChange={chooseRegion} error={errors.countyCode} />
      <Field
        label="Närmare område (valfritt)"
        value={draft.regionFreeText}
        onChangeText={(value) => update("regionFreeText", value)}
        placeholder="Till exempel Lillåsen, norra delen"
      />
      <Card>
        <Text style={styles.cardTitle}>Taxonomi</Text>
        <Text style={styles.cardValue}>Kärlväxter – offline-startlista</Text>
        <Text style={styles.cardBody}>
          Taxonomireferensen behålls när inventeringen redigeras.
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button
          label="Spara ändringar"
          onPress={() => void save()}
          loading={saving}
          disabled={!canSave}
        />
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cardValue: { color: colors.green800, fontSize: 16, marginTop: spacing.xs },
  cardBody: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm },
  actions: { gap: spacing.sm },
});
