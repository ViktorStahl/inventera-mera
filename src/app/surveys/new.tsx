import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { findRegion, type RegionOption } from "@/data/regions";
import type { Region, SurveyDraft } from "@/domain/models";
import { todayLocal } from "@/domain/time";
import { hasErrors, validateSurveyDraft, type ValidationErrors } from "@/domain/validation";
import { RegionPicker } from "@/features/regions/RegionPicker";
import { dismissToSurvey } from "@/navigation/hierarchy";
import { createSurvey, loadDraft, saveDraft } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

const EMPTY_DRAFT: SurveyDraft = {
  title: "",
  description: "",
  surveyDate: todayLocal(),
  countyCode: "",
  municipalityCode: "",
  regionFreeText: "",
};

export default function NewSurveyScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<SurveyDraft>(EMPTY_DRAFT);
  const [selectedRegion, setSelectedRegion] = useState<RegionOption>();
  const [errors, setErrors] = useState<ValidationErrors<SurveyDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDraft<SurveyDraft>("survey:new")
      .then((stored) => {
        if (stored) {
          setDraft(stored);
          setSelectedRegion(findRegion(stored.countyCode, stored.municipalityCode || undefined));
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => void saveDraft("survey:new", draft), 300);
    return () => clearTimeout(timeout);
  }, [draft, hydrated]);

  const canSave = useMemo(() => !saving && hydrated, [hydrated, saving]);

  function update<K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function chooseRegion(option: RegionOption) {
    setSelectedRegion(option);
    setDraft((current) => ({
      ...current,
      countyCode: option.countyCode,
      municipalityCode: option.municipalityCode ?? "",
    }));
    setErrors((current) => ({ ...current, countyCode: undefined }));
  }

  async function save() {
    const nextErrors = validateSurveyDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors) || !selectedRegion) return;
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
      const survey = await createSurvey(draft, region);
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
          MVP:n innehåller en liten lokal startlista och tillåter alltid fritext. Det fullständiga
          Dyntaxa-paketet kan anslutas utan att ändra observationerna.
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button label="Spara inventering" onPress={() => void save()} loading={saving} disabled={!canSave} />
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cardValue: { color: colors.green800, fontSize: 16, marginTop: spacing.xs },
  cardBody: { color: colors.textMuted, lineHeight: 20, marginTop: spacing.sm },
  actions: { gap: spacing.sm },
});
