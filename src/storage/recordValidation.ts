import { ACHIEVEMENT_DEFINITIONS, type AchievementAward } from "@/domain/achievements";
import { isSupportedObservationAmount } from "@/domain/amount";
import type {
  AppSettings,
  Observation,
  Position,
  SpeciesList,
  SpeciesListEntry,
  SpeciesSnapshot,
  Survey,
  SurveyLocale,
  TaxonomyReference,
} from "@/domain/models";

const ACHIEVEMENT_IDS = new Set<string>(
  ACHIEVEMENT_DEFINITIONS.map((achievement) => achievement.id),
);

export function isSurvey(value: unknown): value is Survey {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isOptionalString(value.description) &&
    (value.taxonomyRef === undefined || isTaxonomyReference(value.taxonomyRef)) &&
    isOptionalString(value.speciesListId) &&
    isNonEmptyString(value.surveyDate) &&
    (value.status === "active" || value.status === "archived") &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt);
}

export function isSurveyLocale(value: unknown): value is SurveyLocale {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) &&
    isNonEmptyString(value.surveyId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.observedAt) &&
    isNonEmptyString(value.timeZone) &&
    isPosition(value.position) &&
    isOptionalString(value.note) &&
    typeof value.useLocaleTimeByDefault === "boolean" &&
    typeof value.useLocalePositionByDefault === "boolean" &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt);
}

export function isObservation(value: unknown): value is Observation {
  return isObservationBeforeAmountCleanup(value) &&
    isSupportedObservationAmount((value as Record<string, unknown>).amount);
}

export function isObservationBeforeAmountCleanup(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) &&
    isNonEmptyString(value.surveyId) &&
    isNonEmptyString(value.localeId) &&
    isNonEmptyString(value.observedAt) &&
    isNonEmptyString(value.timeZone) &&
    isNonEmptyString(value.localityName) &&
    isPosition(value.position) &&
    typeof value.timeOverridden === "boolean" &&
    typeof value.positionOverridden === "boolean" &&
    typeof value.identificationUncertain === "boolean" &&
    isSpeciesSnapshot(value.species) &&
    isOptionalString(value.publicComment) &&
    isStringArray(value.additionalObservers) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt);
}

export function isSpeciesList(value: unknown): value is SpeciesList {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isTaxonomyReference(value.taxonomyRef) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt);
}

export function isSpeciesListEntry(value: unknown): value is SpeciesListEntry {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) &&
    isNonEmptyString(value.speciesListId) &&
    isNonEmptyString(value.speciesKey) &&
    isSpeciesSnapshot(value.species) &&
    isNonEmptyString(value.createdAt);
}

export function isAppSettings(value: unknown): value is AppSettings {
  return isRecord(value) && isNonEmptyString(value.defaultTaxonomyPackageId);
}

export function isAchievementAward(value: unknown): value is AchievementAward {
  if (!isRecord(value)) return false;
  return typeof value.achievementId === "string" &&
    ACHIEVEMENT_IDS.has(value.achievementId) &&
    isNonEmptyString(value.achievedAt) &&
    (value.acknowledgedAt === null || isNonEmptyString(value.acknowledgedAt));
}

export function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

function isTaxonomyReference(value: unknown): value is TaxonomyReference {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.packageId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.version);
}

function isSpeciesSnapshot(value: unknown): value is SpeciesSnapshot {
  if (!isRecord(value)) return false;
  if (value.source !== "taxonomy" && value.source !== "free-text") return false;
  if (!isNonEmptyString(value.enteredName)) return false;
  if (!isOptionalString(value.taxonId) ||
      !isOptionalString(value.preferredName) ||
      !isOptionalString(value.scientificName) ||
      !isOptionalString(value.taxonomyPackageId) ||
      !isOptionalString(value.taxonomyVersion)) return false;
  if (value.source === "taxonomy") {
    return isNonEmptyString(value.taxonId) && isNonEmptyString(value.taxonomyPackageId);
  }
  return true;
}

function isPosition(value: unknown): value is Position {
  if (!isRecord(value) || !isRecord(value.wgs84) || !isRecord(value.rt90)) return false;
  return isFiniteNumber(value.wgs84.latitude) &&
    isFiniteNumber(value.wgs84.longitude) &&
    isFiniteNumber(value.rt90.northing) &&
    isFiniteNumber(value.rt90.easting) &&
    value.rt90.crs === "EPSG:3847" &&
    (value.accuracyMeters === undefined || isFiniteNumber(value.accuracyMeters)) &&
    (value.source === "device" || value.source === "manual-rt90" || value.source === "map");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
