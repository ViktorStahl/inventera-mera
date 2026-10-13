import type { Observation } from "@/domain/models";
import {
  getWgs84CoordinateBounds,
  getWgs84MapBounds,
  observationPoints,
  projectObservation,
} from "../mapGeometry";

function observation(id: string, latitude: number, longitude: number): Observation {
  return {
    id,
    surveyId: "survey-1",
    localeId: "locale-1",
    localityName: "Lillåsen",
    observedAt: "2026-08-15T09:00:00+02:00",
    timeZone: "Europe/Stockholm",
    position: {
      wgs84: { latitude, longitude },
      rt90: { northing: 6_400_000, easting: 1_300_000, crs: "EPSG:3847" },
      source: "manual-rt90",
    },
    timeOverridden: false,
    positionOverridden: false,
    identificationUncertain: false,
    species: { source: "free-text", enteredName: id },
    additionalObservers: [],
    createdAt: "2026-08-15T07:00:00.000Z",
    updatedAt: "2026-08-15T07:00:00.000Z",
  };
}

describe("map geometry", () => {
  const southwest = observation("southwest", 57, 11);
  const northeast = observation("northeast", 59, 15);
  const observations = [southwest, northeast];

  it("creates WGS84 GeoJSON points", () => {
    expect(observationPoints(observations).features.map((feature) => feature.geometry.coordinates))
      .toEqual([[11, 57], [15, 59]]);
  });

  it("pads map bounds and projects north-east above and right of south-west", () => {
    expect(getWgs84MapBounds(observations)).toEqual([10.6, 56.8, 15.4, 59.2]);
    const bounds = getWgs84CoordinateBounds(observations);
    const southwestPoint = projectObservation(southwest, bounds, { width: 200, height: 200 });
    const northeastPoint = projectObservation(northeast, bounds, { width: 200, height: 200 });
    expect(northeastPoint.x).toBeGreaterThan(southwestPoint.x);
    expect(northeastPoint.y).toBeLessThan(southwestPoint.y);
  });
});
