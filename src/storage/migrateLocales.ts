import type { Observation, Position, SurveyLocale } from "@/domain/models";

export type LegacyObservation = Omit<
  Observation,
  "localeId" | "timeOverridden" | "positionOverridden"
>;

export function migrateLegacyObservations(
  legacyObservations: LegacyObservation[],
  createId: () => string,
): { locales: SurveyLocale[]; observations: Observation[] } {
  const sorted = [...legacyObservations].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const groups = new Map<string, LegacyObservation[]>();
  for (const observation of sorted) {
    const name = observation.localityName.trim() || "Lokal";
    const key = `${observation.surveyId}\u0000${name}`;
    const group = groups.get(key);
    if (group) group.push(observation);
    else groups.set(key, [observation]);
  }

  const locales: SurveyLocale[] = [];
  const observations: Observation[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const locale: SurveyLocale = {
      id: createId(),
      surveyId: first.surveyId,
      name: first.localityName.trim() || "Lokal",
      observedAt: first.observedAt,
      timeZone: first.timeZone,
      position: first.position,
      createdAt: first.createdAt,
      updatedAt: group.reduce(
        (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
        first.updatedAt,
      ),
    };
    locales.push(locale);
    for (const observation of group) {
      observations.push({
        ...observation,
        localeId: locale.id,
        localityName: locale.name,
        timeOverridden:
          observation.observedAt !== locale.observedAt || observation.timeZone !== locale.timeZone,
        positionOverridden: !positionsEqual(observation.position, locale.position),
      });
    }
  }
  return { locales, observations };
}

function positionsEqual(left: Position, right: Position): boolean {
  return (
    left.wgs84.latitude === right.wgs84.latitude &&
    left.wgs84.longitude === right.wgs84.longitude &&
    left.rt90.northing === right.rt90.northing &&
    left.rt90.easting === right.rt90.easting &&
    left.accuracyMeters === right.accuracyMeters &&
    left.source === right.source
  );
}
