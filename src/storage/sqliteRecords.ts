import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

import {
  isObservationUnit,
  isSupportedObservationAmount,
  type ObservationAmount,
} from "@/domain/amount";
import type {
  Observation,
  Position,
  SpeciesList,
  SpeciesListEntry,
  SpeciesSnapshot,
  Survey,
  SurveyLocale,
  TaxonomyReference,
} from "@/domain/models";
import { speciesKey } from "@/domain/species";

export function newSpeciesListEntry(
  listId: string,
  species: SpeciesSnapshot,
): SpeciesListEntry {
  return {
    id: Crypto.randomUUID(),
    speciesListId: listId,
    speciesKey: speciesKey(species),
    species,
    createdAt: new Date().toISOString(),
  };
}

export async function insertSpeciesList(
  database: SQLite.SQLiteDatabase,
  list: SpeciesList,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO species_lists(id, name, taxonomy_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`,
    list.id,
    list.name,
    JSON.stringify(list.taxonomyRef),
    list.createdAt,
    list.updatedAt,
  );
}

export async function insertSpeciesListEntry(
  database: SQLite.SQLiteDatabase,
  entry: SpeciesListEntry,
  ignoreDuplicate = false,
): Promise<void> {
  await database.runAsync(
    `${ignoreDuplicate ? "INSERT OR IGNORE" : "INSERT"} INTO species_list_entries(
      id, species_list_id, species_key, taxon_id, species_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.speciesListId,
    entry.speciesKey,
    entry.species.taxonId ?? null,
    JSON.stringify(entry.species),
    entry.createdAt,
  );
}

export async function insertSurvey(
  database: SQLite.SQLiteDatabase,
  survey: Survey,
  replace = false,
): Promise<void> {
  const command = replace ? "INSERT OR REPLACE" : "INSERT";
  await database.runAsync(
    `${command} INTO surveys (
      id, title, description, taxonomy_json, species_list_id, survey_date, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    survey.id,
    survey.title,
    survey.description ?? null,
    survey.taxonomyRef ? JSON.stringify(survey.taxonomyRef) : null,
    survey.speciesListId ?? null,
    survey.surveyDate,
    survey.status,
    survey.createdAt,
    survey.updatedAt,
  );
}

export async function insertLocale(
  database: SQLite.SQLiteDatabase,
  locale: SurveyLocale,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO locales (
      id, survey_id, name, observed_at, time_zone, latitude, longitude,
      rt90_northing, rt90_easting, accuracy_meters, position_source, note,
      use_locale_time_by_default, use_locale_position_by_default,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    locale.id,
    locale.surveyId,
    locale.name,
    locale.observedAt,
    locale.timeZone,
    locale.position.wgs84.latitude,
    locale.position.wgs84.longitude,
    locale.position.rt90.northing,
    locale.position.rt90.easting,
    locale.position.accuracyMeters ?? null,
    locale.position.source,
    locale.note ?? null,
    locale.useLocaleTimeByDefault ? 1 : 0,
    locale.useLocalePositionByDefault ? 1 : 0,
    locale.createdAt,
    locale.updatedAt,
  );
}

export async function updateLocaleRow(
  database: SQLite.SQLiteDatabase,
  locale: SurveyLocale,
): Promise<SQLite.SQLiteRunResult> {
  return database.runAsync(
    `UPDATE locales SET name = ?, observed_at = ?, time_zone = ?, latitude = ?,
      longitude = ?, rt90_northing = ?, rt90_easting = ?, accuracy_meters = ?,
      position_source = ?, note = ?, use_locale_time_by_default = ?,
      use_locale_position_by_default = ?, updated_at = ?
     WHERE id = ? AND survey_id = ?`,
    locale.name,
    locale.observedAt,
    locale.timeZone,
    locale.position.wgs84.latitude,
    locale.position.wgs84.longitude,
    locale.position.rt90.northing,
    locale.position.rt90.easting,
    locale.position.accuracyMeters ?? null,
    locale.position.source,
    locale.note ?? null,
    locale.useLocaleTimeByDefault ? 1 : 0,
    locale.useLocalePositionByDefault ? 1 : 0,
    locale.updatedAt,
    locale.id,
    locale.surveyId,
  );
}

export async function insertObservation(
  database: SQLite.SQLiteDatabase,
  observation: Observation,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO observations (
      id, locale_id, observed_at_override, time_zone_override, latitude_override,
      longitude_override, rt90_northing_override, rt90_easting_override,
      accuracy_meters_override, position_source_override, species_json,
      amount_value, amount_unit, public_comment, additional_observers_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    observation.id,
    observation.localeId,
    observation.timeOverridden ? observation.observedAt : null,
    observation.timeOverridden ? observation.timeZone : null,
    observation.positionOverridden ? observation.position.wgs84.latitude : null,
    observation.positionOverridden ? observation.position.wgs84.longitude : null,
    observation.positionOverridden ? observation.position.rt90.northing : null,
    observation.positionOverridden ? observation.position.rt90.easting : null,
    observation.positionOverridden ? (observation.position.accuracyMeters ?? null) : null,
    observation.positionOverridden ? observation.position.source : null,
    JSON.stringify(observation.species),
    observation.amount?.value ?? null,
    observation.amount?.unit ?? null,
    observation.publicComment ?? null,
    JSON.stringify(observation.additionalObservers),
    observation.createdAt,
    observation.updatedAt,
  );
}

export async function updateObservationRow(
  database: SQLite.SQLiteDatabase,
  observation: Observation,
): Promise<SQLite.SQLiteRunResult> {
  return database.runAsync(
    `UPDATE observations SET locale_id = ?, observed_at_override = ?,
      time_zone_override = ?, latitude_override = ?, longitude_override = ?,
      rt90_northing_override = ?, rt90_easting_override = ?,
      accuracy_meters_override = ?, position_source_override = ?, species_json = ?,
      amount_value = ?, amount_unit = ?, public_comment = ?,
      additional_observers_json = ?, updated_at = ? WHERE id = ?`,
    observation.localeId,
    observation.timeOverridden ? observation.observedAt : null,
    observation.timeOverridden ? observation.timeZone : null,
    observation.positionOverridden ? observation.position.wgs84.latitude : null,
    observation.positionOverridden ? observation.position.wgs84.longitude : null,
    observation.positionOverridden ? observation.position.rt90.northing : null,
    observation.positionOverridden ? observation.position.rt90.easting : null,
    observation.positionOverridden ? (observation.position.accuracyMeters ?? null) : null,
    observation.positionOverridden ? observation.position.source : null,
    JSON.stringify(observation.species),
    observation.amount?.value ?? null,
    observation.amount?.unit ?? null,
    observation.publicComment ?? null,
    JSON.stringify(observation.additionalObservers),
    observation.updatedAt,
    observation.id,
  );
}

export function surveyFromRow(row: SurveyRow): Survey {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    taxonomyRef: row.taxonomy_json
      ? (JSON.parse(row.taxonomy_json) as TaxonomyReference)
      : undefined,
    speciesListId: row.species_list_id ?? undefined,
    surveyDate: row.survey_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function speciesListFromRow(row: SpeciesListRow): SpeciesList {
  return {
    id: row.id,
    name: row.name,
    taxonomyRef: JSON.parse(row.taxonomy_json) as TaxonomyReference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function speciesListEntryFromRow(row: SpeciesListEntryRow): SpeciesListEntry {
  return {
    id: row.id,
    speciesListId: row.species_list_id,
    speciesKey: row.species_key,
    species: JSON.parse(row.species_json) as SpeciesSnapshot,
    createdAt: row.created_at,
  };
}

export function localeFromRow(row: LocaleRow): SurveyLocale {
  return {
    id: row.id,
    surveyId: row.survey_id,
    name: row.name,
    observedAt: row.observed_at,
    timeZone: row.time_zone,
    position: positionFromValues(
      row.latitude,
      row.longitude,
      row.rt90_northing,
      row.rt90_easting,
      row.accuracy_meters,
      row.position_source,
    ),
    note: row.note ?? undefined,
    useLocaleTimeByDefault: row.use_locale_time_by_default === 1,
    useLocalePositionByDefault: row.use_locale_position_by_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function observationFromRow(row: ObservationRow): Observation {
  return {
    id: row.id,
    surveyId: row.survey_id,
    localeId: row.locale_id,
    observedAt: row.effective_observed_at,
    timeZone: row.effective_time_zone,
    localityName: row.locale_name,
    position: positionFromValues(
      row.effective_latitude,
      row.effective_longitude,
      row.effective_rt90_northing,
      row.effective_rt90_easting,
      row.effective_accuracy_meters,
      row.effective_position_source,
    ),
    timeOverridden: row.observed_at_override != null,
    positionOverridden: row.position_source_override != null,
    species: JSON.parse(row.species_json) as SpeciesSnapshot,
    amount: amountFromValues(row.amount_value, row.amount_unit),
    publicComment: row.public_comment ?? undefined,
    additionalObservers: JSON.parse(row.additional_observers_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function observationDraftHasSupportedUnit(valueJson: string): boolean {
  try {
    const value = JSON.parse(valueJson) as unknown;
    if (!value || typeof value !== "object") return false;
    const unit = (value as { unit?: unknown }).unit;
    return unit === undefined || unit === "" || isObservationUnit(unit);
  } catch {
    return false;
  }
}

function positionFromValues(
  latitude: number,
  longitude: number,
  northing: number,
  easting: number,
  accuracy: number | null,
  source: Position["source"],
): Position {
  return {
    wgs84: { latitude, longitude },
    rt90: { northing, easting, crs: "EPSG:3847" },
    accuracyMeters: accuracy ?? undefined,
    source,
  };
}

function amountFromValues(
  value: number | null,
  unit: string | null,
): ObservationAmount | undefined {
  if (value == null && unit == null) return undefined;
  const amount = { value, unit };
  if (!isSupportedObservationAmount(amount)) {
    throw new Error("Observationen har en enhet som inte stöds.");
  }
  return amount;
}

export type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  taxonomy_json: string | null;
  species_list_id: string | null;
  survey_date: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type SpeciesListRow = {
  id: string;
  name: string;
  taxonomy_json: string;
  created_at: string;
  updated_at: string;
};

export type SpeciesListEntryRow = {
  id: string;
  species_list_id: string;
  species_key: string;
  taxon_id: string | null;
  species_json: string;
  created_at: string;
};

export type LocaleRow = {
  id: string;
  survey_id: string;
  name: string;
  observed_at: string;
  time_zone: string;
  latitude: number;
  longitude: number;
  rt90_northing: number;
  rt90_easting: number;
  accuracy_meters: number | null;
  position_source: Position["source"];
  note: string | null;
  use_locale_time_by_default: number;
  use_locale_position_by_default: number;
  created_at: string;
  updated_at: string;
};

export type ObservationRow = {
  id: string;
  locale_id: string;
  observed_at_override: string | null;
  time_zone_override: string | null;
  position_source_override: Position["source"] | null;
  species_json: string;
  amount_value: number | null;
  amount_unit: string | null;
  public_comment: string | null;
  additional_observers_json: string;
  created_at: string;
  updated_at: string;
  survey_id: string;
  locale_name: string;
  effective_observed_at: string;
  effective_time_zone: string;
  effective_latitude: number;
  effective_longitude: number;
  effective_rt90_northing: number;
  effective_rt90_easting: number;
  effective_accuracy_meters: number | null;
  effective_position_source: Position["source"];
};

export type TaxonRow = {
  id: string;
  preferred_name: string;
  scientific_name: string;
  synonyms: string;
  taxon_rank: string;
  status: string;
};

export type TaxonomyManifestRow = {
  key: string;
  value: string;
};

export type DraftRow = {
  key: string;
  value_json: string;
};
