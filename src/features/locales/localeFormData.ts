import { rt90ToWgs84 } from "@/domain/coordinates";
import type { LocaleDraft, SurveyLocale } from "@/domain/models";
import {
  currentTimeZone,
  localDateFromIso,
  localDateTimeWithOffset,
  localTimeFromIso,
  timeLocal,
  todayLocal,
} from "@/domain/time";

export type LocaleInput = Omit<SurveyLocale, "id" | "createdAt" | "updatedAt">;

export function newLocaleDraft(now = new Date()): LocaleDraft {
  return {
    name: "",
    date: todayLocal(now),
    time: timeLocal(now),
    northing: "",
    easting: "",
    accuracyMeters: "",
    positionSource: "manual-rt90",
    note: "",
    useLocaleTimeByDefault: false,
    useLocalePositionByDefault: false,
  };
}

export function localeToDraft(locale: SurveyLocale): LocaleDraft {
  return {
    name: locale.name,
    date: localDateFromIso(locale.observedAt),
    time: localTimeFromIso(locale.observedAt),
    northing: locale.position.rt90.northing.toString(),
    easting: locale.position.rt90.easting.toString(),
    accuracyMeters: locale.position.accuracyMeters?.toString() ?? "",
    positionSource: locale.position.source,
    latitude: locale.position.wgs84.latitude,
    longitude: locale.position.wgs84.longitude,
    note: locale.note ?? "",
    useLocaleTimeByDefault: locale.useLocaleTimeByDefault,
    useLocalePositionByDefault: locale.useLocalePositionByDefault,
  };
}

export function buildLocaleInput(
  surveyId: string,
  draft: LocaleDraft,
  original?: SurveyLocale,
): LocaleInput {
  const rt90 = {
    northing: parseDecimal(draft.northing),
    easting: parseDecimal(draft.easting),
  };
  const hasCapturedWgs84 = draft.positionSource === "device" &&
    draft.latitude != null &&
    draft.longitude != null;
  const wgs84 = hasCapturedWgs84
    ? { latitude: draft.latitude!, longitude: draft.longitude! }
    : rt90ToWgs84(rt90);
  const dateTimeUnchanged = original != null &&
    draft.date === localDateFromIso(original.observedAt) &&
    draft.time === localTimeFromIso(original.observedAt);

  return {
    surveyId,
    name: draft.name.trim(),
    observedAt: dateTimeUnchanged
      ? original.observedAt
      : localDateTimeWithOffset(draft.date, draft.time),
    timeZone: dateTimeUnchanged ? original.timeZone : currentTimeZone(),
    position: {
      wgs84,
      rt90: { ...rt90, crs: "EPSG:3847" },
      accuracyMeters: draft.accuracyMeters.trim()
        ? parseDecimal(draft.accuracyMeters)
        : undefined,
      source: draft.positionSource,
    },
    note: draft.note.trim() || undefined,
    useLocaleTimeByDefault: draft.useLocaleTimeByDefault,
    useLocalePositionByDefault: draft.useLocalePositionByDefault,
  };
}

function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}
