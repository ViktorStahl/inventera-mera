import type { Observation, Survey } from "@/domain/models";

const GPX_NAMESPACE = "http://www.topografix.com/GPX/1/1";
const GPX_SCHEMA = "http://www.topografix.com/GPX/1/1/gpx.xsd";

export function createSurveyGpx(survey: Survey, observations: Observation[]): string {
  const metadata = [
    `<name>${escapeXml(survey.title)}</name>`,
    survey.description ? `<desc>${escapeXml(survey.description)}</desc>` : "",
  ].filter(Boolean).join("");
  const waypoints = [...observations]
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt))
    .map(createWaypoint)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Inventera mera" xmlns="${GPX_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${GPX_NAMESPACE} ${GPX_SCHEMA}">` +
    `<metadata>${metadata}</metadata>${waypoints}</gpx>`;
}

function createWaypoint(observation: Observation): string {
  const { latitude, longitude } = observation.position.wgs84;
  validateCoordinates(latitude, longitude);
  validateTimestamp(observation.observedAt);
  const name = observation.species.preferredName || observation.species.enteredName;
  const details = [
    `Lokal: ${observation.localityName}`,
    observation.species.scientificName
      ? `Vetenskapligt namn: ${observation.species.scientificName}`
      : undefined,
    observation.amount
      ? `Antal: ${observation.amount.value} ${observation.amount.unit}`
      : undefined,
    observation.position.accuracyMeters == null
      ? undefined
      : `Noggrannhet: ${observation.position.accuracyMeters} m`,
    observation.additionalObservers.length
      ? `Med-observatör: ${observation.additionalObservers.join("; ")}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return `<wpt lat="${formatCoordinate(latitude)}" lon="${formatCoordinate(longitude)}">` +
    `<time>${escapeXml(observation.observedAt)}</time>` +
    `<name>${escapeXml(name)}</name>` +
    (observation.publicComment ? `<cmt>${escapeXml(observation.publicComment)}</cmt>` : "") +
    `<desc>${escapeXml(details.join("\n"))}</desc>` +
    `<src>Inventera mera</src><type>Plant observation</type></wpt>`;
}

function validateTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error("En observation har ogiltigt datum och kan inte exporteras.");
  }
}

function validateCoordinates(latitude: number, longitude: number): void {
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    throw new Error("En observation har ogiltiga WGS84-koordinater och kan inte exporteras.");
  }
}

function formatCoordinate(value: number): string {
  return Object.is(value, -0) ? "0" : value.toString();
}

function escapeXml(value: string): string {
  let escaped = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (!isValidXmlCharacter(codePoint)) continue;
    escaped += character
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }
  return escaped;
}

function isValidXmlCharacter(codePoint: number): boolean {
  return codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}
