import { isSupportedObservationAmount } from "@/domain/amount";
import type {
  Observation,
  SpeciesList,
  SpeciesListEntry,
  SpeciesSnapshot,
  Survey,
  SurveyBackup,
  SurveyLocale,
  Taxon,
  TaxonomyReference,
} from "@/domain/models";
import { normalizeSpeciesName, speciesKey } from "@/domain/species";
import {
  isObservation,
  isObservationBeforeAmountCleanup,
  isSpeciesList,
  isSpeciesListEntry,
  isSurvey,
  isSurveyLocale,
  isUnknownRecord,
} from "./recordValidation";

export type ObservationInput = Omit<Observation, "id" | "createdAt" | "updatedAt">;

export function assertSurveyIsActive(
  survey: Survey | null | undefined,
): asserts survey is Survey {
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  if (survey.status !== "active") {
    throw new Error("Inventeringen är arkiverad. Återställ den innan du gör ändringar.");
  }
}

export function assertSurveyIsArchived(
  survey: Survey | null | undefined,
): asserts survey is Survey {
  if (!survey) throw new Error("Inventeringen kunde inte hittas.");
  if (survey.status !== "archived") {
    throw new Error("Arkivera inventeringen innan du raderar den.");
  }
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

export function localeEditDraftPrefix(surveyId: string): string {
  return `locale:edit:${surveyId}:`;
}

export function observationDraftKey(surveyId: string, localeId: string): string {
  return `${observationDraftPrefix(surveyId)}${localeId}`;
}

export function observationDraftPrefix(surveyId: string): string {
  return `observation:new:${surveyId}:`;
}

export function observationEditDraftKey(
  surveyId: string,
  localeId: string,
  observationId: string,
): string {
  return `${observationEditDraftPrefix(surveyId, localeId)}${observationId}`;
}

export function observationEditDraftPrefix(surveyId: string, localeId = ""): string {
  return `observation:edit:${surveyId}:${localeId}` + (localeId ? ":" : "");
}

export function resolveObservationInput(
  input: ObservationInput,
  locale: SurveyLocale,
): ObservationInput {
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

export function normalizeSpeciesForList(
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

export function speciesSnapshotMatches(species: SpeciesSnapshot, terms: string[]): boolean {
  const searchable = normalizeSpeciesName([
    species.enteredName,
    species.preferredName,
    species.scientificName,
  ].filter(Boolean).join(" "));
  return terms.every((term) => searchable.includes(normalizeSpeciesName(term)));
}

export function speciesListEntryToTaxon(entry: SpeciesListEntry): Taxon {
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

export function taxonMatchScore(taxon: Taxon, terms: string[]): number {
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

export function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function taxonomyReference(taxonomy: TaxonomyReference): TaxonomyReference {
  return {
    packageId: taxonomy.packageId,
    name: taxonomy.name,
    version: taxonomy.version,
  };
}

export function parseSurveyBackupV5(value: unknown): SurveyBackup {
  if (!value || typeof value !== "object") throw new Error("Filen är inte en giltig backup.");
  const backup = value as Record<string, unknown>;
  if (
    backup.format !== "inventera-mera-backup" ||
    backup.formatVersion !== 5 ||
    typeof backup.exportedAt !== "string" ||
    !Array.isArray(backup.locales) ||
    !Array.isArray(backup.observations)
  ) {
    throw new Error("Backupformatet stöds inte.");
  }
  if (!isSurvey(backup.survey)) {
    throw new Error("Backupen innehåller en ogiltig inventering.");
  }
  const survey = backup.survey;
  if (!backup.locales.every(isSurveyLocale)) {
    throw new Error("Backupen innehåller en ogiltig lokal.");
  }
  const observations: Observation[] = [];
  for (const observation of backup.observations) {
    if (
      isObservationBeforeAmountCleanup(observation) &&
      isUnknownRecord(observation) &&
      !isSupportedObservationAmount(observation.amount)
    ) {
      continue;
    }
    if (!isObservation(observation)) {
      throw new Error("Backupen innehåller en ogiltig observation.");
    }
    observations.push(observation);
  }
  if (
    backup.speciesList !== undefined &&
    (
      !isUnknownRecord(backup.speciesList) ||
      !isSpeciesList(backup.speciesList.list) ||
      !Array.isArray(backup.speciesList.entries) ||
      !backup.speciesList.entries.every(isSpeciesListEntry)
    )
  ) {
    throw new Error("Backupens artlista är ogiltig.");
  }
  const normalized = {
    ...backup,
    survey,
    locales: backup.locales,
    observations,
  } as unknown as SurveyBackup;
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
  return normalized;
}
