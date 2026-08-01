export function defaultLocalityName(lastObservationLocality: string | null, surveyTitle: string): string {
  return lastObservationLocality?.trim() || surveyTitle.trim();
}
