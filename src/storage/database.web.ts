import * as Crypto from "expo-crypto";

import { SEED_TAXA } from "@/data/seedTaxa";
import type {
  Observation,
  Region,
  Survey,
  SurveyBackup,
  SurveyDraft,
  SurveyListItem,
  Taxon,
} from "@/domain/models";

const STORAGE_KEY = "inventera-mera:web:v1";
const SCHEMA_VERSION = 1;

type BrowserDatabase = {
  schemaVersion: 1;
  surveys: Survey[];
  observations: Observation[];
  drafts: Record<string, unknown>;
};

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
    database = validateDatabase(JSON.parse(stored) as unknown);
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
        survey.region.countyName,
        survey.region.municipalityName,
        survey.region.freeText,
      ].some((value) => value && normalize(value).includes(query));
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((survey) => ({
      ...survey,
      observationCount: state.observations.filter((item) => item.surveyId === survey.id).length,
    }));
}

export async function getSurvey(id: string): Promise<Survey | null> {
  const state = await getDatabase();
  return state.surveys.find((survey) => survey.id === id) ?? null;
}

export async function createSurvey(
  draft: SurveyDraft,
  region: Region,
): Promise<Survey> {
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

export async function listObservations(surveyId: string): Promise<Observation[]> {
  const state = await getDatabase();
  return state.observations
    .filter((observation) => observation.surveyId === surveyId)
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.createdAt.localeCompare(right.createdAt),
    );
}

export async function getLastLocalityName(surveyId: string): Promise<string | null> {
  const observations = (await listObservations(surveyId)).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  return observations[0]?.localityName ?? null;
}

export async function createObservation(
  observation: Omit<Observation, "id" | "createdAt" | "updatedAt">,
): Promise<Observation> {
  const state = await getDatabase();
  const survey = state.surveys.find((item) => item.id === observation.surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  const now = new Date().toISOString();
  const saved: Observation = {
    ...observation,
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  state.observations.push(saved);
  survey.updatedAt = now;
  delete state.drafts[observationDraftKey(survey.id)];
  persist(state);
  return saved;
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
  const state = await getDatabase();
  state.surveys = [
    ...state.surveys.filter((survey) => survey.id !== backup.survey.id),
    backup.survey,
  ];
  state.observations = [
    ...state.observations.filter((item) => item.surveyId !== backup.survey.id),
    ...backup.observations,
  ];
  persist(state);
  return backup.survey.id;
}

function emptyDatabase(): BrowserDatabase {
  return { schemaVersion: SCHEMA_VERSION, surveys: [], observations: [], drafts: {} };
}

function validateDatabase(value: unknown): BrowserDatabase {
  if (!value || typeof value !== "object") throw new Error("Ogiltig databas.");
  const candidate = value as Partial<BrowserDatabase>;
  if (
    candidate.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(candidate.surveys) ||
    !Array.isArray(candidate.observations) ||
    !candidate.drafts ||
    typeof candidate.drafts !== "object"
  ) {
    throw new Error("Databasversionen stöds inte.");
  }
  return candidate as BrowserDatabase;
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
