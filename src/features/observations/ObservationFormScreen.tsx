import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import { rt90ToWgs84, wgs84ToRt90 } from "@/domain/coordinates";
import type {
  Observation,
  ObservationDraft,
  SpeciesList,
  SpeciesSnapshot,
  Survey,
  SurveyLocale,
  Taxon,
} from "@/domain/models";
import { speciesKey, taxonomySpeciesSnapshot } from "@/domain/species";
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
import { AmountUnitPicker } from "./AmountUnitPicker";
import {
  newObservationDraft,
  shouldAutomaticallyCapturePosition,
} from "./observationDefaults";
import {
  ObservationDetailsAccordion,
  observationDetailsHaveErrors,
} from "./ObservationDetailsSection";
import { dismissToLocale } from "@/navigation/hierarchy";
import {
  createObservation,
  deleteObservation,
  getLocale,
  getObservation,
  getSpeciesList,
  getSurvey,
  loadDraft,
  observationDraftKey,
  observationEditDraftKey,
  speciesListContains,
  updateObservation,
} from "@/storage/database";
import { useDraftAutosave } from "@/storage/useDraftAutosave";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirmDestructive } from "@/ui/confirm";
import { messageOf } from "@/ui/errors";
import { Field } from "@/ui/Field";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export function ObservationFormScreen({ editing = false }: { editing?: boolean }) {
  const params = useLocalSearchParams<{
    surveyId: string;
    localeId?: string;
    observationId?: string;
  }>();
  const { surveyId, observationId } = params;
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey>();
  const [locale, setLocale] = useState<SurveyLocale>();
  const [speciesList, setSpeciesList] = useState<SpeciesList>();
  const [speciesMembership, setSpeciesMembership] = useState<{
    key: string;
    contained: boolean;
  }>();
  const [observation, setObservation] = useState<Observation>();
  const [draft, setDraft] = useState<ObservationDraft>();
  const [errors, setErrors] = useState<ValidationErrors<ObservationDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const automaticLocationRequestKey = useRef<string | undefined>(undefined);
  const locationRequestSequence = useRef(0);
  const draftSpeciesQuery = draft?.speciesQuery ?? "";
  const draftSelectedTaxon = draft?.selectedTaxon;
  const draftKey = survey?.status === "active" && surveyId && locale && (!editing || observationId)
    ? editing
      ? observationEditDraftKey(surveyId, locale.id, observationId!)
      : observationDraftKey(surveyId, locale.id)
    : undefined;

  const membershipCandidate = useMemo(() => {
    if (!speciesList || !survey || !draftSpeciesQuery.trim()) return undefined;
    const species = speciesSnapshotForSelection(
      draftSpeciesQuery,
      draftSelectedTaxon,
      survey,
      observation,
    );
    return {
      key: `${speciesList.id}:${speciesKey(species)}`,
      listId: speciesList.id,
      species,
    };
  }, [draftSelectedTaxon, draftSpeciesQuery, observation, speciesList, survey]);
  const speciesAlreadyInList = membershipCandidate && speciesMembership?.key === membershipCandidate.key
    ? speciesMembership.contained
    : undefined;

  const captureLocation = useCallback(async () => {
    const requestSequence = ++locationRequestSequence.current;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (requestSequence !== locationRequestSequence.current) return;
      if (!permission.granted) {
        setDetailsExpanded(true);
        Alert.alert("Position nekades", "Du kan fortfarande skriva in RT90-koordinater manuellt.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (requestSequence !== locationRequestSequence.current) return;
      const rt90 = wgs84ToRt90({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
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
      setErrors((current) => ({
        ...current,
        northing: undefined,
        easting: undefined,
        accuracyMeters: undefined,
      }));
    } catch (error) {
      if (requestSequence === locationRequestSequence.current) {
        setDetailsExpanded(true);
        Alert.alert("Positionen kunde inte hämtas", `${messageOf(error)} Du kan skriva in RT90-koordinater manuellt.`);
      }
    } finally {
      if (requestSequence === locationRequestSequence.current) setLocating(false);
    }
  }, []);

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
      const stored = survey.status === "active" ? await loadDraft<ObservationDraft>(key) : null;
      const baseDraft = loadedObservation
        ? observationToDraft(loadedObservation)
        : newObservationDraft(loadedLocale);
      const loadedSpeciesList = survey.speciesListId
        ? await getSpeciesList(survey.speciesListId)
        : null;
      setSurvey(survey);
      setLocale(loadedLocale);
      setSpeciesList(loadedSpeciesList ?? undefined);
      if (loadedObservation) setObservation(loadedObservation);
      const nextDraft = stored ? {
        ...baseDraft,
        ...stored,
        addToSpeciesList: stored.addToSpeciesList ?? false,
      } : baseDraft;
      setDraft(nextDraft);
      setDetailsExpanded(false);
      if (survey.status === "active" && shouldAutomaticallyCapturePosition(loadedLocale, editing, stored != null)) {
        const requestKey = `${surveyId}:${localeId}`;
        if (automaticLocationRequestKey.current !== requestKey) {
          automaticLocationRequestKey.current = requestKey;
          void captureLocation();
        }
      }
    }
    hydrate()
      .catch((error) => Alert.alert("Kunde inte öppna observationen", messageOf(error)))
      .finally(() => setHydrated(true));
  }, [captureLocation, editing, observationId, params.localeId, surveyId]);

  useDraftAutosave(draftKey, draft, hydrated);

  useEffect(() => {
    if (!membershipCandidate) return;
    let active = true;
    speciesListContains(membershipCandidate.listId, membershipCandidate.species)
      .then((contained) => {
        if (active) setSpeciesMembership({ key: membershipCandidate.key, contained });
      })
      .catch(() => {
        if (active) setSpeciesMembership({ key: membershipCandidate.key, contained: false });
      });
    return () => {
      active = false;
    };
  }, [membershipCandidate]);

  function update<K extends keyof ObservationDraft>(key: K, value: ObservationDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateSpeciesQuery(value: string) {
    setDraft((current) => current ? {
      ...current,
      speciesQuery: value,
      addToSpeciesList: false,
      selectedTaxon:
        current.selectedTaxon && value === current.selectedTaxon.preferredName
          ? current.selectedTaxon
          : undefined,
    } : current);
    setErrors((current) => ({ ...current, speciesQuery: undefined }));
  }

  function updateAmount(value: string) {
    setDraft((current) => (current ? { ...current, amount: value } : current));
    setErrors((current) => ({
      ...current,
      amount: undefined,
      unit: value.trim() ? current.unit : undefined,
    }));
  }

  function selectSpecies(value: Taxon | undefined) {
    setDraft((current) => current ? {
      ...current,
      selectedTaxon: value,
      addToSpeciesList: false,
    } : current);
  }

  function updateTime(key: "date" | "time", value: string) {
    setDraft((current) => current ? { ...current, [key]: value, timeOverridden: true } : current);
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateManualCoordinate(key: "northing" | "easting", value: string) {
    locationRequestSequence.current += 1;
    setLocating(false);
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

  function updateAccuracy(value: string) {
    setDraft((current) => current ? {
      ...current,
      accuracyMeters: value,
      positionOverridden: true,
    } : current);
    setErrors((current) => ({ ...current, accuracyMeters: undefined }));
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
    locationRequestSequence.current += 1;
    setLocating(false);
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

  async function save() {
    if (!surveyId || !locale || !draft || !survey) return;
    const nextErrors = validateObservationDraft(draft);
    setErrors(nextErrors);
    if (observationDetailsHaveErrors(nextErrors)) setDetailsExpanded(true);
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
      const species = speciesSnapshotForSelection(
        draft.speciesQuery,
        draft.selectedTaxon,
        survey,
        observation,
      );
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
        species,
        amount: draft.amount.trim() && draft.unit
          ? { value: Number(draft.amount.replace(",", ".")), unit: draft.unit }
          : undefined,
        publicComment: draft.publicComment.trim() || undefined,
        additionalObservers: parseAdditionalObservers(draft.additionalObservers),
      };
      const addToListId = draft.addToSpeciesList ? speciesList?.id : undefined;
      if (editing && observationId) await updateObservation(observationId, input, addToListId);
      else await createObservation(input, addToListId);
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

  if (survey?.status === "archived" && locale && draft) {
    return (
      <Screen>
        <Stack.Screen options={{ title: editing ? "Observation (arkiverad)" : "Inventering arkiverad" }} />
        <Card>
          <Text style={styles.archivedTitle}>Inventeringen är arkiverad</Text>
          <Text style={styles.readOnlyText}>Innehållet är skrivskyddat. Lokaler och observationer kan bara visas och exporteras.</Text>
          {observation ? <Text style={styles.readOnlyText}>{observation.species.preferredName ?? observation.species.enteredName}{observation.species.scientificName ? ` · ${observation.species.scientificName}` : ""}</Text> : null}
          {observation ? <Text style={styles.readOnlyText}>{localDateFromIso(observation.observedAt)} {localTimeFromIso(observation.observedAt)} · {locale.name}</Text> : null}
          {observation ? <Text style={styles.readOnlyText}>RT90 Nord {Math.round(observation.position.rt90.northing)}, Öst {Math.round(observation.position.rt90.easting)}</Text> : null}
          {observation?.amount ? <Text style={styles.readOnlyText}>Antal: {observation.amount.value} {observation.amount.unit}</Text> : null}
          {observation?.publicComment ? <Text style={styles.readOnlyText}>Publik kommentar: {observation.publicComment}</Text> : null}
          {observation?.additionalObservers.length ? <Text style={styles.readOnlyText}>Med-observatör: {observation.additionalObservers.join(", ")}</Text> : null}
        </Card>
        <Button label="Tillbaka till lokalen" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!draft || !locale || !survey) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.green700} size="large" />
      </Screen>
    );
  }

  return (
    <Screen
      footer={(
        <Button
          label={editing ? "Spara ändringar" : "Spara observation"}
          loading={saving}
          disabled={!hydrated || deleting}
          onPress={() => void save()}
        />
      )}
    >
      <Stack.Screen options={{ title: editing ? "Redigera observation" : "Ny observation" }} />
      <SpeciesPicker
        query={draft.speciesQuery}
        selectedTaxon={draft.selectedTaxon}
        taxonomyPackageId={survey.taxonomyRef?.packageId ?? VASCULAR_PLANTS_TAXONOMY.packageId}
        speciesListId={speciesList?.id}
        speciesListName={speciesList?.name}
        onQueryChange={updateSpeciesQuery}
        onSelect={selectSpecies}
        error={errors.speciesQuery}
      />
      {speciesList && draft.speciesQuery.trim() ? (
        speciesAlreadyInList ? (
          <Card style={styles.inListCard}>
            <Text style={styles.inListText}>✓ Arten finns redan i artlistan {speciesList.name}.</Text>
          </Card>
        ) : (
          <Card
            onPress={() => update("addToSpeciesList", !draft.addToSpeciesList)}
            style={draft.addToSpeciesList ? styles.addToListSelected : undefined}
            accessibilityLabel={`${draft.addToSpeciesList ? "Ta bort valet att lägga" : "Lägg"} arten i artlistan ${speciesList.name}`}
          >
            <Text style={styles.addToListTitle}>
              {draft.addToSpeciesList ? "✓ Läggs till" : "Lägg till arten"} i {speciesList.name}
            </Text>
            <Text style={styles.addToListHint}>Arten sparas samtidigt som observationen.</Text>
          </Card>
        )
      ) : null}
      <Field label="Antal (valfritt)" value={draft.amount} onChangeText={updateAmount} keyboardType="decimal-pad" error={errors.amount} />
      <AmountUnitPicker value={draft.unit} onChange={(unit) => update("unit", unit)} error={errors.unit} />
      <ObservationDetailsAccordion
        localeName={locale.name}
        draft={draft}
        errors={errors}
        expanded={detailsExpanded}
        locating={locating}
        onToggle={() => setDetailsExpanded((current) => !current)}
        onDateChange={(value) => updateTime("date", value)}
        onTimeChange={(value) => updateTime("time", value)}
        onUseNow={useNow}
        onUseLocaleTime={useLocaleTime}
        onNorthingChange={(value) => updateManualCoordinate("northing", value)}
        onEastingChange={(value) => updateManualCoordinate("easting", value)}
        onAccuracyChange={updateAccuracy}
        onCaptureLocation={() => void captureLocation()}
        onUseLocalePosition={useLocalePosition}
      />
      <Field label="Publik kommentar (valfri)" value={draft.publicComment} onChangeText={(value) => update("publicComment", value)} multiline placeholder="Kommentaren följer med i Excel-exporten" />
      <Field label="Med-observatör (valfri)" value={draft.additionalObservers} onChangeText={(value) => update("additionalObservers", value)} placeholder="Separera flera namn med semikolon" />
      <View style={styles.actions}>
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
    addToSpeciesList: false,
  };
}

function speciesSnapshotForSelection(
  query: string,
  selectedTaxon: Taxon | undefined,
  survey: Survey,
  original?: Observation,
): SpeciesSnapshot {
  if (!selectedTaxon || selectedTaxon.source === "free-text") {
    return { source: "free-text", enteredName: query.trim() };
  }
  const keepsOriginalTaxon = selectedTaxon.id === original?.species.taxonId;
  const taxonomy = selectedTaxon.taxonomyPackageId
    ? {
        packageId: selectedTaxon.taxonomyPackageId,
        name: survey.taxonomyRef?.name ?? VASCULAR_PLANTS_TAXONOMY.name,
        version: selectedTaxon.taxonomyVersion ?? survey.taxonomyRef?.version ?? VASCULAR_PLANTS_TAXONOMY.version,
      }
    : keepsOriginalTaxon && original?.species.taxonomyPackageId
    ? {
        packageId: original.species.taxonomyPackageId,
        name: survey.taxonomyRef?.name ?? VASCULAR_PLANTS_TAXONOMY.name,
        version: original.species.taxonomyVersion ?? survey.taxonomyRef?.version ?? VASCULAR_PLANTS_TAXONOMY.version,
      }
    : (survey.taxonomyRef ?? VASCULAR_PLANTS_TAXONOMY);
  return taxonomySpeciesSnapshot(selectedTaxon, taxonomy, query);
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
    taxonomyPackageId: observation.species.taxonomyPackageId,
    taxonomyVersion: observation.species.taxonomyVersion,
  };
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  archivedTitle: { color: colors.warning, fontSize: 18, fontWeight: "700" },
  readOnlyText: { color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  inListCard: { backgroundColor: colors.green100 },
  inListText: { color: colors.green800, fontWeight: "700" },
  addToListSelected: { borderColor: colors.green700, borderWidth: 2, backgroundColor: colors.green100 },
  addToListTitle: { color: colors.green800, fontSize: 16, fontWeight: "700" },
  addToListHint: { color: colors.textMuted, marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
