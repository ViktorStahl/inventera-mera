import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import type { SurveyDraft } from "@/domain/models";
import { hasErrors, validateSurveyDraft, type ValidationErrors } from "@/domain/validation";
import { TaxonomySpeciesListFields } from "@/features/taxonomy/TaxonomySpeciesListFields";
import { dismissToSurvey } from "@/navigation/hierarchy";
import {
  getSurvey,
  loadDraft,
  saveDraft,
  surveyEditDraftKey,
  updateSurvey,
} from "@/storage/database";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function EditSurveyScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<SurveyDraft>();
  const [errors, setErrors] = useState<ValidationErrors<SurveyDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    Promise.all([getSurvey(surveyId), loadDraft<Partial<SurveyDraft>>(surveyEditDraftKey(surveyId))])
      .then(([survey, stored]) => {
        if (!survey) throw new Error("Inventeringen kunde inte hittas.");
        const persisted = {
            title: survey.title,
            description: survey.description ?? "",
            surveyDate: survey.surveyDate,
            taxonomyPackageId: survey.taxonomyRef?.packageId ?? VASCULAR_PLANTS_TAXONOMY.packageId,
            speciesListId: survey.speciesListId ?? "",
          } satisfies SurveyDraft;
        const initial = { ...persisted, ...stored };
        setDraft(initial);
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
    () => Boolean(draft && hydrated && !saving),
    [draft, hydrated, saving],
  );

  function update<K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function save() {
    if (!surveyId || !draft) return;
    const nextErrors = validateSurveyDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    setSaving(true);
    try {
      await updateSurvey(surveyId, draft);
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
      <TaxonomySpeciesListFields
        taxonomyPackageId={draft.taxonomyPackageId}
        speciesListId={draft.speciesListId}
        onTaxonomyChange={(value) => update("taxonomyPackageId", value)}
        onSpeciesListChange={(value) => update("speciesListId", value)}
        taxonomyError={errors.taxonomyPackageId}
      />
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
  actions: { gap: spacing.sm },
});
