import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, AppState, StyleSheet, Text, View } from "react-native";

import { rt90ToWgs84, wgs84ToRt90 } from "@/domain/coordinates";
import { defaultLocalityName } from "@/domain/locality";
import type { ObservationDraft } from "@/domain/models";
import { currentTimeZone, localDateTimeWithOffset, timeLocal, todayLocal } from "@/domain/time";
import {
  hasErrors,
  parseAdditionalObservers,
  validateObservationDraft,
  type ValidationErrors,
} from "@/domain/validation";
import { SpeciesPicker } from "@/features/taxonomy/SpeciesPicker";
import {
  createObservation,
  getLastLocalityName,
  getSurvey,
  loadDraft,
  observationDraftKey,
  saveDraft,
} from "@/storage/database";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

function emptyDraft(): ObservationDraft {
  return {
    date: todayLocal(),
    time: timeLocal(),
    localityName: "",
    northing: "",
    easting: "",
    accuracyMeters: "",
    positionSource: "manual-rt90",
    speciesQuery: "",
    amount: "",
    unit: "",
    publicComment: "",
    additionalObservers: "",
  };
}

export default function NewObservationScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<ObservationDraft>(emptyDraft);
  const [errors, setErrors] = useState<ValidationErrors<ObservationDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    Promise.all([
      loadDraft<ObservationDraft>(observationDraftKey(surveyId)),
      getSurvey(surveyId),
      getLastLocalityName(surveyId),
    ])
      .then(([stored, survey, lastLocality]) => {
        if (!survey) throw new Error("Inventeringen kunde inte hittas.");
        if (stored) setDraft(stored);
        else setDraft({ ...emptyDraft(), localityName: defaultLocalityName(lastLocality, survey.title) });
      })
      .catch((error) => Alert.alert("Kunde inte öppna formuläret", messageOf(error)))
      .finally(() => setHydrated(true));
  }, [surveyId]);

  useEffect(() => {
    if (!hydrated || !surveyId) return;
    const timeout = setTimeout(
      () => void saveDraft(observationDraftKey(surveyId), draft),
      300,
    );
    return () => clearTimeout(timeout);
  }, [draft, hydrated, surveyId]);

  useEffect(() => {
    if (!hydrated || !surveyId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void saveDraft(observationDraftKey(surveyId), draft);
    });
    return () => subscription.remove();
  }, [draft, hydrated, surveyId]);

  function update<K extends keyof ObservationDraft>(key: K, value: ObservationDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateManualCoordinate(key: "northing" | "easting", value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      positionSource: "manual-rt90",
      latitude: undefined,
      longitude: undefined,
      accuracyMeters: current.positionSource === "device" ? "" : current.accuracyMeters,
    }));
    setErrors((current) => ({ ...current, northing: undefined, easting: undefined }));
  }

  function useNow() {
    const now = new Date();
    setDraft((current) => ({ ...current, date: todayLocal(now), time: timeLocal(now) }));
  }

  async function captureLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Position nekades",
          "Du kan fortfarande skriva in RT90-koordinater manuellt.",
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const rt90 = wgs84ToRt90({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setDraft((current) => ({
        ...current,
        northing: rt90.northing.toFixed(2),
        easting: rt90.easting.toFixed(2),
        accuracyMeters:
          location.coords.accuracy == null ? "" : location.coords.accuracy.toFixed(1),
        positionSource: "device",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }));
      setErrors((current) => ({
        ...current,
        northing: undefined,
        easting: undefined,
        accuracyMeters: undefined,
      }));
    } catch (error) {
      Alert.alert(
        "Positionen kunde inte hämtas",
        `${messageOf(error)} Du kan skriva in RT90-koordinater manuellt.`,
      );
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!surveyId) return;
    const nextErrors = validateObservationDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    setSaving(true);
    try {
      const rt90 = {
        northing: Number(draft.northing.replace(",", ".")),
        easting: Number(draft.easting.replace(",", ".")),
      };
      const wgs84 =
        draft.positionSource === "device" && draft.latitude != null && draft.longitude != null
          ? { latitude: draft.latitude, longitude: draft.longitude }
          : rt90ToWgs84(rt90);
      const selected = draft.selectedTaxon;
      await createObservation({
        surveyId,
        observedAt: localDateTimeWithOffset(draft.date, draft.time),
        timeZone: currentTimeZone(),
        localityName: draft.localityName.trim(),
        position: {
          wgs84,
          rt90: { ...rt90, crs: "EPSG:3847" },
          accuracyMeters: draft.accuracyMeters.trim()
            ? Number(draft.accuracyMeters.replace(",", "."))
            : undefined,
          source: draft.positionSource,
        },
        species: selected
          ? {
              source: "taxonomy",
              enteredName: draft.speciesQuery.trim(),
              taxonId: selected.id,
              preferredName: selected.preferredName,
              scientificName: selected.scientificName,
              taxonomyPackageId: "vascular-plants-starter",
              taxonomyVersion: "2026-07-mvp",
            }
          : { source: "free-text", enteredName: draft.speciesQuery.trim() },
        amount: draft.amount.trim()
          ? { value: Number(draft.amount.replace(",", ".")), unit: draft.unit.trim() }
          : undefined,
        publicComment: draft.publicComment.trim() || undefined,
        additionalObservers: parseAdditionalObservers(draft.additionalObservers),
      });
      router.replace({ pathname: "/surveys/[surveyId]", params: { surveyId } });
    } catch (error) {
      Alert.alert("Observationen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ny observation" }} />
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Field
            label="Datum"
            value={draft.date}
            onChangeText={(value) => update("date", value)}
            keyboardType="numbers-and-punctuation"
            error={errors.date}
          />
        </View>
        <View style={styles.column}>
          <Field
            label="Tid"
            value={draft.time}
            onChangeText={(value) => update("time", value)}
            keyboardType="numbers-and-punctuation"
            error={errors.time}
          />
        </View>
      </View>
      <Button label="Använd nuvarande tid" variant="secondary" onPress={useNow} />
      <Field
        label="Lokalnamn"
        value={draft.localityName}
        onChangeText={(value) => update("localityName", value)}
        placeholder="Till exempel Lillåsen, norra delen"
        error={errors.localityName}
      />
      <Text style={styles.sectionTitle}>Koordinater · RT90 2,5 gon V</Text>
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Field
            label="Nord (X)"
            value={draft.northing}
            onChangeText={(value) => updateManualCoordinate("northing", value)}
            keyboardType="decimal-pad"
            error={errors.northing}
          />
        </View>
        <View style={styles.column}>
          <Field
            label="Öst (Y)"
            value={draft.easting}
            onChangeText={(value) => updateManualCoordinate("easting", value)}
            keyboardType="decimal-pad"
            error={errors.easting}
          />
        </View>
      </View>
      <Field
        label="Noggrannhet i meter (valfri)"
        value={draft.accuracyMeters}
        onChangeText={(value) => update("accuracyMeters", value)}
        keyboardType="decimal-pad"
        editable={draft.positionSource !== "device"}
        hint={draft.positionSource === "device" ? "Rapporterad av enhetens positionstjänst." : undefined}
        error={errors.accuracyMeters}
      />
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Button label="Min position" variant="secondary" loading={locating} onPress={() => void captureLocation()} />
        </View>
        <View style={styles.column}>
          <Button
            label="Rensa position"
            variant="secondary"
            onPress={() =>
              setDraft((current) => ({
                ...current,
                northing: "",
                easting: "",
                accuracyMeters: "",
                latitude: undefined,
                longitude: undefined,
                positionSource: "manual-rt90",
              }))
            }
          />
        </View>
      </View>
      <SpeciesPicker
        query={draft.speciesQuery}
        selectedTaxon={draft.selectedTaxon}
        onQueryChange={(value) => update("speciesQuery", value)}
        onSelect={(value) => update("selectedTaxon", value)}
        error={errors.speciesQuery}
      />
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Field
            label="Antal (valfritt)"
            value={draft.amount}
            onChangeText={(value) => update("amount", value)}
            keyboardType="decimal-pad"
            error={errors.amount}
          />
        </View>
        <View style={styles.column}>
          <Field
            label="Enhet"
            value={draft.unit}
            onChangeText={(value) => update("unit", value)}
            placeholder="individer"
            error={errors.unit}
          />
        </View>
      </View>
      <Field
        label="Publik kommentar (valfri)"
        value={draft.publicComment}
        onChangeText={(value) => update("publicComment", value)}
        multiline
        placeholder="Kommentaren följer med i Excel-exporten"
      />
      <Field
        label="Med-observatör (valfri)"
        value={draft.additionalObservers}
        onChangeText={(value) => update("additionalObservers", value)}
        placeholder="Separera flera namn med semikolon"
      />
      <View style={styles.actions}>
        <Button label="Spara observation" loading={saving} disabled={!hydrated} onPress={() => void save()} />
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  twoColumns: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  column: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: -spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
