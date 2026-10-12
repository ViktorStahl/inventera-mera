import type {
  Observation,
  SpeciesList,
  Survey,
  SurveyDraft,
  SurveyLocale,
  TaxonomyReference,
} from "@/domain/models";
import { optionalText, resolveObservationInput, taxonomyReference, type ObservationInput } from "./repositoryPolicy";

type LocaleInput = Omit<SurveyLocale, "id" | "createdAt" | "updatedAt">;

export function createSurveyRecord(
  draft: SurveyDraft,
  taxonomy: TaxonomyReference,
  speciesList: SpeciesList | null | undefined,
  id: string,
  now: string,
): Survey {
  return {
    id,
    title: draft.title.trim(),
    description: optionalText(draft.description),
    taxonomyRef: taxonomyReference(taxonomy),
    speciesListId: speciesList?.id,
    surveyDate: draft.surveyDate,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function updateSurveyRecord(
  existing: Survey,
  draft: SurveyDraft,
  taxonomy: TaxonomyReference,
  speciesList: SpeciesList | null | undefined,
  now: string,
): Survey {
  return {
    ...existing,
    title: draft.title.trim(),
    description: optionalText(draft.description),
    taxonomyRef: taxonomyReference(taxonomy),
    speciesListId: speciesList?.id,
    surveyDate: draft.surveyDate,
    updatedAt: now,
  };
}

export function createLocaleRecord(input: LocaleInput, id: string, now: string): SurveyLocale {
  return {
    ...input,
    name: input.name.trim(),
    note: optionalText(input.note ?? ""),
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateLocaleRecord(
  existing: SurveyLocale,
  input: LocaleInput,
  now: string,
): SurveyLocale {
  return {
    ...input,
    name: input.name.trim(),
    note: optionalText(input.note ?? ""),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

export function createObservationRecord(
  input: ObservationInput,
  locale: SurveyLocale,
  id: string,
  now: string,
): Observation {
  return {
    ...resolveObservationInput(input, locale),
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateObservationRecord(
  existing: Observation,
  input: ObservationInput,
  locale: SurveyLocale,
  now: string,
): Observation {
  return {
    ...resolveObservationInput(input, locale),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}
