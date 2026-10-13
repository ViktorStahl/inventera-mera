import type { ObservationDraft, SurveyLocale } from "@/domain/models";
import { localDateFromIso, localTimeFromIso, timeLocal, todayLocal } from "@/domain/time";

export function newObservationDraft(
  locale: SurveyLocale,
  now = new Date(),
): ObservationDraft {
  const usesLocaleTime = locale.useLocaleTimeByDefault;
  const usesLocalePosition = locale.useLocalePositionByDefault;
  return {
    date: usesLocaleTime ? localDateFromIso(locale.observedAt) : todayLocal(now),
    time: usesLocaleTime ? localTimeFromIso(locale.observedAt) : timeLocal(now),
    timeOverridden: !usesLocaleTime,
    identificationUncertain: false,
    northing: usesLocalePosition ? locale.position.rt90.northing.toString() : "",
    easting: usesLocalePosition ? locale.position.rt90.easting.toString() : "",
    accuracyMeters:
      usesLocalePosition ? locale.position.accuracyMeters?.toString() ?? "" : "",
    positionSource: usesLocalePosition ? locale.position.source : "manual-rt90",
    positionOverridden: !usesLocalePosition,
    latitude: usesLocalePosition ? locale.position.wgs84.latitude : undefined,
    longitude: usesLocalePosition ? locale.position.wgs84.longitude : undefined,
    speciesQuery: "",
    amount: "",
    unit: "",
    publicComment: "",
    additionalObservers: "",
    addToSpeciesList: false,
  };
}

export function shouldAutomaticallyCapturePosition(
  locale: Pick<SurveyLocale, "useLocalePositionByDefault">,
  editing: boolean,
  hasStoredDraft: boolean,
): boolean {
  return !editing && !hasStoredDraft && !locale.useLocalePositionByDefault;
}
