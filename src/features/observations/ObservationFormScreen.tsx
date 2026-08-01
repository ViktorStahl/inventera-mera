import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, StyleSheet, Text, View } from "react-native";

import { rt90ToWgs84, wgs84ToRt90 } from "@/domain/coordinates";
import type { Observation, ObservationDraft, SurveyLocale, Taxon } from "@/domain/models";
import {
  currentTimeZone,
  localDateFromIso,
  localDateTimeWithOffset,
  localTimeFromIso,
  timeLocal,
  todayLocal,
} from "@/domain/time";
import {
  hasErrors,
  parseAdditionalObservers,
  validateObservationDraft,
  type ValidationErrors,
} from "@/domain/validation";
import { SpeciesPicker } from "@/features/taxonomy/SpeciesPicker";
import { dismissToLocale } from "@/navigation/hierarchy";
import {
  createObservation,
  deleteObservation,
  getLocale,
  getObservation,
  getSurvey,
  loadDraft,
  observationDraftKey,
  observationEditDraftKey,
  saveDraft,
  updateObservation,
} from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirmDestructive } from "@/ui/confirm";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

function draftFromLocale(locale: SurveyLocale): ObservationDraft {
  return {
    date: localDateFromIso(locale.observedAt),
    time: localTimeFromIso(locale.observedAt),
    timeOverridden: false,
    northing: locale.position.rt90.northing.toString(),
    easting: locale.position.rt90.easting.toString(),
    accuracyMeters: locale.position.accuracyMeters?.toString() ?? "",
    positionSource: locale.position.source,
    positionOverridden: false,
    latitude: locale.position.wgs84.latitude,
    longitude: locale.position.wgs84.longitude,
    speciesQuery: "",
    amount: "",
    unit: "",
    publicComment: "",
    additionalObservers: "",
  };
}

export function ObservationFormScreen({ editing = false }: { editing?: boolean }) {
  const params = useLocalSearchParams<{
    surveyId: string;
    localeId?: string;
    observationId?: string;
  }>();
  const { surveyId, observationId } = params;
  const router = useRouter();
  const [locale, setLocale] = useState<SurveyLocale>();
  const [observation, setObservation] = useState<Observation>();
  const [draft, setDraft] = useState<ObservationDraft>();
  const [errors, setErrors] = useState<ValidationErrors<ObservationDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!surveyId || (editing && !observationId) || (!editing && !params.localeId)) return;
    async function hydrate() {
      const survey = await getSurvey(surveyId);
      if (!survey) throw new Error("Inventeringen kunde inte hittas.");
      const loadedObservation = editing
        ? await getObservation(surveyId, observationId!)
        : null;
      if (editing && !loadedObservation) throw new Error("Observationen kunde inte hittas.");
      const localeId = loadedObservation?.localeId ?? params.localeId!;
      const loadedLocale = await getLocale(surveyId, localeId);
      if (!loadedLocale) throw new Error("Lokalen kunde inte hittas.");
      const key = editing
        ? observationEditDraftKey(surveyId, localeId, observationId!)
        : observationDraftKey(surveyId, localeId);
      const stored = await loadDraft<ObservationDraft>(key);
      setLocale(loadedLocale);
      if (loadedObservation) setObservation(loadedObservation);
      setDraft(stored ?? (loadedObservation ? observationToDraft(loadedObservation) : draftFromLocale(loadedLocale)));
    }
    hydrate()
      .catch((error) => Alert.alert("Kunde inte öppna observationen", messageOf(error)))
      .finally(() => setHydrated(true));
  }, [editing, observationId, params.localeId, surveyId]);

  useEffect(() => {
    if (!hydrated || !surveyId || !locale || !draft || (editing && !observationId)) return;
    const key = editing
      ? observationEditDraftKey(surveyId, locale.id, observationId!)
      : observationDraftKey(surveyId, locale.id);
    const timeout = setTimeout(() => void saveDraft(key, draft), 300);
    return () => clearTimeout(timeout);
  }, [draft, editing, hydrated, locale, observationId, surveyId]);

  useEffect(() => {
    if (!hydrated || !surveyId || !locale || !draft || (editing && !observationId)) return;
    const key = editing
      ? observationEditDraftKey(surveyId, locale.id, observationId!)
      : observationDraftKey(surveyId, locale.id);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void saveDraft(key, draft);
    });
    return () => subscription.remove();
  }, [draft, editing, hydrated, locale, observationId, surveyId]);

  function update<K extends keyof ObservationDraft>(key: K, value: ObservationDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateTime(key: "date" | "time", value: string) {
    setDraft((current) => current ? { ...current, [key]: value, timeOverridden: true } : current);
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateManualCoordinate(key: "northing" | "easting", value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: value,
            positionSource: "manual-rt90",
            positionOverridden: true,
            latitude: undefined,
            longitude: undefined,
            accuracyMeters: current.positionSource === "device" ? "" : current.accuracyMeters,
          }
        : current,
    );
    setErrors((current) => ({ ...current, northing: undefined, easting: undefined }));
  }

  function useLocaleTime() {
    if (!locale) return;
    setDraft((current) => current ? {
      ...current,
      date: localDateFromIso(locale.observedAt),
      time: localTimeFromIso(locale.observedAt),
      timeOverridden: false,
    } : current);
  }

  function useLocalePosition() {
    if (!locale) return;
    setDraft((current) => current ? {
      ...current,
      northing: locale.position.rt90.northing.toString(),
      easting: locale.position.rt90.easting.toString(),
      accuracyMeters: locale.position.accuracyMeters?.toString() ?? "",
      positionSource: locale.position.source,
      positionOverridden: false,
      latitude: locale.position.wgs84.latitude,
      longitude: locale.position.wgs84.longitude,
    } : current);
    setErrors((current) => ({ ...current, northing: undefined, easting: undefined, accuracyMeters: undefined }));
  }

  function useNow() {
    const now = new Date();
    setDraft((current) => current ? {
      ...current,
      date: todayLocal(now),
      time: timeLocal(now),
      timeOverridden: true,
    } : current);
  }

  async function captureLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Position nekades", "Du kan fortfarande skriva in RT90-koordinater manuellt.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const rt90 = wgs84ToRt90({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      setDraft((current) => current ? {
        ...current,
        northing: rt90.northing.toFixed(2),
        easting: rt90.easting.toFixed(2),
        accuracyMeters: location.coords.accuracy == null ? "" : location.coords.accuracy.toFixed(1),
        positionSource: "device",
        positionOverridden: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      } : current);
      setErrors((current) => ({ ...current, northing: undefined, easting: undefined, accuracyMeters: undefined }));
    } catch (error) {
      Alert.alert("Positionen kunde inte hämtas", `${messageOf(error)} Du kan skriva in RT90-koordinater manuellt.`);
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!surveyId || !locale || !draft) return;
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
      const keepsOriginalTaxon = selected?.id === observation?.species.taxonId;
      const input = {
        surveyId,
        localeId: locale.id,
        observedAt: localDateTimeWithOffset(draft.date, draft.time),
        timeZone: draft.timeOverridden ? currentTimeZone() : locale.timeZone,
        localityName: locale.name,
        timeOverridden: draft.timeOverridden,
        position: {
          wgs84,
          rt90: { ...rt90, crs: "EPSG:3847" as const },
          accuracyMeters: draft.accuracyMeters.trim() ? Number(draft.accuracyMeters.replace(",", ".")) : undefined,
          source: draft.positionSource,
        },
        positionOverridden: draft.positionOverridden,
        species: selected
          ? {
              source: "taxonomy" as const,
              enteredName: draft.speciesQuery.trim(),
              taxonId: selected.id,
              preferredName: selected.preferredName,
              scientificName: selected.scientificName,
              taxonomyPackageId: keepsOriginalTaxon
                ? (observation?.species.taxonomyPackageId ?? "vascular-plants-starter")
                : "vascular-plants-starter",
              taxonomyVersion: keepsOriginalTaxon
                ? (observation?.species.taxonomyVersion ?? "2026-07-mvp")
                : "2026-07-mvp",
            }
          : { source: "free-text" as const, enteredName: draft.speciesQuery.trim() },
        amount: draft.amount.trim()
          ? { value: Number(draft.amount.replace(",", ".")), unit: draft.unit.trim() }
          : undefined,
        publicComment: draft.publicComment.trim() || undefined,
        additionalObservers: parseAdditionalObservers(draft.additionalObservers),
      };
      if (editing && observationId) await updateObservation(observationId, input);
      else await createObservation(input);
      dismissToLocale(router, surveyId, locale.id);
    } catch (error) {
      Alert.alert("Observationen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!surveyId || !locale || !observationId) return;
    const confirmed = await confirmDestructive(
      "Radera observation?",
      "Observationen raderas permanent från den här enheten. Åtgärden kan inte ångras.",
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteObservation(surveyId, observationId);
      dismissToLocale(router, surveyId, locale.id);
    } catch (error) {
      Alert.alert("Observationen kunde inte raderas", messageOf(error));
      setDeleting(false);
    }
  }

  if (!draft || !locale) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.green700} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? "Redigera observation" : "Ny observation" }} />
      <Card>
        <Text style={styles.localeLabel}>Lokal</Text>
        <Text style={styles.localeName}>{locale.name}</Text>
        <Text style={styles.inheritanceHint}>Tid och position följer lokalen tills du ändrar dem.</Text>
      </Card>
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Field label="Datum" value={draft.date} onChangeText={(value) => updateTime("date", value)} keyboardType="numbers-and-punctuation" error={errors.date} />
        </View>
        <View style={styles.column}>
          <Field label="Tid" value={draft.time} onChangeText={(value) => updateTime("time", value)} keyboardType="numbers-and-punctuation" error={errors.time} />
        </View>
      </View>
      <View style={styles.twoColumns}>
        <View style={styles.column}><Button label="Nu" variant="secondary" onPress={useNow} /></View>
        <View style={styles.column}><Button label="Använd lokalens tid" variant="secondary" onPress={useLocaleTime} /></View>
      </View>
      <Text style={styles.overrideStatus}>{draft.timeOverridden ? "Egen tid" : "Följer lokalens tid"}</Text>
      <Text style={styles.sectionTitle}>Koordinater · RT90 2,5 gon V</Text>
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Field label="Nord (X)" value={draft.northing} onChangeText={(value) => updateManualCoordinate("northing", value)} keyboardType="decimal-pad" error={errors.northing} />
        </View>
        <View style={styles.column}>
          <Field label="Öst (Y)" value={draft.easting} onChangeText={(value) => updateManualCoordinate("easting", value)} keyboardType="decimal-pad" error={errors.easting} />
        </View>
      </View>
      <Field
        label="Noggrannhet i meter (valfri)"
        value={draft.accuracyMeters}
        onChangeText={(value) => {
          update("accuracyMeters", value);
          update("positionOverridden", true);
        }}
        keyboardType="decimal-pad"
        editable={draft.positionSource !== "device"}
        hint={draft.positionSource === "device" ? "Rapporterad av enhetens positionstjänst." : undefined}
        error={errors.accuracyMeters}
      />
      <View style={styles.twoColumns}>
        <View style={styles.column}><Button label="Min position" variant="secondary" loading={locating} onPress={() => void captureLocation()} /></View>
        <View style={styles.column}><Button label="Använd lokalens position" variant="secondary" onPress={useLocalePosition} /></View>
      </View>
      <Text style={styles.overrideStatus}>{draft.positionOverridden ? "Egen position" : "Följer lokalens position"}</Text>
      <SpeciesPicker
        query={draft.speciesQuery}
        selectedTaxon={draft.selectedTaxon}
        onQueryChange={(value) => update("speciesQuery", value)}
        onSelect={(value) => update("selectedTaxon", value)}
        error={errors.speciesQuery}
      />
      <View style={styles.twoColumns}>
        <View style={styles.column}><Field label="Antal (valfritt)" value={draft.amount} onChangeText={(value) => update("amount", value)} keyboardType="decimal-pad" error={errors.amount} /></View>
        <View style={styles.column}><Field label="Enhet" value={draft.unit} onChangeText={(value) => update("unit", value)} placeholder="individer" error={errors.unit} /></View>
      </View>
      <Field label="Publik kommentar (valfri)" value={draft.publicComment} onChangeText={(value) => update("publicComment", value)} multiline placeholder="Kommentaren följer med i Excel-exporten" />
      <Field label="Med-observatör (valfri)" value={draft.additionalObservers} onChangeText={(value) => update("additionalObservers", value)} placeholder="Separera flera namn med semikolon" />
      <View style={styles.actions}>
        <Button label={editing ? "Spara ändringar" : "Spara observation"} loading={saving} disabled={!hydrated || deleting} onPress={() => void save()} />
        {editing ? <Button label="Radera observation" variant="danger" loading={deleting} disabled={saving} onPress={() => void remove()} /> : null}
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function observationToDraft(observation: Observation): ObservationDraft {
  return {
    date: localDateFromIso(observation.observedAt),
    time: localTimeFromIso(observation.observedAt),
    timeOverridden: observation.timeOverridden,
    northing: observation.position.rt90.northing.toString(),
    easting: observation.position.rt90.easting.toString(),
    accuracyMeters: observation.position.accuracyMeters?.toString() ?? "",
    positionSource: observation.position.source,
    positionOverridden: observation.positionOverridden,
    latitude: observation.position.wgs84.latitude,
    longitude: observation.position.wgs84.longitude,
    speciesQuery: observation.species.enteredName,
    selectedTaxon: taxonFromObservation(observation),
    amount: observation.amount?.value.toString() ?? "",
    unit: observation.amount?.unit ?? "",
    publicComment: observation.publicComment ?? "",
    additionalObservers: observation.additionalObservers.join("; "),
  };
}

function taxonFromObservation(observation: Observation): Taxon | undefined {
  if (observation.species.source !== "taxonomy" || !observation.species.taxonId) return undefined;
  return {
    id: observation.species.taxonId,
    preferredName: observation.species.preferredName ?? observation.species.enteredName,
    scientificName: observation.species.scientificName ?? "",
    synonyms: [],
    rank: "",
    status: "",
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  localeLabel: { color: colors.textMuted, fontSize: 13 },
  localeName: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: spacing.xs },
  inheritanceHint: { color: colors.textMuted, marginTop: spacing.xs },
  twoColumns: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  column: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: -spacing.sm },
  overrideStatus: { color: colors.green800, fontSize: 13, marginTop: -spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
