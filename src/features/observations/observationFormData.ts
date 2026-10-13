import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import { rt90ToWgs84 } from "@/domain/coordinates";
import type {
  Observation,
  ObservationDraft,
  SpeciesSnapshot,
  Survey,
  SurveyLocale,
  Taxon,
} from "@/domain/models";
import { taxonomySpeciesSnapshot } from "@/domain/species";
import {
  currentTimeZone,
  localDateFromIso,
  localDateTimeWithOffset,
  localTimeFromIso,
} from "@/domain/time";
import { parseAdditionalObservers } from "@/domain/validation";

export type ObservationInput = Omit<Observation, "id" | "createdAt" | "updatedAt">;

export function observationToDraft(observation: Observation): ObservationDraft {
  return {
    date: localDateFromIso(observation.observedAt),
    time: localTimeFromIso(observation.observedAt),
    timeOverridden: observation.timeOverridden,
    identificationUncertain: observation.identificationUncertain,
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

export function speciesSnapshotForSelection(
  query: string,
  selectedTaxon: Taxon | undefined,
  survey: Survey,
  original?: Observation,
): SpeciesSnapshot {
  if (!selectedTaxon || selectedTaxon.source === "free-text") {
    return { source: "free-text", enteredName: query.trim() };
  }
  const taxonomy = taxonomyForSelection(selectedTaxon, survey, original);
  return taxonomySpeciesSnapshot(selectedTaxon, taxonomy, query);
}

export function buildObservationInput(
  survey: Survey,
  locale: SurveyLocale,
  draft: ObservationDraft,
  original?: Observation,
): ObservationInput {
  const rt90 = {
    northing: parseDecimal(draft.northing),
    easting: parseDecimal(draft.easting),
  };
  const hasCapturedWgs84 = draft.positionSource === "device" &&
    draft.latitude != null &&
    draft.longitude != null;
  const wgs84 = hasCapturedWgs84
    ? { latitude: draft.latitude!, longitude: draft.longitude! }
    : rt90ToWgs84(rt90);

  return {
    surveyId: survey.id,
    localeId: locale.id,
    observedAt: localDateTimeWithOffset(draft.date, draft.time),
    timeZone: draft.timeOverridden ? currentTimeZone() : locale.timeZone,
    localityName: locale.name,
    timeOverridden: draft.timeOverridden,
    identificationUncertain: draft.identificationUncertain,
    position: {
      wgs84,
      rt90: { ...rt90, crs: "EPSG:3847" },
      accuracyMeters: draft.accuracyMeters.trim()
        ? parseDecimal(draft.accuracyMeters)
        : undefined,
      source: draft.positionSource,
    },
    positionOverridden: draft.positionOverridden,
    species: speciesSnapshotForSelection(
      draft.speciesQuery,
      draft.selectedTaxon,
      survey,
      original,
    ),
    amount: draft.amount.trim() && draft.unit
      ? { value: parseDecimal(draft.amount), unit: draft.unit }
      : undefined,
    publicComment: draft.publicComment.trim() || undefined,
    additionalObservers: parseAdditionalObservers(draft.additionalObservers),
  };
}

function taxonomyForSelection(
  selectedTaxon: Taxon,
  survey: Survey,
  original?: Observation,
) {
  if (selectedTaxon.taxonomyPackageId) {
    return {
      packageId: selectedTaxon.taxonomyPackageId,
      name: survey.taxonomyRef?.name ?? VASCULAR_PLANTS_TAXONOMY.name,
      version: selectedTaxon.taxonomyVersion ??
        survey.taxonomyRef?.version ??
        VASCULAR_PLANTS_TAXONOMY.version,
    };
  }
  const keepsOriginalTaxon = selectedTaxon.id === original?.species.taxonId;
  if (keepsOriginalTaxon && original?.species.taxonomyPackageId) {
    return {
      packageId: original.species.taxonomyPackageId,
      name: survey.taxonomyRef?.name ?? VASCULAR_PLANTS_TAXONOMY.name,
      version: original.species.taxonomyVersion ??
        survey.taxonomyRef?.version ??
        VASCULAR_PLANTS_TAXONOMY.version,
    };
  }
  return survey.taxonomyRef ?? VASCULAR_PLANTS_TAXONOMY;
}

function taxonFromObservation(observation: Observation): Taxon | undefined {
  if (observation.species.source !== "taxonomy" || !observation.species.taxonId) {
    return undefined;
  }
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

function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}
