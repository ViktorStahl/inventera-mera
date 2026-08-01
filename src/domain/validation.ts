import type { ObservationDraft, SurveyDraft } from "./models";
import { assertRt90 } from "./coordinates";

export type ValidationErrors<T> = Partial<Record<keyof T | "general", string>>;

export function validateSurveyDraft(
  draft: SurveyDraft,
): ValidationErrors<SurveyDraft> {
  const errors: ValidationErrors<SurveyDraft> = {};
  if (!draft.title.trim()) errors.title = "Ange en titel.";
  if (!isValidDate(draft.surveyDate)) {
    errors.surveyDate = "Ange datum som ÅÅÅÅ-MM-DD.";
  }
  if (!draft.countyCode) errors.countyCode = "Välj ett län eller en kommun.";
  return errors;
}

export function validateObservationDraft(
  draft: ObservationDraft,
): ValidationErrors<ObservationDraft> {
  const errors: ValidationErrors<ObservationDraft> = {};
  if (!isValidDate(draft.date)) {
    errors.date = "Ange datum som ÅÅÅÅ-MM-DD.";
  }
  if (!isValidTime(draft.time)) {
    errors.time = "Ange tid som TT:MM.";
  }
  if (!draft.localityName.trim()) errors.localityName = "Ange lokalnamn.";
  if (!draft.speciesQuery.trim()) errors.speciesQuery = "Ange artnamn.";

  const northing = Number(draft.northing.replace(",", "."));
  const easting = Number(draft.easting.replace(",", "."));
  try {
    assertRt90({ northing, easting });
  } catch (error) {
    errors.northing = error instanceof Error ? error.message : "Ogiltiga koordinater.";
  }

  if (draft.amount.trim()) {
    const amount = Number(draft.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      errors.amount = "Antal måste vara noll eller större.";
    }
    if (!draft.unit.trim()) errors.unit = "Enhet krävs när antal anges.";
  }
  if (draft.accuracyMeters.trim()) {
    const accuracy = Number(draft.accuracyMeters.replace(",", "."));
    if (!Number.isFinite(accuracy) || accuracy < 0) {
      errors.accuracyMeters = "Noggrannhet måste vara noll eller större.";
    }
  }
  return errors;
}

export function hasErrors<T>(errors: ValidationErrors<T>): boolean {
  return Object.keys(errors).length > 0;
}

export function parseAdditionalObservers(value: string): string[] {
  return value
    .split(/[;,\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
