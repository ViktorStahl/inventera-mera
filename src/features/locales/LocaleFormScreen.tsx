import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { rt90ToWgs84, wgs84ToRt90 } from "@/domain/coordinates";
import type { LocaleDraft, SurveyLocale } from "@/domain/models";
import {
  currentTimeZone,
  localDateFromIso,
  localDateTimeWithOffset,
  localTimeFromIso,
  timeLocal,
  todayLocal,
} from "@/domain/time";
import { hasErrors, validateLocaleDraft, type ValidationErrors } from "@/domain/validation";
import { dismissToLocale, dismissToSurvey } from "@/navigation/hierarchy";
import {
  createLocale,
  deleteLocale,
  getLocale,
  getSurvey,
  loadDraft,
  localeDraftKey,
  localeEditDraftKey,
  updateLocale,
} from "@/storage/database";
import { useDraftAutosave } from "@/storage/useDraftAutosave";
import { Button } from "@/ui/Button";
import { confirmDestructive } from "@/ui/confirm";
import { messageOf } from "@/ui/errors";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

function emptyDraft(): LocaleDraft {
  return {
    name: "",
    date: todayLocal(),
    time: timeLocal(),
    northing: "",
    easting: "",
    accuracyMeters: "",
    positionSource: "manual-rt90",
    note: "",
  };
}

export function LocaleFormScreen({ editing = false }: { editing?: boolean }) {
  const { surveyId, localeId } = useLocalSearchParams<{ surveyId: string; localeId?: string }>();
  const router = useRouter();
  const [locale, setLocale] = useState<SurveyLocale>();
  const [draft, setDraft] = useState<LocaleDraft>();
  const [errors, setErrors] = useState<ValidationErrors<LocaleDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [locating, setLocating] = useState(false);
  const draftKey = surveyId && (!editing || localeId)
    ? editing
      ? localeEditDraftKey(surveyId, localeId!)
      : localeDraftKey(surveyId)
    : undefined;

  useEffect(() => {
    if (!surveyId || (editing && !localeId)) return;
    const key = editing
      ? localeEditDraftKey(surveyId, localeId!)
      : localeDraftKey(surveyId);
    Promise.all([
      getSurvey(surveyId),
      editing ? getLocale(surveyId, localeId!) : Promise.resolve(null),
      loadDraft<LocaleDraft>(key),
    ])
      .then(([survey, loadedLocale, stored]) => {
        if (!survey) throw new Error("Inventeringen kunde inte hittas.");
        if (editing && !loadedLocale) throw new Error("Lokalen kunde inte hittas.");
        if (loadedLocale) setLocale(loadedLocale);
        setDraft(stored ?? (loadedLocale ? localeToDraft(loadedLocale) : emptyDraft()));
      })
      .catch((error) => Alert.alert("Kunde inte öppna lokalen", messageOf(error)))
      .finally(() => setHydrated(true));
  }, [editing, localeId, surveyId]);

  useDraftAutosave(draftKey, draft, hydrated);

  function update<K extends keyof LocaleDraft>(key: K, value: LocaleDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateManualCoordinate(key: "northing" | "easting", value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: value,
            positionSource: "manual-rt90",
            latitude: undefined,
            longitude: undefined,
            accuracyMeters: current.positionSource === "device" ? "" : current.accuracyMeters,
          }
        : current,
    );
    setErrors((current) => ({ ...current, northing: undefined, easting: undefined }));
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
      const rt90 = wgs84ToRt90({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setDraft((current) =>
        current
          ? {
              ...current,
              northing: rt90.northing.toFixed(2),
              easting: rt90.easting.toFixed(2),
              accuracyMeters:
                location.coords.accuracy == null ? "" : location.coords.accuracy.toFixed(1),
              positionSource: "device",
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }
          : current,
      );
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
    if (!surveyId || !draft) return;
    const nextErrors = validateLocaleDraft(draft);
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
      const dateTimeUnchanged =
        locale != null &&
        draft.date === localDateFromIso(locale.observedAt) &&
        draft.time === localTimeFromIso(locale.observedAt);
      const input = {
        surveyId,
        name: draft.name.trim(),
        observedAt: dateTimeUnchanged
          ? locale.observedAt
          : localDateTimeWithOffset(draft.date, draft.time),
        timeZone: dateTimeUnchanged ? locale.timeZone : currentTimeZone(),
        position: {
          wgs84,
          rt90: { ...rt90, crs: "EPSG:3847" as const },
          accuracyMeters: draft.accuracyMeters.trim()
            ? Number(draft.accuracyMeters.replace(",", "."))
            : undefined,
          source: draft.positionSource,
        },
        note: draft.note.trim() || undefined,
      };
      const saved = editing && localeId
        ? await updateLocale(localeId, input)
        : await createLocale(input);
      dismissToLocale(router, surveyId, saved.id);
    } catch (error) {
      Alert.alert("Lokalen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!surveyId || !localeId || !locale) return;
    const confirmed = await confirmDestructive(
      "Radera lokal?",
      `”${locale.name}” och alla dess observationer raderas permanent från den här enheten. Åtgärden kan inte ångras.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteLocale(surveyId, localeId);
      dismissToSurvey(router, surveyId);
    } catch (error) {
      Alert.alert("Lokalen kunde inte raderas", messageOf(error));
      setDeleting(false);
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
      <Stack.Screen options={{ title: editing ? "Redigera lokal" : "Ny lokal" }} />
      <Field
        label="Lokalnamn"
        value={draft.name}
        onChangeText={(value) => update("name", value)}
        placeholder="Till exempel Lillåsen nord"
        error={errors.name}
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
      <Button
        label="Använd min position"
        variant="secondary"
        loading={locating}
        onPress={() => void captureLocation()}
      />
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
      <Button
        label="Använd nuvarande tid"
        variant="secondary"
        onPress={() => {
          const now = new Date();
          setDraft((current) =>
            current ? { ...current, date: todayLocal(now), time: timeLocal(now) } : current,
          );
        }}
      />
      <Field
        label="Anteckning (valfri)"
        value={draft.note}
        onChangeText={(value) => update("note", value)}
        multiline
      />
      <View style={styles.actions}>
        <Button
          label={editing ? "Spara ändringar" : "Spara lokal"}
          loading={saving}
          disabled={!hydrated || deleting}
          onPress={() => void save()}
        />
        {editing ? (
          <Button
            label="Radera lokal"
            variant="danger"
            loading={deleting}
            disabled={saving}
            onPress={() => void remove()}
          />
        ) : null}
        <Button label="Avbryt" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function localeToDraft(locale: SurveyLocale): LocaleDraft {
  return {
    name: locale.name,
    date: localDateFromIso(locale.observedAt),
    time: localTimeFromIso(locale.observedAt),
    northing: locale.position.rt90.northing.toString(),
    easting: locale.position.rt90.easting.toString(),
    accuracyMeters: locale.position.accuracyMeters?.toString() ?? "",
    positionSource: locale.position.source,
    latitude: locale.position.wgs84.latitude,
    longitude: locale.position.wgs84.longitude,
    note: locale.note ?? "",
  };
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  twoColumns: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  column: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: -spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
