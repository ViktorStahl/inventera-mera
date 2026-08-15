import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import type { SurveyDraft } from "@/domain/models";
import { hasErrors, validateSurveyDraft, type ValidationErrors } from "@/domain/validation";
import { SurveyFields } from "@/features/surveys/SurveyFields";
import { dismissToSurvey } from "@/navigation/hierarchy";
import {
  getSurvey,
  loadDraft,
  surveyEditDraftKey,
  updateSurvey,
} from "@/storage/database";
import { useDraftAutosave } from "@/storage/useDraftAutosave";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
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

  useDraftAutosave(surveyId ? surveyEditDraftKey(surveyId) : undefined, draft, hydrated);

  const canSave = Boolean(draft && hydrated && !saving);

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
      <SurveyFields draft={draft} errors={errors} onUpdate={update} />
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

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  actions: { gap: spacing.sm },
});
