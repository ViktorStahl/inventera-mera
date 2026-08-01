import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

import { SEED_TAXA } from "@/data/seedTaxa";
import type {
  Observation,
  Region,
  SpeciesSnapshot,
  Survey,
  SurveyBackup,
  SurveyDraft,
  SurveyListItem,
  Taxon,
  TaxonomyReference,
} from "@/domain/models";

const DATABASE_NAME = "inventera-mera.db";
const SCHEMA_VERSION = 1;

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

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
  await seedTaxonomy(database);
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

async function seedTaxonomy(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT count(*) AS count FROM taxon_search",
  );
  if ((row?.count ?? 0) > 0) return;
  await database.withTransactionAsync(async () => {
    for (const taxon of SEED_TAXA) {
      await database.runAsync(
        `INSERT INTO taxon_search
         (id, preferred_name, scientific_name, synonyms, taxon_rank, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        taxon.id,
        taxon.preferredName,
        taxon.scientificName,
        taxon.synonyms.join(" | "),
        taxon.rank,
        taxon.status,
      );
    }
  });
}

export async function listSurveys(search = ""): Promise<SurveyListItem[]> {
  const database = await getDatabase();
  const pattern = `%${search.trim()}%`;
  const rows = await database.getAllAsync<SurveyRow & { observation_count: number }>(
    `SELECT surveys.*, count(observations.id) AS observation_count
       FROM surveys
       LEFT JOIN observations ON observations.survey_id = surveys.id
      WHERE surveys.status = 'active'
        AND (? = '%%' OR surveys.title LIKE ? COLLATE NOCASE
          OR surveys.county_name LIKE ? COLLATE NOCASE
          OR coalesce(surveys.municipality_name, '') LIKE ? COLLATE NOCASE
          OR coalesce(surveys.region_free_text, '') LIKE ? COLLATE NOCASE)
      GROUP BY surveys.id
      ORDER BY surveys.updated_at DESC`,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
  );
  return rows.map((row) => ({
    ...surveyFromRow(row),
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

export async function createSurvey(
  draft: SurveyDraft,
  region: Region,
): Promise<Survey> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const survey: Survey = {
    id: Crypto.randomUUID(),
    title: draft.title.trim(),
    description: optionalText(draft.description),
    region,
    taxonomyRef: {
      packageId: "vascular-plants-starter",
      name: "Kärlväxter – startlista",
      version: "2026-07-mvp",
    },
    surveyDate: draft.surveyDate,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await insertSurvey(database, survey);
  await deleteDraft("survey:new");
  return survey;
}

export async function listObservations(surveyId: string): Promise<Observation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ObservationRow>(
    "SELECT * FROM observations WHERE survey_id = ? ORDER BY observed_at ASC, created_at ASC",
    surveyId,
  );
  return rows.map(observationFromRow);
}

export async function getLastLocalityName(surveyId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ locality_name: string }>(
    `SELECT locality_name FROM observations
      WHERE survey_id = ? ORDER BY created_at DESC LIMIT 1`,
    surveyId,
  );
  return row?.locality_name ?? null;
}

export async function createObservation(
  observation: Omit<Observation, "id" | "createdAt" | "updatedAt">,
): Promise<Observation> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const saved: Observation = {
    ...observation,
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await database.withTransactionAsync(async () => {
    await insertObservation(database, saved);
    await database.runAsync(
      "UPDATE surveys SET updated_at = ? WHERE id = ?",
      now,
      saved.surveyId,
    );
    await database.runAsync("DELETE FROM drafts WHERE key = ?", observationDraftKey(saved.surveyId));
  });
  return saved;
}

export async function searchTaxa(query: string, limit = 20): Promise<Taxon[]> {
  const database = await getDatabase();
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(Boolean);
  if (terms.length === 0) return [];
  const match = terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" AND ");
  const rows = await database.getAllAsync<TaxonRow>(
    `SELECT id, preferred_name, scientific_name, synonyms, taxon_rank, status
       FROM taxon_search WHERE taxon_search MATCH ? LIMIT ?`,
    match,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    preferredName: row.preferred_name,
    scientificName: row.scientific_name,
    synonyms: row.synonyms ? row.synonyms.split(" | ") : [],
    rank: row.taxon_rank,
    status: row.status,
  }));
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

export function observationDraftKey(surveyId: string): string {
  return `observation:new:${surveyId}`;
}

export async function buildSurveyBackup(surveyId: string): Promise<SurveyBackup> {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  return {
    format: "inventera-mera-backup",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    survey,
    observations: await listObservations(surveyId),
  };
}

export async function restoreSurveyBackup(value: unknown): Promise<string> {
  const backup = validateBackup(value);
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await insertSurvey(database, backup.survey, true);
    await database.runAsync(
      "DELETE FROM observations WHERE survey_id = ?",
      backup.survey.id,
    );
    for (const observation of backup.observations) {
      await insertObservation(database, observation);
    }
  });
  return backup.survey.id;
}

function validateBackup(value: unknown): SurveyBackup {
  if (!value || typeof value !== "object") throw new Error("Filen är inte en giltig backup.");
  const backup = value as Partial<SurveyBackup>;
  if (
    backup.format !== "inventera-mera-backup" ||
    backup.formatVersion !== 1 ||
    !backup.survey ||
    !Array.isArray(backup.observations)
  ) {
    throw new Error("Backupformatet stöds inte.");
  }
  if (backup.observations.some((item) => item.surveyId !== backup.survey?.id)) {
    throw new Error("Backupen innehåller observationer från en annan inventering.");
  }
  return backup as SurveyBackup;
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
      region_source_version, taxonomy_json, survey_date, status, created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    survey.surveyDate,
    survey.status,
    survey.createdAt,
    survey.updatedAt,
  );
}

async function insertObservation(
  database: SQLite.SQLiteDatabase,
  observation: Observation,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO observations (
      id, survey_id, observed_at, time_zone, locality_name, latitude, longitude,
      rt90_northing, rt90_easting, accuracy_meters, position_source,
      species_json, amount_value, amount_unit, public_comment,
      additional_observers_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    observation.id,
    observation.surveyId,
    observation.observedAt,
    observation.timeZone,
    observation.localityName,
    observation.position.wgs84.latitude,
    observation.position.wgs84.longitude,
    observation.position.rt90.northing,
    observation.position.rt90.easting,
    observation.position.accuracyMeters ?? null,
    observation.position.source,
    JSON.stringify(observation.species),
    observation.amount?.value ?? null,
    observation.amount?.unit ?? null,
    observation.publicComment ?? null,
    JSON.stringify(observation.additionalObservers),
    observation.createdAt,
    observation.updatedAt,
  );
}

function surveyFromRow(row: SurveyRow): Survey {
  const region: Region = {
    countyCode: row.county_code,
    countyName: row.county_name,
    municipalityCode: row.municipality_code ?? undefined,
    municipalityName: row.municipality_name ?? undefined,
    freeText: row.region_free_text ?? undefined,
    source: "SCB",
    sourceVersion: "2026",
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    region,
    taxonomyRef: row.taxonomy_json
      ? (JSON.parse(row.taxonomy_json) as TaxonomyReference)
      : undefined,
    surveyDate: row.survey_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function observationFromRow(row: ObservationRow): Observation {
  const amount =
    row.amount_value == null || row.amount_unit == null
      ? undefined
      : { value: row.amount_value, unit: row.amount_unit };
  return {
    id: row.id,
    surveyId: row.survey_id,
    observedAt: row.observed_at,
    timeZone: row.time_zone,
    localityName: row.locality_name,
    position: {
      wgs84: { latitude: row.latitude, longitude: row.longitude },
      rt90: {
        northing: row.rt90_northing,
        easting: row.rt90_easting,
        crs: "EPSG:3847",
      },
      accuracyMeters: row.accuracy_meters ?? undefined,
      source: row.position_source,
    },
    species: JSON.parse(row.species_json) as SpeciesSnapshot,
    amount,
    publicComment: row.public_comment ?? undefined,
    additionalObservers: JSON.parse(row.additional_observers_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
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
  survey_date: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type ObservationRow = {
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
  position_source: "device" | "manual-rt90" | "map";
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
