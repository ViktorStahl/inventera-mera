import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

import taxonomyManifest from "@/data/generated/dyntaxaVascularPlants.manifest.json";
import { findTaxonomy, VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import {
  assertSupportedObservationAmount,
  isObservationUnit,
  isSupportedObservationAmount,
  OBSERVATION_UNITS,
  type ObservationAmount,
} from "@/domain/amount";
import type {
  AppSettings,
  LocaleListItem,
  Observation,
  Position,
  Region,
  SpeciesList,
  SpeciesListEntry,
  SpeciesListSummary,
  SpeciesSnapshot,
  Survey,
  SurveyBackup,
  SurveyDraft,
  SurveyListItem,
  SurveyLocale,
  Taxon,
  TaxonomyReference,
} from "@/domain/models";
import { normalizeSpeciesName, speciesKey } from "@/domain/species";
import { migrateLegacyObservations, type LegacyObservation } from "./migrateLocales";

const DATABASE_NAME = "inventera-mera.db";
const SCHEMA_VERSION = 3;
const TAXONOMY_DATABASE_NAME = `dyntaxa-vascular-plants-${taxonomyManifest.version}.db`;
const TAXONOMY_DATABASE_ASSET = require(
  "../../assets/taxonomies/dyntaxa-vascular-plants.db",
) as number;

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;
let taxonomyDatabasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

type LocaleInput = Omit<SurveyLocale, "id" | "createdAt" | "updatedAt">;
type ObservationInput = Omit<Observation, "id" | "createdAt" | "updatedAt">;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) databasePromise = openAndMigrate();
  return databasePromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const version = versionRow?.user_version ?? 0;
  if (version > SCHEMA_VERSION) {
    throw new Error("Databasen skapades av en nyare version av Inventera mera.");
  }
  if (version < 1) await migrateToVersionOne(database);
  if (version < 2) await migrateToVersionTwo(database);
  if (version < 3) await migrateToVersionThree(database);
  await deleteUnsupportedAmountData(database);
  return database;
}

async function deleteUnsupportedAmountData(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const placeholders = OBSERVATION_UNITS.map(() => "?").join(", ");
    await database.runAsync(
      `DELETE FROM observations
       WHERE (amount_value IS NULL AND amount_unit IS NOT NULL)
          OR (amount_value IS NOT NULL AND amount_unit IS NULL)
          OR amount_value < 0
          OR amount_unit NOT IN (${placeholders})`,
      ...OBSERVATION_UNITS,
    );

    const drafts = await database.getAllAsync<DraftRow>(
      `SELECT key, value_json FROM drafts
       WHERE key LIKE 'observation:new:%' OR key LIKE 'observation:edit:%'`,
    );
    for (const draft of drafts) {
      if (observationDraftHasSupportedUnit(draft.value_json)) continue;
      await database.runAsync("DELETE FROM drafts WHERE key = ?", draft.key);
    }
  });
}

async function getTaxonomyDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!taxonomyDatabasePromise) taxonomyDatabasePromise = openTaxonomyDatabase();
  return taxonomyDatabasePromise;
}

async function openTaxonomyDatabase(): Promise<SQLite.SQLiteDatabase> {
  await SQLite.importDatabaseFromAssetAsync(TAXONOMY_DATABASE_NAME, {
    assetId: TAXONOMY_DATABASE_ASSET,
  });
  const database = await SQLite.openDatabaseAsync(TAXONOMY_DATABASE_NAME);
  await database.execAsync("PRAGMA query_only = ON;");
  const rows = await database.getAllAsync<TaxonomyManifestRow>(
    "SELECT key, value FROM package_manifest",
  );
  const installedManifest = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  if (
    installedManifest.packageId !== taxonomyManifest.packageId ||
    installedManifest.version !== taxonomyManifest.version ||
    installedManifest.entryCount !== String(taxonomyManifest.entryCount)
  ) {
    await database.closeAsync();
    throw new Error("Det installerade taxonomipaketet har fel version eller innehåll.");
  }
  return database;
}

async function migrateToVersionOne(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      CREATE TABLE surveys (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        county_code TEXT NOT NULL,
        county_name TEXT NOT NULL,
        municipality_code TEXT,
        municipality_name TEXT,
        region_free_text TEXT,
        region_source TEXT NOT NULL,
        region_source_version TEXT NOT NULL,
        taxonomy_json TEXT,
        survey_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE observations (
        id TEXT PRIMARY KEY NOT NULL,
        survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        observed_at TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        locality_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        rt90_northing REAL NOT NULL,
        rt90_easting REAL NOT NULL,
        accuracy_meters REAL,
        position_source TEXT NOT NULL,
        species_json TEXT NOT NULL,
        amount_value REAL,
        amount_unit TEXT,
        public_comment TEXT,
        additional_observers_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (amount_value IS NULL AND amount_unit IS NULL) OR
          (amount_value IS NOT NULL AND amount_unit IS NOT NULL AND length(trim(amount_unit)) > 0)
        )
      );

      CREATE INDEX observations_survey_created
        ON observations(survey_id, created_at DESC);
      CREATE INDEX observations_survey_observed
        ON observations(survey_id, observed_at);

      CREATE TABLE drafts (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- FTS5 reserves "rank" for its hidden relevance-score column.
      CREATE VIRTUAL TABLE taxon_search USING fts5(
        id UNINDEXED,
        preferred_name,
        scientific_name,
        synonyms,
        taxon_rank UNINDEXED,
        status UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      PRAGMA user_version = 1;
    `);
  });
}

async function migrateToVersionTwo(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.withTransactionAsync(async () => {
    const legacyRows = await database.getAllAsync<LegacyObservationRow>(
      "SELECT * FROM observations ORDER BY created_at ASC",
    );
    const migrated = migrateLegacyObservations(
      legacyRows.filter(rowHasSupportedAmount).map(legacyObservationFromRow),
      () => Crypto.randomUUID(),
    );

    await database.execAsync(`
      DROP INDEX IF EXISTS observations_survey_created;
      DROP INDEX IF EXISTS observations_survey_observed;
      ALTER TABLE observations RENAME TO observations_v1;

      CREATE TABLE locales (
        id TEXT PRIMARY KEY NOT NULL,
        survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        observed_at TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        rt90_northing REAL NOT NULL,
        rt90_easting REAL NOT NULL,
        accuracy_meters REAL,
        position_source TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX locales_survey_created ON locales(survey_id, created_at ASC);
      CREATE INDEX locales_survey_name ON locales(survey_id, name COLLATE NOCASE);

      CREATE TABLE observations (
        id TEXT PRIMARY KEY NOT NULL,
        locale_id TEXT NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
        observed_at_override TEXT,
        time_zone_override TEXT,
        latitude_override REAL,
        longitude_override REAL,
        rt90_northing_override REAL,
        rt90_easting_override REAL,
        accuracy_meters_override REAL,
        position_source_override TEXT,
        species_json TEXT NOT NULL,
        amount_value REAL,
        amount_unit TEXT,
        public_comment TEXT,
        additional_observers_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (observed_at_override IS NULL AND time_zone_override IS NULL) OR
          (observed_at_override IS NOT NULL AND time_zone_override IS NOT NULL)
        ),
        CHECK (
          (position_source_override IS NULL AND latitude_override IS NULL AND
           longitude_override IS NULL AND rt90_northing_override IS NULL AND
           rt90_easting_override IS NULL AND accuracy_meters_override IS NULL) OR
          (position_source_override IS NOT NULL AND latitude_override IS NOT NULL AND
           longitude_override IS NOT NULL AND rt90_northing_override IS NOT NULL AND
           rt90_easting_override IS NOT NULL)
        ),
        CHECK (
          (amount_value IS NULL AND amount_unit IS NULL) OR
          (amount_value IS NOT NULL AND amount_unit IS NOT NULL AND length(trim(amount_unit)) > 0)
        )
      );

      CREATE INDEX observations_locale_created
        ON observations(locale_id, created_at ASC);
      CREATE INDEX observations_locale_observed
        ON observations(locale_id, observed_at_override);
    `);

    for (const locale of migrated.locales) await insertLocale(database, locale);
    for (const observation of migrated.observations) {
      await insertObservation(database, observation);
    }

    await database.execAsync(`
      DROP TABLE observations_v1;
      DELETE FROM drafts;
      PRAGMA user_version = 2;
    `);
  });
}

async function migrateToVersionThree(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      CREATE TABLE species_lists (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        taxonomy_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE species_list_entries (
        id TEXT PRIMARY KEY NOT NULL,
        species_list_id TEXT NOT NULL REFERENCES species_lists(id) ON DELETE CASCADE,
        species_key TEXT NOT NULL,
        taxon_id TEXT,
        species_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(species_list_id, species_key)
      );

      CREATE INDEX species_lists_name ON species_lists(name COLLATE NOCASE);
      CREATE INDEX species_list_entries_list_created
        ON species_list_entries(species_list_id, created_at ASC);
      CREATE INDEX species_list_entries_list_taxon
        ON species_list_entries(species_list_id, taxon_id);

      ALTER TABLE surveys ADD COLUMN species_list_id TEXT
        REFERENCES species_lists(id) ON DELETE SET NULL;

      CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
        default_taxonomy_package_id TEXT NOT NULL
      );

      INSERT INTO app_settings(id, default_taxonomy_package_id)
      VALUES (1, 'vascular-plants-starter');

      PRAGMA user_version = 3;
    `);
  });
}

export async function getAppSettings(): Promise<AppSettings> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ default_taxonomy_package_id: string }>(
    "SELECT default_taxonomy_package_id FROM app_settings WHERE id = 1",
  );
  return {
    defaultTaxonomyPackageId:
      row?.default_taxonomy_package_id ?? VASCULAR_PLANTS_TAXONOMY.packageId,
  };
}

export async function updateDefaultTaxonomy(packageId: string): Promise<void> {
  if (!findTaxonomy(packageId)) throw new Error("Taxonomin kunde inte hittas.");
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE app_settings SET default_taxonomy_package_id = ? WHERE id = 1",
    packageId,
  );
}

export async function listSpeciesLists(
  search = "",
  taxonomyPackageId?: string,
): Promise<SpeciesListSummary[]> {
  const database = await getDatabase();
  const pattern = `%${search.trim()}%`;
  const rows = await database.getAllAsync<SpeciesListRow & { species_count: number }>(
    `SELECT species_lists.*, count(species_list_entries.id) AS species_count
       FROM species_lists
       LEFT JOIN species_list_entries
         ON species_list_entries.species_list_id = species_lists.id
      WHERE species_lists.name LIKE ? COLLATE NOCASE
        AND (? IS NULL OR json_extract(species_lists.taxonomy_json, '$.packageId') = ?)
      GROUP BY species_lists.id
      ORDER BY species_lists.updated_at DESC, species_lists.name COLLATE NOCASE`,
    pattern,
    taxonomyPackageId ?? null,
    taxonomyPackageId ?? null,
  );
  return rows.map((row) => ({ ...speciesListFromRow(row), speciesCount: row.species_count }));
}

export async function getSpeciesList(id: string): Promise<SpeciesList | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<SpeciesListRow>(
    "SELECT * FROM species_lists WHERE id = ?",
    id,
  );
  return row ? speciesListFromRow(row) : null;
}

export async function createSpeciesList(
  name: string,
  taxonomyRef: TaxonomyReference,
): Promise<SpeciesList> {
  if (!name.trim()) throw new Error("Ange ett namn på artlistan.");
  if (!findTaxonomy(taxonomyRef.packageId)) throw new Error("Taxonomin kunde inte hittas.");
  const now = new Date().toISOString();
  const list: SpeciesList = {
    id: Crypto.randomUUID(),
    name: name.trim(),
    taxonomyRef: {
      packageId: taxonomyRef.packageId,
      name: taxonomyRef.name,
      version: taxonomyRef.version,
    },
    createdAt: now,
    updatedAt: now,
  };
  const database = await getDatabase();
  await insertSpeciesList(database, list);
  return list;
}

export async function renameSpeciesList(id: string, name: string): Promise<SpeciesList> {
  if (!name.trim()) throw new Error("Ange ett namn på artlistan.");
  const existing = await getSpeciesList(id);
  if (!existing) throw new Error("Artlistan kunde inte hittas.");
  const updated = { ...existing, name: name.trim(), updatedAt: new Date().toISOString() };
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE species_lists SET name = ?, updated_at = ? WHERE id = ?",
    updated.name,
    updated.updatedAt,
    id,
  );
  return updated;
}

export async function deleteSpeciesList(id: string): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync("DELETE FROM species_lists WHERE id = ?", id);
  if (result.changes !== 1) throw new Error("Artlistan kunde inte hittas.");
}

export async function listSpeciesListEntries(listId: string): Promise<SpeciesListEntry[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<SpeciesListEntryRow>(
    `SELECT * FROM species_list_entries WHERE species_list_id = ?
      ORDER BY json_extract(species_json, '$.preferredName') COLLATE NOCASE,
        json_extract(species_json, '$.enteredName') COLLATE NOCASE`,
    listId,
  );
  return rows.map(speciesListEntryFromRow);
}

export async function addSpeciesToList(
  listId: string,
  species: SpeciesSnapshot,
): Promise<SpeciesListEntry> {
  const database = await getDatabase();
  const list = await getSpeciesList(listId);
  if (!list) throw new Error("Artlistan kunde inte hittas.");
  const normalizedSpecies = normalizeSpeciesForList(list, species);
  const entry: SpeciesListEntry = {
    id: Crypto.randomUUID(),
    speciesListId: listId,
    speciesKey: speciesKey(normalizedSpecies),
    species: normalizedSpecies,
    createdAt: new Date().toISOString(),
  };
  await database.withTransactionAsync(async () => {
    await insertSpeciesListEntry(database, entry, true);
    await database.runAsync(
      "UPDATE species_lists SET updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      listId,
    );
  });
  const existing = await database.getFirstAsync<SpeciesListEntryRow>(
    "SELECT * FROM species_list_entries WHERE species_list_id = ? AND species_key = ?",
    listId,
    entry.speciesKey,
  );
  if (!existing) throw new Error("Arten kunde inte läggas till i artlistan.");
  return speciesListEntryFromRow(existing);
}

export async function removeSpeciesFromList(listId: string, entryId: string): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    "DELETE FROM species_list_entries WHERE id = ? AND species_list_id = ?",
    entryId,
    listId,
  );
  if (result.changes !== 1) throw new Error("Arten kunde inte hittas i artlistan.");
  await database.runAsync(
    "UPDATE species_lists SET updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    listId,
  );
}

export async function speciesListContains(
  listId: string,
  species: SpeciesSnapshot,
): Promise<boolean> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ found: number }>(
    `SELECT EXISTS(SELECT 1 FROM species_list_entries
      WHERE species_list_id = ? AND species_key = ?) AS found`,
    listId,
    speciesKey(species),
  );
  return row?.found === 1;
}

export async function listSurveys(search = ""): Promise<SurveyListItem[]> {
  const database = await getDatabase();
  const pattern = `%${search.trim()}%`;
  const rows = await database.getAllAsync<
    SurveyRow & { locale_count: number; observation_count: number }
  >(
    `SELECT surveys.*, count(DISTINCT locales.id) AS locale_count,
            count(observations.id) AS observation_count
       FROM surveys
       LEFT JOIN locales ON locales.survey_id = surveys.id
       LEFT JOIN observations ON observations.locale_id = locales.id
      WHERE surveys.status = 'active'
        AND (? = '%%' OR surveys.title LIKE ? COLLATE NOCASE
          OR coalesce(surveys.description, '') LIKE ? COLLATE NOCASE
          OR surveys.county_name LIKE ? COLLATE NOCASE
          OR coalesce(surveys.municipality_name, '') LIKE ? COLLATE NOCASE
          OR coalesce(surveys.region_free_text, '') LIKE ? COLLATE NOCASE
          OR EXISTS (SELECT 1 FROM locales search_locales
              WHERE search_locales.survey_id = surveys.id
                AND search_locales.name LIKE ? COLLATE NOCASE))
      GROUP BY surveys.id
      ORDER BY surveys.updated_at DESC`,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
  );
  return rows.map((row) => ({
    ...surveyFromRow(row),
    localeCount: row.locale_count,
    observationCount: row.observation_count,
  }));
}

export async function getSurvey(id: string): Promise<Survey | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<SurveyRow>(
    "SELECT * FROM surveys WHERE id = ?",
    id,
  );
  return row ? surveyFromRow(row) : null;
}

export async function createSurvey(draft: SurveyDraft, region: Region): Promise<Survey> {
  const database = await getDatabase();
  const taxonomy = findTaxonomy(draft.taxonomyPackageId);
  if (!taxonomy) throw new Error("Taxonomin kunde inte hittas.");
  const speciesList = draft.speciesListId ? await getSpeciesList(draft.speciesListId) : null;
  if (draft.speciesListId && !speciesList) throw new Error("Artlistan kunde inte hittas.");
  if (speciesList && speciesList.taxonomyRef.packageId !== taxonomy.packageId) {
    throw new Error("Artlistan använder en annan taxonomi.");
  }
  const now = new Date().toISOString();
  const survey: Survey = {
    id: Crypto.randomUUID(),
    title: draft.title.trim(),
    description: optionalText(draft.description),
    region,
    taxonomyRef: taxonomyReference(taxonomy),
    speciesListId: speciesList?.id,
    surveyDate: draft.surveyDate,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await insertSurvey(database, survey);
  await deleteDraft("survey:new");
  return survey;
}

export async function updateSurvey(
  id: string,
  draft: SurveyDraft,
  region: Region,
): Promise<Survey> {
  const database = await getDatabase();
  const existing = await getSurvey(id);
  if (!existing) throw new Error("Inventeringen kunde inte hittas.");
  const taxonomy = findTaxonomy(draft.taxonomyPackageId);
  if (!taxonomy) throw new Error("Taxonomin kunde inte hittas.");
  const speciesList = draft.speciesListId ? await getSpeciesList(draft.speciesListId) : null;
  if (draft.speciesListId && !speciesList) throw new Error("Artlistan kunde inte hittas.");
  if (speciesList && speciesList.taxonomyRef.packageId !== taxonomy.packageId) {
    throw new Error("Artlistan använder en annan taxonomi.");
  }
  const updated: Survey = {
    ...existing,
    title: draft.title.trim(),
    description: optionalText(draft.description),
    region,
    taxonomyRef: taxonomyReference(taxonomy),
    speciesListId: speciesList?.id,
    surveyDate: draft.surveyDate,
    updatedAt: new Date().toISOString(),
  };
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      `UPDATE surveys SET
        title = ?, description = ?, county_code = ?, county_name = ?,
        municipality_code = ?, municipality_name = ?, region_free_text = ?,
        region_source = ?, region_source_version = ?, taxonomy_json = ?,
        species_list_id = ?, survey_date = ?, updated_at = ?
       WHERE id = ?`,
      updated.title,
      updated.description ?? null,
      updated.region.countyCode,
      updated.region.countyName,
      updated.region.municipalityCode ?? null,
      updated.region.municipalityName ?? null,
      updated.region.freeText ?? null,
      updated.region.source,
      updated.region.sourceVersion,
      JSON.stringify(updated.taxonomyRef),
      updated.speciesListId ?? null,
      updated.surveyDate,
      updated.updatedAt,
      updated.id,
    );
    if (result.changes !== 1) throw new Error("Inventeringen kunde inte hittas.");
    await database.runAsync("DELETE FROM drafts WHERE key = ?", surveyEditDraftKey(id));
  });
  return updated;
}

export async function deleteSurvey(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync("DELETE FROM surveys WHERE id = ?", id);
    if (result.changes !== 1) throw new Error("Inventeringen kunde inte hittas.");
    await database.runAsync(
      `DELETE FROM drafts WHERE key = ? OR key = ? OR key LIKE ? OR key LIKE ?
        OR key LIKE ?`,
      surveyEditDraftKey(id),
      localeDraftKey(id),
      `${localeEditDraftPrefix(id)}%`,
      `${observationDraftPrefix(id)}%`,
      `${observationEditDraftPrefix(id)}%`,
    );
  });
}

export async function listLocales(surveyId: string): Promise<LocaleListItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocaleRow & { observation_count: number }>(
    `SELECT locales.*, count(observations.id) AS observation_count
       FROM locales
       LEFT JOIN observations ON observations.locale_id = locales.id
      WHERE locales.survey_id = ?
      GROUP BY locales.id
      ORDER BY locales.observed_at ASC, locales.created_at ASC`,
    surveyId,
  );
  return rows.map((row) => ({ ...localeFromRow(row), observationCount: row.observation_count }));
}

export async function getLocale(
  surveyId: string,
  localeId: string,
): Promise<SurveyLocale | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<LocaleRow>(
    "SELECT * FROM locales WHERE survey_id = ? AND id = ?",
    surveyId,
    localeId,
  );
  return row ? localeFromRow(row) : null;
}

export async function createLocale(input: LocaleInput): Promise<SurveyLocale> {
  const database = await getDatabase();
  if (!(await getSurvey(input.surveyId))) throw new Error("Inventeringen kunde inte hittas.");
  const now = new Date().toISOString();
  const locale: SurveyLocale = {
    ...input,
    name: input.name.trim(),
    note: optionalText(input.note ?? ""),
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await database.withTransactionAsync(async () => {
    await insertLocale(database, locale);
    await database.runAsync("UPDATE surveys SET updated_at = ? WHERE id = ?", now, input.surveyId);
    await database.runAsync("DELETE FROM drafts WHERE key = ?", localeDraftKey(input.surveyId));
  });
  return locale;
}

export async function updateLocale(localeId: string, input: LocaleInput): Promise<SurveyLocale> {
  const database = await getDatabase();
  const existing = await getLocale(input.surveyId, localeId);
  if (!existing) throw new Error("Lokalen kunde inte hittas.");
  const updated: SurveyLocale = {
    ...input,
    name: input.name.trim(),
    note: optionalText(input.note ?? ""),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await database.withTransactionAsync(async () => {
    const result = await updateLocaleRow(database, updated);
    if (result.changes !== 1) throw new Error("Lokalen kunde inte hittas.");
    await database.runAsync(
      "UPDATE surveys SET updated_at = ? WHERE id = ?",
      updated.updatedAt,
      updated.surveyId,
    );
    await database.runAsync(
      "DELETE FROM drafts WHERE key = ?",
      localeEditDraftKey(updated.surveyId, updated.id),
    );
  });
  return updated;
}

export async function deleteLocale(surveyId: string, localeId: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      "DELETE FROM locales WHERE survey_id = ? AND id = ?",
      surveyId,
      localeId,
    );
    if (result.changes !== 1) throw new Error("Lokalen kunde inte hittas.");
    await database.runAsync("UPDATE surveys SET updated_at = ? WHERE id = ?", now, surveyId);
    await database.runAsync(
      "DELETE FROM drafts WHERE key = ? OR key = ? OR key LIKE ?",
      localeEditDraftKey(surveyId, localeId),
      observationDraftKey(surveyId, localeId),
      `${observationEditDraftPrefix(surveyId, localeId)}%`,
    );
  });
}

const OBSERVATION_SELECT = `SELECT observations.*,
    locales.survey_id, locales.name AS locale_name,
    coalesce(observations.observed_at_override, locales.observed_at) AS effective_observed_at,
    coalesce(observations.time_zone_override, locales.time_zone) AS effective_time_zone,
    coalesce(observations.latitude_override, locales.latitude) AS effective_latitude,
    coalesce(observations.longitude_override, locales.longitude) AS effective_longitude,
    coalesce(observations.rt90_northing_override, locales.rt90_northing) AS effective_rt90_northing,
    coalesce(observations.rt90_easting_override, locales.rt90_easting) AS effective_rt90_easting,
    CASE WHEN observations.position_source_override IS NULL
      THEN locales.accuracy_meters ELSE observations.accuracy_meters_override END
      AS effective_accuracy_meters,
    coalesce(observations.position_source_override, locales.position_source)
      AS effective_position_source
  FROM observations JOIN locales ON locales.id = observations.locale_id`;

export async function listObservations(surveyId: string): Promise<Observation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ObservationRow>(
    `${OBSERVATION_SELECT}
      WHERE locales.survey_id = ?
      ORDER BY effective_observed_at ASC, observations.created_at ASC`,
    surveyId,
  );
  return rows.map(observationFromRow);
}

export async function listLocaleObservations(localeId: string): Promise<Observation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ObservationRow>(
    `${OBSERVATION_SELECT}
      WHERE observations.locale_id = ?
      ORDER BY effective_observed_at ASC, observations.created_at ASC`,
    localeId,
  );
  return rows.map(observationFromRow);
}

export async function getObservation(
  surveyId: string,
  observationId: string,
): Promise<Observation | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ObservationRow>(
    `${OBSERVATION_SELECT}
      WHERE locales.survey_id = ? AND observations.id = ?`,
    surveyId,
    observationId,
  );
  return row ? observationFromRow(row) : null;
}

export async function createObservation(
  input: ObservationInput,
  addToSpeciesListId?: string,
): Promise<Observation> {
  assertSupportedObservationAmount(input.amount);
  const database = await getDatabase();
  const [locale, speciesList] = await Promise.all([
    getLocale(input.surveyId, input.localeId),
    addToSpeciesListId ? getSpeciesList(addToSpeciesListId) : Promise.resolve(null),
  ]);
  if (!locale) throw new Error("Lokalen kunde inte hittas.");
  if (addToSpeciesListId) await assertSurveySpeciesList(input.surveyId, addToSpeciesListId, speciesList);
  const now = new Date().toISOString();
  const saved: Observation = {
    ...resolveObservationInput(input, locale),
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await database.withTransactionAsync(async () => {
    await insertObservation(database, saved);
    if (speciesList) {
      await insertSpeciesListEntry(
        database,
        newSpeciesListEntry(speciesList.id, normalizeSpeciesForList(speciesList, saved.species)),
        true,
      );
      await database.runAsync("UPDATE species_lists SET updated_at = ? WHERE id = ?", now, speciesList.id);
    }
    await database.runAsync("UPDATE surveys SET updated_at = ? WHERE id = ?", now, saved.surveyId);
    await database.runAsync(
      "DELETE FROM drafts WHERE key = ?",
      observationDraftKey(saved.surveyId, saved.localeId),
    );
  });
  return saved;
}

export async function updateObservation(
  observationId: string,
  input: ObservationInput,
  addToSpeciesListId?: string,
): Promise<Observation> {
  assertSupportedObservationAmount(input.amount);
  const database = await getDatabase();
  const [existing, locale, speciesList] = await Promise.all([
    getObservation(input.surveyId, observationId),
    getLocale(input.surveyId, input.localeId),
    addToSpeciesListId ? getSpeciesList(addToSpeciesListId) : Promise.resolve(null),
  ]);
  if (!existing) throw new Error("Observationen kunde inte hittas.");
  if (!locale) throw new Error("Lokalen kunde inte hittas.");
  if (addToSpeciesListId) await assertSurveySpeciesList(input.surveyId, addToSpeciesListId, speciesList);
  const updated: Observation = {
    ...resolveObservationInput(input, locale),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await database.withTransactionAsync(async () => {
    const result = await updateObservationRow(database, updated);
    if (result.changes !== 1) throw new Error("Observationen kunde inte hittas.");
    if (speciesList) {
      await insertSpeciesListEntry(
        database,
        newSpeciesListEntry(speciesList.id, normalizeSpeciesForList(speciesList, updated.species)),
        true,
      );
      await database.runAsync(
        "UPDATE species_lists SET updated_at = ? WHERE id = ?",
        updated.updatedAt,
        speciesList.id,
      );
    }
    await database.runAsync(
      "UPDATE surveys SET updated_at = ? WHERE id = ?",
      updated.updatedAt,
      updated.surveyId,
    );
    await database.runAsync(
      "DELETE FROM drafts WHERE key = ?",
      observationEditDraftKey(updated.surveyId, updated.localeId, updated.id),
    );
  });
  return updated;
}

export async function deleteObservation(
  surveyId: string,
  observationId: string,
): Promise<void> {
  const database = await getDatabase();
  const existing = await getObservation(surveyId, observationId);
  if (!existing) throw new Error("Observationen kunde inte hittas.");
  const now = new Date().toISOString();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      `DELETE FROM observations WHERE id = ? AND locale_id IN
        (SELECT id FROM locales WHERE survey_id = ?)`,
      observationId,
      surveyId,
    );
    if (result.changes !== 1) throw new Error("Observationen kunde inte hittas.");
    await database.runAsync("UPDATE surveys SET updated_at = ? WHERE id = ?", now, surveyId);
    await database.runAsync(
      "DELETE FROM drafts WHERE key = ?",
      observationEditDraftKey(surveyId, existing.localeId, observationId),
    );
  });
}

export async function searchTaxa(
  query: string,
  limit = 20,
  speciesListId?: string,
  taxonomyPackageId = VASCULAR_PLANTS_TAXONOMY.packageId,
): Promise<Taxon[]> {
  if (!findTaxonomy(taxonomyPackageId)) return [];
  const selectedSpeciesList = speciesListId ? await getSpeciesList(speciesListId) : null;
  if (
    speciesListId &&
    (!selectedSpeciesList || selectedSpeciesList.taxonomyRef.packageId !== taxonomyPackageId)
  ) return [];
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(Boolean);
  if (terms.length === 0) return [];
  const match = terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" AND ");
  const listEntries = selectedSpeciesList
    ? await listSpeciesListEntries(selectedSpeciesList.id)
    : [];
  const listTaxonIds = new Set(
    listEntries
      .map((entry) => entry.species.taxonId)
      .filter((taxonId): taxonId is string => Boolean(taxonId)),
  );
  const listMatches = listEntries
    .filter((entry) => speciesSnapshotMatches(entry.species, terms))
    .map(speciesListEntryToTaxon);
  const taxonomyDatabase = await getTaxonomyDatabase();
  const rows = await taxonomyDatabase.getAllAsync<TaxonRow>(
    `SELECT id, preferred_name, scientific_name, synonyms, taxon_rank, status
       FROM taxon_search WHERE taxon_search MATCH ?
       ORDER BY bm25(taxon_search), preferred_name COLLATE NOCASE
       LIMIT ?`,
    match,
    Math.max(limit * 4, limit),
  );
  const taxonomyMatches: Taxon[] = rows
    .filter((row) => !listTaxonIds.has(row.id))
    .map((row) => ({
      id: row.id,
      source: "taxonomy",
      preferredName: row.preferred_name,
      scientificName: row.scientific_name,
      synonyms: row.synonyms ? row.synonyms.split(" | ") : [],
      rank: row.taxon_rank,
      status: row.status,
      inSpeciesList: false,
    }));
  return [...listMatches, ...taxonomyMatches]
    .sort((left, right) =>
      Number(Boolean(right.inSpeciesList)) - Number(Boolean(left.inSpeciesList)) ||
      taxonMatchScore(left, terms) - taxonMatchScore(right, terms) ||
      left.preferredName.localeCompare(right.preferredName, "sv"),
    )
    .slice(0, limit);
}

function speciesSnapshotMatches(species: SpeciesSnapshot, terms: string[]): boolean {
  const searchable = normalizeSpeciesName([
    species.enteredName,
    species.preferredName,
    species.scientificName,
  ].filter(Boolean).join(" "));
  return terms.every((term) => searchable.includes(normalizeSpeciesName(term)));
}

function speciesListEntryToTaxon(entry: SpeciesListEntry): Taxon {
  const { species } = entry;
  return {
    id: species.taxonId ?? `species-list-entry:${entry.id}`,
    source: species.source,
    preferredName: species.preferredName ?? species.enteredName,
    scientificName: species.scientificName ?? "",
    synonyms: [],
    rank: species.source === "free-text" ? "fritext" : "",
    status: "artlista",
    inSpeciesList: true,
    speciesListEntryId: entry.id,
    taxonomyPackageId: species.taxonomyPackageId,
    taxonomyVersion: species.taxonomyVersion,
  };
}

function taxonMatchScore(taxon: Taxon, terms: string[]): number {
  const normalizedTerms = terms.map(normalizeSpeciesName);
  const query = normalizedTerms.join(" ");
  const preferred = normalizeSpeciesName(taxon.preferredName);
  const scientific = normalizeSpeciesName(taxon.scientificName);
  if (preferred === query || scientific === query) return 0;
  if (preferred.startsWith(query) || scientific.startsWith(query)) return 1;
  if (
    preferred.split(/\s+/).some((word) => word.startsWith(normalizedTerms[0] ?? "")) ||
    scientific.split(/\s+/).some((word) => word.startsWith(normalizedTerms[0] ?? ""))
  ) return 2;
  if (preferred.includes(query) || scientific.includes(query)) return 3;
  return 4;
}

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO drafts(key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value_json: string }>(
    "SELECT value_json FROM drafts WHERE key = ?",
    key,
  );
  return row ? (JSON.parse(row.value_json) as T) : null;
}

export async function deleteDraft(key: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM drafts WHERE key = ?", key);
}

export function surveyEditDraftKey(surveyId: string): string {
  return `survey:edit:${surveyId}`;
}

export function localeDraftKey(surveyId: string): string {
  return `locale:new:${surveyId}`;
}

export function localeEditDraftKey(surveyId: string, localeId: string): string {
  return `${localeEditDraftPrefix(surveyId)}${localeId}`;
}

function localeEditDraftPrefix(surveyId: string): string {
  return `locale:edit:${surveyId}:`;
}

export function observationDraftKey(surveyId: string, localeId: string): string {
  return `${observationDraftPrefix(surveyId)}${localeId}`;
}

function observationDraftPrefix(surveyId: string): string {
  return `observation:new:${surveyId}:`;
}

export function observationEditDraftKey(
  surveyId: string,
  localeId: string,
  observationId: string,
): string {
  return `${observationEditDraftPrefix(surveyId, localeId)}${observationId}`;
}

function observationEditDraftPrefix(surveyId: string, localeId = ""): string {
  return `observation:edit:${surveyId}:${localeId}` + (localeId ? ":" : "");
}

export async function buildSurveyBackup(surveyId: string): Promise<SurveyBackup> {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  const speciesList = survey.speciesListId
    ? await getSpeciesList(survey.speciesListId)
    : null;
  return {
    format: "inventera-mera-backup",
    formatVersion: 3,
    exportedAt: new Date().toISOString(),
    survey,
    locales: (await listLocales(surveyId)).map(({ observationCount: _, ...locale }) => locale),
    observations: await listObservations(surveyId),
    speciesList: speciesList
      ? { list: speciesList, entries: await listSpeciesListEntries(speciesList.id) }
      : undefined,
  };
}

export async function restoreSurveyBackup(value: unknown): Promise<string> {
  const backup = normalizeBackup(value);
  const database = await getDatabase();
  const existingSpeciesList = backup.speciesList
    ? await getSpeciesList(backup.speciesList.list.id)
    : null;
  if (
    existingSpeciesList &&
    existingSpeciesList.taxonomyRef.packageId !== backup.speciesList?.list.taxonomyRef.packageId
  ) {
    throw new Error("En lokal artlista med samma ID använder en annan taxonomi.");
  }
  await database.withTransactionAsync(async () => {
    if (backup.speciesList) {
      if (!existingSpeciesList) await insertSpeciesList(database, backup.speciesList.list);
      for (const entry of backup.speciesList.entries) {
        const duplicate = await database.getFirstAsync<{ id: string }>(
          "SELECT id FROM species_list_entries WHERE species_list_id = ? AND species_key = ?",
          entry.speciesListId,
          entry.speciesKey,
        );
        if (duplicate) continue;
        const idCollision = await database.getFirstAsync<{ id: string }>(
          "SELECT id FROM species_list_entries WHERE id = ?",
          entry.id,
        );
        await insertSpeciesListEntry(
          database,
          idCollision ? { ...entry, id: Crypto.randomUUID() } : entry,
        );
      }
    }
    await database.runAsync("DELETE FROM surveys WHERE id = ?", backup.survey.id);
    await insertSurvey(database, backup.survey);
    for (const locale of backup.locales) await insertLocale(database, locale);
    for (const observation of backup.observations) await insertObservation(database, observation);
    await database.runAsync(
      `DELETE FROM drafts WHERE key = ? OR key = ? OR key LIKE ? OR key LIKE ?
        OR key LIKE ?`,
      surveyEditDraftKey(backup.survey.id),
      localeDraftKey(backup.survey.id),
      `${localeEditDraftPrefix(backup.survey.id)}%`,
      `${observationDraftPrefix(backup.survey.id)}%`,
      `${observationEditDraftPrefix(backup.survey.id)}%`,
    );
  });
  return backup.survey.id;
}

function normalizeBackup(value: unknown): SurveyBackup {
  if (!value || typeof value !== "object") throw new Error("Filen är inte en giltig backup.");
  const backup = value as Record<string, unknown>;
  if (backup.format !== "inventera-mera-backup" || !backup.survey) {
    throw new Error("Backupformatet stöds inte.");
  }
  const survey = backup.survey as Survey;
  if (backup.formatVersion === 1 && Array.isArray(backup.observations)) {
    const migrated = migrateLegacyObservations(
      (backup.observations as LegacyObservation[]).filter((observation) =>
        isSupportedObservationAmount(observation.amount),
      ),
      () => Crypto.randomUUID(),
    );
    return {
      format: "inventera-mera-backup",
      formatVersion: 3,
      exportedAt:
        typeof backup.exportedAt === "string" ? backup.exportedAt : new Date().toISOString(),
      survey,
      locales: migrated.locales,
      observations: migrated.observations,
    };
  }
  if (
    backup.formatVersion === 2 &&
    Array.isArray(backup.locales) &&
    Array.isArray(backup.observations)
  ) {
    return {
      format: "inventera-mera-backup",
      formatVersion: 3,
      exportedAt:
        typeof backup.exportedAt === "string" ? backup.exportedAt : new Date().toISOString(),
      survey,
      locales: backup.locales as SurveyLocale[],
      observations: (backup.observations as Observation[]).filter((observation) =>
        isSupportedObservationAmount(observation.amount),
      ),
    };
  }
  if (
    backup.formatVersion !== 3 ||
    !Array.isArray(backup.locales) ||
    !Array.isArray(backup.observations)
  ) {
    throw new Error("Backupformatet stöds inte.");
  }
  if (
    backup.speciesList !== undefined &&
    (
      !backup.speciesList ||
      typeof backup.speciesList !== "object" ||
      !(backup.speciesList as Record<string, unknown>).list ||
      !Array.isArray((backup.speciesList as Record<string, unknown>).entries)
    )
  ) {
    throw new Error("Backupens artlista är ogiltig.");
  }
  const normalized = backup as unknown as SurveyBackup;
  if (normalized.locales.some((locale) => locale.surveyId !== survey.id)) {
    throw new Error("Backupen innehåller lokaler från en annan inventering.");
  }
  const localeIds = new Set(normalized.locales.map((locale) => locale.id));
  if (
    normalized.observations.some(
      (observation) =>
        observation.surveyId !== survey.id || !localeIds.has(observation.localeId),
    )
  ) {
    throw new Error("Backupen innehåller observationer från en annan inventering.");
  }
  if (
    normalized.survey.speciesListId &&
    normalized.speciesList?.list.id !== normalized.survey.speciesListId
  ) {
    throw new Error("Backupen saknar inventeringens artlista.");
  }
  if (!normalized.survey.speciesListId && normalized.speciesList) {
    throw new Error("Backupen innehåller en artlista som inte hör till inventeringen.");
  }
  if (normalized.speciesList) {
    const { list, entries } = normalized.speciesList;
    if (list.taxonomyRef.packageId !== normalized.survey.taxonomyRef?.packageId) {
      throw new Error("Backupens artlista använder en annan taxonomi än inventeringen.");
    }
    if (
      entries.some(
        (entry) =>
          entry.speciesListId !== list.id ||
          entry.speciesKey !== speciesKey(normalizeSpeciesForList(list, entry.species)),
      )
    ) {
      throw new Error("Backupen innehåller ogiltiga poster i artlistan.");
    }
  }
  return {
    ...normalized,
    observations: normalized.observations.filter((observation) =>
      isSupportedObservationAmount(observation.amount),
    ),
  };
}

async function assertSurveySpeciesList(
  surveyId: string,
  listId: string,
  list: SpeciesList | null,
): Promise<void> {
  const survey = await getSurvey(surveyId);
  if (!survey || survey.speciesListId !== listId || !list) {
    throw new Error("Artlistan är inte vald för inventeringen.");
  }
}

function newSpeciesListEntry(
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

function normalizeSpeciesForList(
  list: SpeciesList,
  species: SpeciesSnapshot,
): SpeciesSnapshot {
  if (species.source === "free-text") return species;
  if (!species.taxonId) throw new Error("En taxonomiart måste ha ett taxon-ID.");
  if (
    species.taxonomyPackageId &&
    species.taxonomyPackageId !== list.taxonomyRef.packageId
  ) {
    throw new Error("Arten kommer från en annan taxonomi än artlistan.");
  }
  return {
    ...species,
    taxonomyPackageId: list.taxonomyRef.packageId,
    taxonomyVersion: species.taxonomyVersion ?? list.taxonomyRef.version,
  };
}

async function insertSpeciesList(
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

async function insertSpeciesListEntry(
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

async function insertSurvey(
  database: SQLite.SQLiteDatabase,
  survey: Survey,
  replace = false,
): Promise<void> {
  const command = replace ? "INSERT OR REPLACE" : "INSERT";
  await database.runAsync(
    `${command} INTO surveys (
      id, title, description, county_code, county_name, municipality_code,
      municipality_name, region_free_text, region_source,
      region_source_version, taxonomy_json, species_list_id, survey_date, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    survey.id,
    survey.title,
    survey.description ?? null,
    survey.region.countyCode,
    survey.region.countyName,
    survey.region.municipalityCode ?? null,
    survey.region.municipalityName ?? null,
    survey.region.freeText ?? null,
    survey.region.source,
    survey.region.sourceVersion,
    survey.taxonomyRef ? JSON.stringify(survey.taxonomyRef) : null,
    survey.speciesListId ?? null,
    survey.surveyDate,
    survey.status,
    survey.createdAt,
    survey.updatedAt,
  );
}

async function insertLocale(
  database: SQLite.SQLiteDatabase,
  locale: SurveyLocale,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO locales (
      id, survey_id, name, observed_at, time_zone, latitude, longitude,
      rt90_northing, rt90_easting, accuracy_meters, position_source, note,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    locale.createdAt,
    locale.updatedAt,
  );
}

async function updateLocaleRow(
  database: SQLite.SQLiteDatabase,
  locale: SurveyLocale,
): Promise<SQLite.SQLiteRunResult> {
  return database.runAsync(
    `UPDATE locales SET name = ?, observed_at = ?, time_zone = ?, latitude = ?,
      longitude = ?, rt90_northing = ?, rt90_easting = ?, accuracy_meters = ?,
      position_source = ?, note = ?, updated_at = ?
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
    locale.updatedAt,
    locale.id,
    locale.surveyId,
  );
}

async function insertObservation(
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

async function updateObservationRow(
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

function resolveObservationInput(input: ObservationInput, locale: SurveyLocale): ObservationInput {
  return {
    ...input,
    surveyId: locale.surveyId,
    localeId: locale.id,
    localityName: locale.name,
    observedAt: input.timeOverridden ? input.observedAt : locale.observedAt,
    timeZone: input.timeOverridden ? input.timeZone : locale.timeZone,
    position: input.positionOverridden ? input.position : locale.position,
  };
}

function surveyFromRow(row: SurveyRow): Survey {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    region: {
      countyCode: row.county_code,
      countyName: row.county_name,
      municipalityCode: row.municipality_code ?? undefined,
      municipalityName: row.municipality_name ?? undefined,
      freeText: row.region_free_text ?? undefined,
      source: "SCB",
      sourceVersion: "2026",
    },
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

function speciesListFromRow(row: SpeciesListRow): SpeciesList {
  return {
    id: row.id,
    name: row.name,
    taxonomyRef: JSON.parse(row.taxonomy_json) as TaxonomyReference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function speciesListEntryFromRow(row: SpeciesListEntryRow): SpeciesListEntry {
  return {
    id: row.id,
    speciesListId: row.species_list_id,
    speciesKey: row.species_key,
    species: JSON.parse(row.species_json) as SpeciesSnapshot,
    createdAt: row.created_at,
  };
}

function localeFromRow(row: LocaleRow): SurveyLocale {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function observationFromRow(row: ObservationRow): Observation {
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

function legacyObservationFromRow(row: LegacyObservationRow): LegacyObservation {
  return {
    id: row.id,
    surveyId: row.survey_id,
    observedAt: row.observed_at,
    timeZone: row.time_zone,
    localityName: row.locality_name,
    position: positionFromValues(
      row.latitude,
      row.longitude,
      row.rt90_northing,
      row.rt90_easting,
      row.accuracy_meters,
      row.position_source,
    ),
    species: JSON.parse(row.species_json) as SpeciesSnapshot,
    amount: amountFromValues(row.amount_value, row.amount_unit),
    publicComment: row.public_comment ?? undefined,
    additionalObservers: JSON.parse(row.additional_observers_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

function rowHasSupportedAmount(row: {
  amount_value: number | null;
  amount_unit: string | null;
}): boolean {
  if (row.amount_value == null && row.amount_unit == null) return true;
  return isSupportedObservationAmount({
    value: row.amount_value,
    unit: row.amount_unit,
  });
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

function observationDraftHasSupportedUnit(valueJson: string): boolean {
  try {
    const value = JSON.parse(valueJson) as unknown;
    if (!value || typeof value !== "object") return false;
    const unit = (value as { unit?: unknown }).unit;
    return unit === undefined || unit === "" || isObservationUnit(unit);
  } catch {
    return false;
  }
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function taxonomyReference(taxonomy: TaxonomyReference): TaxonomyReference {
  return {
    packageId: taxonomy.packageId,
    name: taxonomy.name,
    version: taxonomy.version,
  };
}

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  county_code: string;
  county_name: string;
  municipality_code: string | null;
  municipality_name: string | null;
  region_free_text: string | null;
  region_source: string;
  region_source_version: string;
  taxonomy_json: string | null;
  species_list_id: string | null;
  survey_date: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type SpeciesListRow = {
  id: string;
  name: string;
  taxonomy_json: string;
  created_at: string;
  updated_at: string;
};

type SpeciesListEntryRow = {
  id: string;
  species_list_id: string;
  species_key: string;
  taxon_id: string | null;
  species_json: string;
  created_at: string;
};

type LocaleRow = {
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
  created_at: string;
  updated_at: string;
};

type ObservationRow = {
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

type LegacyObservationRow = {
  id: string;
  survey_id: string;
  observed_at: string;
  time_zone: string;
  locality_name: string;
  latitude: number;
  longitude: number;
  rt90_northing: number;
  rt90_easting: number;
  accuracy_meters: number | null;
  position_source: Position["source"];
  species_json: string;
  amount_value: number | null;
  amount_unit: string | null;
  public_comment: string | null;
  additional_observers_json: string;
  created_at: string;
  updated_at: string;
};

type TaxonRow = {
  id: string;
  preferred_name: string;
  scientific_name: string;
  synonyms: string;
  taxon_rank: string;
  status: string;
};

type TaxonomyManifestRow = {
  key: string;
  value: string;
};

type DraftRow = {
  key: string;
  value_json: string;
};
