import * as Crypto from "expo-crypto";

import packagedTaxonomy from "@/data/generated/dyntaxaVascularPlants.json";
import { findTaxonomy, VASCULAR_PLANTS_TAXONOMY } from "@/data/taxonomies";
import {
  assertSupportedObservationAmount,
  isObservationUnit,
  isSupportedObservationAmount,
} from "@/domain/amount";
import type {
  AppSettings,
  LocaleListItem,
  Observation,
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
import { speciesKey } from "@/domain/species";
import { migrateLegacyObservations, type LegacyObservation } from "./migrateLocales";
import {
  localeDraftKey,
  localeEditDraftKey,
  localeEditDraftPrefix,
  normalizeSpeciesForList,
  normalizeSurveyBackup,
  observationDraftKey,
  observationDraftPrefix,
  observationEditDraftKey,
  observationEditDraftPrefix,
  optionalText,
  resolveObservationInput,
  speciesListEntryToTaxon,
  speciesSnapshotMatches,
  surveyEditDraftKey,
  surveyWithoutRegion,
  taxonMatchScore,
  taxonomyReference,
  type ObservationInput,
} from "./repositoryPolicy";

export {
  localeDraftKey,
  localeEditDraftKey,
  observationDraftKey,
  observationEditDraftKey,
  surveyEditDraftKey,
} from "./repositoryPolicy";

const STORAGE_KEY = "inventera-mera:web:v1";
const SCHEMA_VERSION = 4;

type PackagedTaxon = [
  id: string,
  preferredName: string,
  scientificName: string,
  synonyms: string[],
  rank: string,
  status: string,
];

const PACKAGED_TAXA = packagedTaxonomy.taxa as PackagedTaxon[];

type BrowserDatabase = {
  schemaVersion: 4;
  surveys: Survey[];
  locales: SurveyLocale[];
  observations: Observation[];
  speciesLists: SpeciesList[];
  speciesListEntries: SpeciesListEntry[];
  settings: AppSettings;
  drafts: Record<string, unknown>;
};

type LocaleInput = Omit<SurveyLocale, "id" | "createdAt" | "updatedAt">;

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
    database = deleteUnsupportedAmountData(readOrMigrateDatabase(parsed));
    persist(database);
    return database;
  } catch {
    throw new Error(
      "Den lokala webbdatan kunde inte läsas. Rensa webbplatsdata eller återställ en JSON-backup.",
    );
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  return { ...(await getDatabase()).settings };
}

export async function updateDefaultTaxonomy(packageId: string): Promise<void> {
  if (!findTaxonomy(packageId)) throw new Error("Taxonomin kunde inte hittas.");
  const state = await getDatabase();
  state.settings.defaultTaxonomyPackageId = packageId;
  persist(state);
}

export async function listSpeciesLists(
  search = "",
  taxonomyPackageId?: string,
): Promise<SpeciesListSummary[]> {
  const state = await getDatabase();
  const query = normalize(search);
  return state.speciesLists
    .filter((list) => !query || normalize(list.name).includes(query))
    .filter((list) => !taxonomyPackageId || list.taxonomyRef.packageId === taxonomyPackageId)
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name, "sv"),
    )
    .map((list) => ({
      ...list,
      speciesCount: state.speciesListEntries.filter((entry) => entry.speciesListId === list.id).length,
    }));
}

export async function getSpeciesList(id: string): Promise<SpeciesList | null> {
  const state = await getDatabase();
  return state.speciesLists.find((list) => list.id === id) ?? null;
}

export async function createSpeciesList(
  name: string,
  taxonomyRef: TaxonomyReference,
): Promise<SpeciesList> {
  if (!name.trim()) throw new Error("Ange ett namn på artlistan.");
  if (!findTaxonomy(taxonomyRef.packageId)) throw new Error("Taxonomin kunde inte hittas.");
  const state = await getDatabase();
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
  state.speciesLists.push(list);
  persist(state);
  return list;
}

export async function renameSpeciesList(id: string, name: string): Promise<SpeciesList> {
  if (!name.trim()) throw new Error("Ange ett namn på artlistan.");
  const state = await getDatabase();
  const list = state.speciesLists.find((item) => item.id === id);
  if (!list) throw new Error("Artlistan kunde inte hittas.");
  list.name = name.trim();
  list.updatedAt = new Date().toISOString();
  persist(state);
  return { ...list };
}

export async function deleteSpeciesList(id: string): Promise<void> {
  const state = await getDatabase();
  if (!state.speciesLists.some((list) => list.id === id)) {
    throw new Error("Artlistan kunde inte hittas.");
  }
  state.speciesLists = state.speciesLists.filter((list) => list.id !== id);
  state.speciesListEntries = state.speciesListEntries.filter((entry) => entry.speciesListId !== id);
  for (const survey of state.surveys) {
    if (survey.speciesListId === id) survey.speciesListId = undefined;
  }
  persist(state);
}

export async function listSpeciesListEntries(listId: string): Promise<SpeciesListEntry[]> {
  const state = await getDatabase();
  return state.speciesListEntries
    .filter((entry) => entry.speciesListId === listId)
    .sort((left, right) =>
      speciesDisplayName(left.species).localeCompare(speciesDisplayName(right.species), "sv"),
    );
}

export async function addSpeciesToList(
  listId: string,
  species: SpeciesSnapshot,
): Promise<SpeciesListEntry> {
  const state = await getDatabase();
  const entry = addSpeciesToState(state, listId, species);
  persist(state);
  return entry;
}

export async function removeSpeciesFromList(listId: string, entryId: string): Promise<void> {
  const state = await getDatabase();
  const index = state.speciesListEntries.findIndex(
    (entry) => entry.id === entryId && entry.speciesListId === listId,
  );
  if (index < 0) throw new Error("Arten kunde inte hittas i artlistan.");
  state.speciesListEntries.splice(index, 1);
  const list = state.speciesLists.find((item) => item.id === listId);
  if (list) list.updatedAt = new Date().toISOString();
  persist(state);
}

export async function speciesListContains(
  listId: string,
  species: SpeciesSnapshot,
): Promise<boolean> {
  const state = await getDatabase();
  const key = speciesKey(species);
  return state.speciesListEntries.some(
    (entry) => entry.speciesListId === listId && entry.speciesKey === key,
  );
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

export async function createSurvey(draft: SurveyDraft): Promise<Survey> {
  const state = await getDatabase();
  const taxonomy = findTaxonomy(draft.taxonomyPackageId);
  if (!taxonomy) throw new Error("Taxonomin kunde inte hittas.");
  const speciesList = draft.speciesListId
    ? state.speciesLists.find((list) => list.id === draft.speciesListId)
    : undefined;
  if (draft.speciesListId && !speciesList) throw new Error("Artlistan kunde inte hittas.");
  if (speciesList && speciesList.taxonomyRef.packageId !== taxonomy.packageId) {
    throw new Error("Artlistan använder en annan taxonomi.");
  }
  const now = new Date().toISOString();
  const survey: Survey = {
    id: Crypto.randomUUID(),
    title: draft.title.trim(),
    description: optionalText(draft.description),
    taxonomyRef: taxonomyReference(taxonomy),
    speciesListId: speciesList?.id,
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
): Promise<Survey> {
  const state = await getDatabase();
  const index = state.surveys.findIndex((survey) => survey.id === id);
  const existing = state.surveys[index];
  if (!existing) throw new Error("Inventeringen kunde inte hittas.");
  const taxonomy = findTaxonomy(draft.taxonomyPackageId);
  if (!taxonomy) throw new Error("Taxonomin kunde inte hittas.");
  const speciesList = draft.speciesListId
    ? state.speciesLists.find((list) => list.id === draft.speciesListId)
    : undefined;
  if (draft.speciesListId && !speciesList) throw new Error("Artlistan kunde inte hittas.");
  if (speciesList && speciesList.taxonomyRef.packageId !== taxonomy.packageId) {
    throw new Error("Artlistan använder en annan taxonomi.");
  }
  const updated: Survey = {
    ...existing,
    title: draft.title.trim(),
    description: optionalText(draft.description),
    taxonomyRef: taxonomyReference(taxonomy),
    speciesListId: speciesList?.id,
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

export async function createObservation(
  input: ObservationInput,
  addToSpeciesListId?: string,
): Promise<Observation> {
  assertSupportedObservationAmount(input.amount);
  const state = await getDatabase();
  const locale = state.locales.find(
    (item) => item.id === input.localeId && item.surveyId === input.surveyId,
  );
  if (!locale) throw new Error("Lokalen kunde inte hittas.");
  if (addToSpeciesListId) assertSurveySpeciesList(state, input.surveyId, addToSpeciesListId);
  const now = new Date().toISOString();
  const saved: Observation = {
    ...resolveObservationInput(input, locale),
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  state.observations.push(saved);
  if (addToSpeciesListId) addSpeciesToState(state, addToSpeciesListId, saved.species);
  const survey = state.surveys.find((item) => item.id === locale.surveyId);
  if (survey) survey.updatedAt = now;
  delete state.drafts[observationDraftKey(locale.surveyId, locale.id)];
  persist(state);
  return saved;
}

export async function updateObservation(
  observationId: string,
  input: ObservationInput,
  addToSpeciesListId?: string,
): Promise<Observation> {
  assertSupportedObservationAmount(input.amount);
  const state = await getDatabase();
  const index = state.observations.findIndex((item) => item.id === observationId);
  const existing = state.observations[index];
  if (!existing) throw new Error("Observationen kunde inte hittas.");
  const locale = state.locales.find(
    (item) => item.id === input.localeId && item.surveyId === input.surveyId,
  );
  if (!locale) throw new Error("Lokalen kunde inte hittas.");
  if (addToSpeciesListId) assertSurveySpeciesList(state, input.surveyId, addToSpeciesListId);
  const updated: Observation = {
    ...resolveObservationInput(input, locale),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  state.observations[index] = updated;
  if (addToSpeciesListId) addSpeciesToState(state, addToSpeciesListId, updated.species);
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

export async function searchTaxa(
  query: string,
  limit = 20,
  speciesListId?: string,
  taxonomyPackageId = VASCULAR_PLANTS_TAXONOMY.packageId,
): Promise<Taxon[]> {
  if (!findTaxonomy(taxonomyPackageId)) return [];
  const state = await getDatabase();
  const selectedSpeciesList = speciesListId
    ? state.speciesLists.find((list) => list.id === speciesListId)
    : undefined;
  if (
    speciesListId &&
    (!selectedSpeciesList || selectedSpeciesList.taxonomyRef.packageId !== taxonomyPackageId)
  ) return [];
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const listEntries = state.speciesListEntries.filter(
    (entry) => entry.speciesListId === speciesListId,
  );
  const listTaxonIds = new Set(
    listEntries
      .map((entry) => entry.species.taxonId)
      .filter((taxonId): taxonId is string => Boolean(taxonId)),
  );
  const listMatches = listEntries
    .filter((entry) => speciesSnapshotMatches(entry.species, terms))
    .map(speciesListEntryToTaxon);
  const taxonomyMatches = PACKAGED_TAXA.filter((taxon) => {
    const searchable = normalize(
      [taxon[1], taxon[2], ...taxon[3]].join(" "),
    );
    return terms.every((term) => searchable.includes(term));
  })
    .filter((taxon) => !listTaxonIds.has(taxon[0]))
    .map<Taxon>((taxon) => ({
      id: taxon[0],
      source: "taxonomy",
      preferredName: taxon[1],
      scientificName: taxon[2],
      synonyms: taxon[3],
      rank: taxon[4],
      status: taxon[5],
      inSpeciesList: false,
    }));
  return [...listMatches, ...taxonomyMatches]
    .sort((left, right) => {
      const listOrder = Number(Boolean(right.inSpeciesList)) - Number(Boolean(left.inSpeciesList));
      return listOrder || taxonMatchScore(left, terms) - taxonMatchScore(right, terms) || left.preferredName.localeCompare(right.preferredName, "sv");
    })
    .slice(0, limit);
}

export async function prepareTaxonomySearch(
  taxonomyPackageId = VASCULAR_PLANTS_TAXONOMY.packageId,
): Promise<void> {
  if (!findTaxonomy(taxonomyPackageId)) return;
  await getDatabase();
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

export async function buildSurveyBackup(surveyId: string): Promise<SurveyBackup> {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  const speciesList = survey.speciesListId ? await getSpeciesList(survey.speciesListId) : null;
  return {
    format: "inventera-mera-backup",
    formatVersion: 4,
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
  const backup = normalizeSurveyBackup(value, () => Crypto.randomUUID());
  const state = await getDatabase();
  if (backup.speciesList) {
    const restoredList = backup.speciesList.list;
    const existingList = state.speciesLists.find((list) => list.id === restoredList.id);
    if (existingList && existingList.taxonomyRef.packageId !== restoredList.taxonomyRef.packageId) {
      throw new Error("En lokal artlista med samma ID använder en annan taxonomi.");
    }
    if (!existingList) state.speciesLists.push(restoredList);
    for (const entry of backup.speciesList.entries) {
      if (
        state.speciesListEntries.some(
          (current) =>
            current.speciesListId === entry.speciesListId &&
            current.speciesKey === entry.speciesKey,
        )
      ) continue;
      state.speciesListEntries.push(
        state.speciesListEntries.some((current) => current.id === entry.id)
          ? { ...entry, id: Crypto.randomUUID() }
          : entry,
      );
    }
  }
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

function emptyDatabase(): BrowserDatabase {
  return {
    schemaVersion: SCHEMA_VERSION,
    surveys: [],
    locales: [],
    observations: [],
    speciesLists: [],
    speciesListEntries: [],
    settings: { defaultTaxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId },
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
      schemaVersion: 4,
      surveys: (candidate.surveys as unknown[]).map(surveyWithoutRegion),
      locales: migrated.locales,
      observations: migrated.observations,
      speciesLists: [],
      speciesListEntries: [],
      settings: { defaultTaxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId },
      drafts: {},
    };
  }
  if (candidate.schemaVersion === 2) {
    if (
      !Array.isArray(candidate.surveys) ||
      !Array.isArray(candidate.locales) ||
      !Array.isArray(candidate.observations)
    ) {
      throw new Error("Databasversionen stöds inte.");
    }
    return {
      schemaVersion: 4,
      surveys: (candidate.surveys as unknown[]).map(surveyWithoutRegion),
      locales: candidate.locales as SurveyLocale[],
      observations: candidate.observations as Observation[],
      speciesLists: [],
      speciesListEntries: [],
      settings: { defaultTaxonomyPackageId: VASCULAR_PLANTS_TAXONOMY.packageId },
      drafts: withoutObsoleteSurveyDrafts(
        (candidate.drafts as Record<string, unknown> | undefined) ?? {},
      ),
    };
  }
  if (
    (candidate.schemaVersion !== 3 && candidate.schemaVersion !== SCHEMA_VERSION) ||
    !Array.isArray(candidate.surveys) ||
    !Array.isArray(candidate.locales) ||
    !Array.isArray(candidate.observations) ||
    !Array.isArray(candidate.speciesLists) ||
    !Array.isArray(candidate.speciesListEntries) ||
    !candidate.settings ||
    !candidate.drafts ||
    typeof candidate.drafts !== "object"
  ) {
    throw new Error("Databasversionen stöds inte.");
  }
  const migrated = candidate as unknown as BrowserDatabase;
  migrated.schemaVersion = 4;
  migrated.surveys = (candidate.surveys as unknown[]).map(surveyWithoutRegion);
  migrated.drafts = withoutObsoleteSurveyDrafts(migrated.drafts);
  return migrated;
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

function withoutObsoleteSurveyDrafts(drafts: Record<string, unknown>): Record<string, unknown> {
  const migrated = { ...drafts };
  for (const key of Object.keys(migrated)) {
    if (key === "survey:new" || key.startsWith("survey:edit:")) delete migrated[key];
  }
  return migrated;
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

function assertSurveySpeciesList(
  state: BrowserDatabase,
  surveyId: string,
  listId: string,
): void {
  const survey = state.surveys.find((item) => item.id === surveyId);
  if (
    !survey ||
    survey.speciesListId !== listId ||
    !state.speciesLists.some((list) => list.id === listId)
  ) {
    throw new Error("Artlistan är inte vald för inventeringen.");
  }
}

function addSpeciesToState(
  state: BrowserDatabase,
  listId: string,
  species: SpeciesSnapshot,
): SpeciesListEntry {
  const list = state.speciesLists.find((item) => item.id === listId);
  if (!list) throw new Error("Artlistan kunde inte hittas.");
  const normalizedSpecies = normalizeSpeciesForList(list, species);
  const key = speciesKey(normalizedSpecies);
  const existing = state.speciesListEntries.find(
    (entry) => entry.speciesListId === listId && entry.speciesKey === key,
  );
  if (existing) return existing;
  const entry: SpeciesListEntry = {
    id: Crypto.randomUUID(),
    speciesListId: listId,
    speciesKey: key,
    species: normalizedSpecies,
    createdAt: new Date().toISOString(),
  };
  state.speciesListEntries.push(entry);
  list.updatedAt = entry.createdAt;
  return entry;
}

function speciesDisplayName(species: SpeciesSnapshot): string {
  return species.preferredName ?? species.enteredName;
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv");
}
