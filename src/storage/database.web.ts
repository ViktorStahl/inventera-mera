import * as Crypto from "expo-crypto";

import { SEED_TAXA } from "@/data/seedTaxa";
import type {
  LocaleListItem,
  Observation,
  Region,
  Survey,
  SurveyBackup,
  SurveyDraft,
  SurveyListItem,
  SurveyLocale,
  Taxon,
} from "@/domain/models";
import { migrateLegacyObservations, type LegacyObservation } from "./migrateLocales";

const STORAGE_KEY = "inventera-mera:web:v1";
const SCHEMA_VERSION = 2;

type BrowserDatabase = {
  schemaVersion: 2;
  surveys: Survey[];
  locales: SurveyLocale[];
  observations: Observation[];
  drafts: Record<string, unknown>;
};

type LocaleInput = Omit<SurveyLocale, "id" | "createdAt" | "updatedAt">;
type ObservationInput = Omit<Observation, "id" | "createdAt" | "updatedAt">;

let database: BrowserDatabase | undefined;

export async function getDatabase(): Promise<BrowserDatabase> {
  if (database) return database;
  if (typeof localStorage === "undefined") {
    throw new Error("Webbläsarens lokala lagring är inte tillgänglig.");
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    database = emptyDatabase();
    persist(database);
    return database;
  }
  try {
    const parsed = JSON.parse(stored) as unknown;
    database = readOrMigrateDatabase(parsed);
    persist(database);
    return database;
  } catch {
    throw new Error(
      "Den lokala webbdatan kunde inte läsas. Rensa webbplatsdata eller återställ en JSON-backup.",
    );
  }
}

export async function listSurveys(search = ""): Promise<SurveyListItem[]> {
  const state = await getDatabase();
  const query = normalize(search);
  return state.surveys
    .filter((survey) => survey.status === "active")
    .filter((survey) => {
      if (!query) return true;
      return [
        survey.title,
        survey.description,
        survey.region.countyName,
        survey.region.municipalityName,
        survey.region.freeText,
        ...state.locales
          .filter((locale) => locale.surveyId === survey.id)
          .map((locale) => locale.name),
      ].some((value) => value && normalize(value).includes(query));
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((survey) => {
      const locales = state.locales.filter((locale) => locale.surveyId === survey.id);
      const localeIds = new Set(locales.map((locale) => locale.id));
      return {
        ...survey,
        localeCount: locales.length,
        observationCount: state.observations.filter((item) => localeIds.has(item.localeId)).length,
      };
    });
}

export async function getSurvey(id: string): Promise<Survey | null> {
  const state = await getDatabase();
  return state.surveys.find((survey) => survey.id === id) ?? null;
}

export async function createSurvey(draft: SurveyDraft, region: Region): Promise<Survey> {
  const state = await getDatabase();
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
  state.surveys.push(survey);
  delete state.drafts["survey:new"];
  persist(state);
  return survey;
}

export async function updateSurvey(
  id: string,
  draft: SurveyDraft,
  region: Region,
): Promise<Survey> {
  const state = await getDatabase();
  const index = state.surveys.findIndex((survey) => survey.id === id);
  const existing = state.surveys[index];
  if (!existing) throw new Error("Inventeringen kunde inte hittas.");
  const updated: Survey = {
    ...existing,
    title: draft.title.trim(),
    description: optionalText(draft.description),
    region,
    surveyDate: draft.surveyDate,
    updatedAt: new Date().toISOString(),
  };
  state.surveys[index] = updated;
  delete state.drafts[surveyEditDraftKey(id)];
  persist(state);
  return updated;
}

export async function deleteSurvey(id: string): Promise<void> {
  const state = await getDatabase();
  if (!state.surveys.some((survey) => survey.id === id)) {
    throw new Error("Inventeringen kunde inte hittas.");
  }
  const localeIds = new Set(
    state.locales.filter((locale) => locale.surveyId === id).map((locale) => locale.id),
  );
  state.surveys = state.surveys.filter((survey) => survey.id !== id);
  state.locales = state.locales.filter((locale) => locale.surveyId !== id);
  state.observations = state.observations.filter(
    (observation) => !localeIds.has(observation.localeId),
  );
  deleteSurveyDrafts(state, id);
  persist(state);
}

export async function listLocales(surveyId: string): Promise<LocaleListItem[]> {
  const state = await getDatabase();
  return state.locales
    .filter((locale) => locale.surveyId === surveyId)
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.createdAt.localeCompare(right.createdAt),
    )
    .map((locale) => ({
      ...locale,
      observationCount: state.observations.filter((item) => item.localeId === locale.id).length,
    }));
}

export async function getLocale(
  surveyId: string,
  localeId: string,
): Promise<SurveyLocale | null> {
  const state = await getDatabase();
  return (
    state.locales.find((locale) => locale.surveyId === surveyId && locale.id === localeId) ?? null
  );
}

export async function createLocale(input: LocaleInput): Promise<SurveyLocale> {
  const state = await getDatabase();
  const survey = state.surveys.find((item) => item.id === input.surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  const now = new Date().toISOString();
  const locale: SurveyLocale = {
    ...input,
    name: input.name.trim(),
    note: optionalText(input.note ?? ""),
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  state.locales.push(locale);
  survey.updatedAt = now;
  delete state.drafts[localeDraftKey(input.surveyId)];
  persist(state);
  return locale;
}

export async function updateLocale(localeId: string, input: LocaleInput): Promise<SurveyLocale> {
  const state = await getDatabase();
  const index = state.locales.findIndex(
    (locale) => locale.id === localeId && locale.surveyId === input.surveyId,
  );
  const existing = state.locales[index];
  if (!existing) throw new Error("Lokalen kunde inte hittas.");
  const updated: SurveyLocale = {
    ...input,
    name: input.name.trim(),
    note: optionalText(input.note ?? ""),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  state.locales[index] = updated;
  const survey = state.surveys.find((item) => item.id === input.surveyId);
  if (survey) survey.updatedAt = updated.updatedAt;
  delete state.drafts[localeEditDraftKey(input.surveyId, localeId)];
  persist(state);
  return updated;
}

export async function deleteLocale(surveyId: string, localeId: string): Promise<void> {
  const state = await getDatabase();
  const index = state.locales.findIndex(
    (locale) => locale.id === localeId && locale.surveyId === surveyId,
  );
  if (index < 0) throw new Error("Lokalen kunde inte hittas.");
  state.locales.splice(index, 1);
  state.observations = state.observations.filter(
    (observation) => observation.localeId !== localeId,
  );
  const survey = state.surveys.find((item) => item.id === surveyId);
  if (survey) survey.updatedAt = new Date().toISOString();
  for (const key of Object.keys(state.drafts)) {
    if (
      key === localeEditDraftKey(surveyId, localeId) ||
      key === observationDraftKey(surveyId, localeId) ||
      key.startsWith(observationEditDraftPrefix(surveyId, localeId))
    ) {
      delete state.drafts[key];
    }
  }
  persist(state);
}

export async function listObservations(surveyId: string): Promise<Observation[]> {
  const state = await getDatabase();
  const localeIds = new Set(
    state.locales.filter((locale) => locale.surveyId === surveyId).map((locale) => locale.id),
  );
  return state.observations
    .filter((observation) => localeIds.has(observation.localeId))
    .map((observation) => resolveObservation(state, observation))
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.createdAt.localeCompare(right.createdAt),
    );
}

export async function listLocaleObservations(localeId: string): Promise<Observation[]> {
  const state = await getDatabase();
  return state.observations
    .filter((observation) => observation.localeId === localeId)
    .map((observation) => resolveObservation(state, observation))
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.createdAt.localeCompare(right.createdAt),
    );
}

export async function getObservation(
  surveyId: string,
  observationId: string,
): Promise<Observation | null> {
  const state = await getDatabase();
  const observation = state.observations.find((item) => item.id === observationId);
  if (!observation) return null;
  const locale = state.locales.find(
    (item) => item.id === observation.localeId && item.surveyId === surveyId,
  );
  return locale ? resolveObservation(state, observation) : null;
}

export async function createObservation(input: ObservationInput): Promise<Observation> {
  const state = await getDatabase();
  const locale = state.locales.find(
    (item) => item.id === input.localeId && item.surveyId === input.surveyId,
  );
  if (!locale) throw new Error("Lokalen kunde inte hittas.");
  const now = new Date().toISOString();
  const saved: Observation = {
    ...resolveObservationInput(input, locale),
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  state.observations.push(saved);
  const survey = state.surveys.find((item) => item.id === locale.surveyId);
  if (survey) survey.updatedAt = now;
  delete state.drafts[observationDraftKey(locale.surveyId, locale.id)];
  persist(state);
  return saved;
}

export async function updateObservation(
  observationId: string,
  input: ObservationInput,
): Promise<Observation> {
  const state = await getDatabase();
  const index = state.observations.findIndex((item) => item.id === observationId);
  const existing = state.observations[index];
  if (!existing) throw new Error("Observationen kunde inte hittas.");
  const locale = state.locales.find(
    (item) => item.id === input.localeId && item.surveyId === input.surveyId,
  );
  if (!locale) throw new Error("Lokalen kunde inte hittas.");
  const updated: Observation = {
    ...resolveObservationInput(input, locale),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  state.observations[index] = updated;
  const survey = state.surveys.find((item) => item.id === input.surveyId);
  if (survey) survey.updatedAt = updated.updatedAt;
  delete state.drafts[observationEditDraftKey(input.surveyId, input.localeId, observationId)];
  persist(state);
  return updated;
}

export async function deleteObservation(
  surveyId: string,
  observationId: string,
): Promise<void> {
  const state = await getDatabase();
  const index = state.observations.findIndex((item) => item.id === observationId);
  const existing = state.observations[index];
  if (!existing) throw new Error("Observationen kunde inte hittas.");
  const locale = state.locales.find(
    (item) => item.id === existing.localeId && item.surveyId === surveyId,
  );
  if (!locale) throw new Error("Observationen kunde inte hittas.");
  state.observations.splice(index, 1);
  const survey = state.surveys.find((item) => item.id === surveyId);
  if (survey) survey.updatedAt = new Date().toISOString();
  delete state.drafts[observationEditDraftKey(surveyId, locale.id, observationId)];
  persist(state);
}

export async function searchTaxa(query: string, limit = 20): Promise<Taxon[]> {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return SEED_TAXA.filter((taxon) => {
    const searchable = normalize(
      [taxon.preferredName, taxon.scientificName, ...taxon.synonyms].join(" "),
    );
    return terms.every((term) => searchable.includes(term));
  })
    .sort((left, right) => {
      const firstTerm = terms[0] ?? "";
      const leftStarts = normalize(left.preferredName).startsWith(firstTerm) ? 0 : 1;
      const rightStarts = normalize(right.preferredName).startsWith(firstTerm) ? 0 : 1;
      return leftStarts - rightStarts || left.preferredName.localeCompare(right.preferredName, "sv");
    })
    .slice(0, limit);
}

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  const state = await getDatabase();
  state.drafts[key] = value;
  persist(state);
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  const state = await getDatabase();
  return key in state.drafts ? (state.drafts[key] as T) : null;
}

export async function deleteDraft(key: string): Promise<void> {
  const state = await getDatabase();
  delete state.drafts[key];
  persist(state);
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
  return {
    format: "inventera-mera-backup",
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    survey,
    locales: (await listLocales(surveyId)).map(({ observationCount: _, ...locale }) => locale),
    observations: await listObservations(surveyId),
  };
}

export async function restoreSurveyBackup(value: unknown): Promise<string> {
  const backup = normalizeBackup(value);
  const state = await getDatabase();
  const oldLocaleIds = new Set(
    state.locales.filter((locale) => locale.surveyId === backup.survey.id).map((locale) => locale.id),
  );
  state.surveys = [
    ...state.surveys.filter((survey) => survey.id !== backup.survey.id),
    backup.survey,
  ];
  state.locales = [
    ...state.locales.filter((locale) => locale.surveyId !== backup.survey.id),
    ...backup.locales,
  ];
  state.observations = [
    ...state.observations.filter((item) => !oldLocaleIds.has(item.localeId)),
    ...backup.observations,
  ];
  deleteSurveyDrafts(state, backup.survey.id);
  persist(state);
  return backup.survey.id;
}

function resolveObservation(state: BrowserDatabase, observation: Observation): Observation {
  const locale = state.locales.find((item) => item.id === observation.localeId);
  if (!locale) throw new Error("Observationens lokal kunde inte hittas.");
  return {
    ...observation,
    surveyId: locale.surveyId,
    localityName: locale.name,
    observedAt: observation.timeOverridden ? observation.observedAt : locale.observedAt,
    timeZone: observation.timeOverridden ? observation.timeZone : locale.timeZone,
    position: observation.positionOverridden ? observation.position : locale.position,
  };
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

function emptyDatabase(): BrowserDatabase {
  return {
    schemaVersion: SCHEMA_VERSION,
    surveys: [],
    locales: [],
    observations: [],
    drafts: {},
  };
}

function readOrMigrateDatabase(value: unknown): BrowserDatabase {
  if (!value || typeof value !== "object") throw new Error("Ogiltig databas.");
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion === 1) {
    if (!Array.isArray(candidate.surveys) || !Array.isArray(candidate.observations)) {
      throw new Error("Databasversionen stöds inte.");
    }
    const migrated = migrateLegacyObservations(
      candidate.observations as LegacyObservation[],
      () => Crypto.randomUUID(),
    );
    return {
      schemaVersion: 2,
      surveys: candidate.surveys as Survey[],
      locales: migrated.locales,
      observations: migrated.observations,
      drafts: {},
    };
  }
  if (
    candidate.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(candidate.surveys) ||
    !Array.isArray(candidate.locales) ||
    !Array.isArray(candidate.observations) ||
    !candidate.drafts ||
    typeof candidate.drafts !== "object"
  ) {
    throw new Error("Databasversionen stöds inte.");
  }
  return candidate as BrowserDatabase;
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
      backup.observations as LegacyObservation[],
      () => Crypto.randomUUID(),
    );
    return {
      format: "inventera-mera-backup",
      formatVersion: 2,
      exportedAt:
        typeof backup.exportedAt === "string" ? backup.exportedAt : new Date().toISOString(),
      survey,
      locales: migrated.locales,
      observations: migrated.observations,
    };
  }
  if (
    backup.formatVersion !== 2 ||
    !Array.isArray(backup.locales) ||
    !Array.isArray(backup.observations)
  ) {
    throw new Error("Backupformatet stöds inte.");
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
  return normalized;
}

function deleteSurveyDrafts(state: BrowserDatabase, surveyId: string): void {
  for (const key of Object.keys(state.drafts)) {
    if (
      key === surveyEditDraftKey(surveyId) ||
      key === localeDraftKey(surveyId) ||
      key.startsWith(localeEditDraftPrefix(surveyId)) ||
      key.startsWith(observationDraftPrefix(surveyId)) ||
      key.startsWith(observationEditDraftPrefix(surveyId))
    ) {
      delete state.drafts[key];
    }
  }
}

function persist(value: BrowserDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    throw new Error(
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "Webbläsarens lokala lagringsutrymme är fullt. Skapa en JSON-backup."
        : "Data kunde inte sparas i webbläsaren.",
    );
  }
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv");
}
