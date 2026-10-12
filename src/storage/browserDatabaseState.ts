import { VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import { isObservationUnit, isSupportedObservationAmount } from "@/domain/amount";
import type {
  AppSettings,
  Observation,
  SpeciesList,
  SpeciesListEntry,
  Survey,
  SurveyLocale,
} from "@/domain/models";
import type { AchievementAward } from "@/domain/achievements";
import {
  isAchievementAward,
  isAppSettings,
  isObservationBeforeAmountCleanup,
  isSpeciesList,
  isSpeciesListEntry,
  isSurvey,
  isSurveyLocale,
  isUnknownRecord,
} from "./recordValidation";

const STORAGE_KEY = "inventera-mera:web:v1";
const SCHEMA_VERSION = 6;

export type BrowserDatabase = {
  schemaVersion: 6;
  surveys: Survey[];
  locales: SurveyLocale[];
  observations: Observation[];
  speciesLists: SpeciesList[];
  speciesListEntries: SpeciesListEntry[];
  settings: AppSettings;
  achievements: AchievementAward[];
  drafts: Record<string, unknown>;
};

let database: BrowserDatabase | undefined;

export async function getBrowserDatabase(): Promise<BrowserDatabase> {
  if (database) return database;
  if (typeof localStorage === "undefined") {
    throw new Error("Webbläsarens lokala lagring är inte tillgänglig.");
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const created = emptyDatabase();
    saveBrowserDatabase(created);
    database = created;
    return created;
  }
  let loaded: BrowserDatabase;
  try {
    const parsed = JSON.parse(stored) as unknown;
    loaded = deleteUnsupportedAmountData(readCurrentDatabase(parsed));
  } catch {
    throw new Error(
      "Den lokala webbdatan har ett äldre eller ogiltigt format. Exportera en JSON-backup i format 5 med en kompatibel appversion innan du rensar webbplatsdata.",
    );
  }
  saveBrowserDatabase(loaded);
  database = loaded;
  return loaded;
}

export async function writableBrowserDatabase(): Promise<BrowserDatabase> {
  return JSON.parse(JSON.stringify(await getBrowserDatabase())) as BrowserDatabase;
}

export function commitBrowserDatabase(value: BrowserDatabase): void {
  saveBrowserDatabase(value);
  database = value;
}

function emptyDatabase(): BrowserDatabase {
  return {
    schemaVersion: SCHEMA_VERSION,
    surveys: [],
    locales: [],
    observations: [],
    speciesLists: [],
    speciesListEntries: [],
    settings: { defaultTaxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId },
    achievements: [],
    drafts: {},
  };
}

function readCurrentDatabase(value: unknown): BrowserDatabase {
  if (!isUnknownRecord(value)) throw new Error("Ogiltig databas.");
  const candidate = value;
  if (
    candidate.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(candidate.surveys) ||
    !candidate.surveys.every(isSurvey) ||
    !Array.isArray(candidate.locales) ||
    !candidate.locales.every(isSurveyLocale) ||
    !Array.isArray(candidate.observations) ||
    !candidate.observations.every(isObservationBeforeAmountCleanup) ||
    !Array.isArray(candidate.speciesLists) ||
    !candidate.speciesLists.every(isSpeciesList) ||
    !Array.isArray(candidate.speciesListEntries) ||
    !candidate.speciesListEntries.every(isSpeciesListEntry) ||
    !Array.isArray(candidate.achievements) ||
    !candidate.achievements.every(isAchievementAward) ||
    !isAppSettings(candidate.settings) ||
    !isUnknownRecord(candidate.drafts)
  ) {
    throw new Error("Databasversionen stöds inte.");
  }
  const current = candidate as unknown as BrowserDatabase;
  const surveyById = new Map(current.surveys.map((survey) => [survey.id, survey]));
  const localeById = new Map(current.locales.map((locale) => [locale.id, locale]));
  const listById = new Map(current.speciesLists.map((list) => [list.id, list]));
  const relationshipsAreValid =
    current.locales.every((locale) => surveyById.has(locale.surveyId)) &&
    current.observations.every((observation) => {
      const locale = localeById.get(observation.localeId);
      return locale != null && observation.surveyId === locale.surveyId;
    }) &&
    current.speciesListEntries.every((entry) => listById.has(entry.speciesListId)) &&
    current.surveys.every((survey) => {
      if (!survey.speciesListId) return true;
      const list = listById.get(survey.speciesListId);
      return list != null && list.taxonomyRef.packageId === survey.taxonomyRef?.packageId;
    });
  if (!relationshipsAreValid) throw new Error("Databasens relationer är ogiltiga.");
  return current;
}

function deleteUnsupportedAmountData(state: BrowserDatabase): BrowserDatabase {
  state.observations = state.observations.filter((observation) =>
    isSupportedObservationAmount(observation.amount),
  );
  for (const [key, value] of Object.entries(state.drafts)) {
    if (
      (key.startsWith("observation:new:") || key.startsWith("observation:edit:")) &&
      !observationDraftHasSupportedUnit(value)
    ) {
      delete state.drafts[key];
    }
  }
  return state;
}

function observationDraftHasSupportedUnit(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const unit = (value as { unit?: unknown }).unit;
  return unit === undefined || unit === "" || isObservationUnit(unit);
}

function saveBrowserDatabase(value: BrowserDatabase): void {
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
