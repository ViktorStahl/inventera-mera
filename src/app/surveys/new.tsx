import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import type { SurveyDraft } from "@/domain/models";
import { todayLocal } from "@/domain/time";
import { hasErrors, validateSurveyDraft, type ValidationErrors } from "@/domain/validation";
import { SurveyFields } from "@/features/surveys/SurveyFields";
import { dismissToSurvey } from "@/navigation/hierarchy";
import { createSurvey, getAppSettings, loadDraft } from "@/storage/database";
import { useDraftAutosave } from "@/storage/useDraftAutosave";
import { Button } from "@/ui/Button";
import { messageOf } from "@/ui/errors";
import { Screen } from "@/ui/Screen";
import { spacing } from "@/ui/theme";

const EMPTY_DRAFT: SurveyDraft = {
  title: "",
  description: "",
  surveyDate: todayLocal(),
  taxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId,
  speciesListId: "",
};

export default function NewSurveyScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<SurveyDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ValidationErrors<SurveyDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadDraft<Partial<SurveyDraft>>("survey:new"), getAppSettings()])
      .then(([stored, settings]) => {
        const initial = {
          ...EMPTY_DRAFT,
          taxonomyPackageId: settings.defaultTaxonomyPackageId,
          ...stored,
        };
        setDraft(initial);
      })
      .finally(() => setHydrated(true));
  }, []);

  useDraftAutosave("survey:new", draft, hydrated);

  const canSave = !saving && hydrated;

  function update<K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function save() {
    const nextErrors = validateSurveyDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    setSaving(true);
    try {
      const survey = await createSurvey(draft);
      dismissToSurvey(router, survey.id);
    } catch (error) {
      Alert.alert("Inventeringen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ny inventering" }} />
      <SurveyFields draft={draft} errors={errors} onUpdate={update} />
      <View style={styles.actions}>
        <Button label="Spara inventering" onPress={() => void save()} loading={saving} disabled={!canSave} />
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
});
