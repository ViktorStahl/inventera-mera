import type { Observation } from "@/domain/models";

export type Wgs84Bounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

export function observationPoints(
  observations: Observation[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: observations.map((observation) => ({
      type: "Feature",
      id: observation.id,
      properties: { id: observation.id },
      geometry: {
        type: "Point",
        coordinates: [observation.position.wgs84.longitude, observation.position.wgs84.latitude],
      },
    })),
  };
}

export function getWgs84MapBounds(
  observations: Observation[],
): [number, number, number, number] | undefined {
  if (observations.length === 0) return undefined;
  const bounds = getWgs84CoordinateBounds(observations);
  const longitudePad = Math.max((bounds.maxLongitude - bounds.minLongitude) * 0.1, 0.002);
  const latitudePad = Math.max((bounds.maxLatitude - bounds.minLatitude) * 0.1, 0.001);
  return [
    bounds.minLongitude - longitudePad,
    bounds.minLatitude - latitudePad,
    bounds.maxLongitude + longitudePad,
    bounds.maxLatitude + latitudePad,
  ];
}

export function getWgs84CoordinateBounds(observations: Observation[]): Wgs84Bounds {
  if (observations.length === 0) {
    return {
      minLatitude: 55,
      maxLatitude: 69,
      minLongitude: 11,
      maxLongitude: 24,
    };
  }
  const latitudes = observations.map((item) => item.position.wgs84.latitude);
  const longitudes = observations.map((item) => item.position.wgs84.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return {
    minLatitude: minLatitude === maxLatitude ? minLatitude - 0.001 : minLatitude,
    maxLatitude: minLatitude === maxLatitude ? maxLatitude + 0.001 : maxLatitude,
    minLongitude: minLongitude === maxLongitude ? minLongitude - 0.002 : minLongitude,
    maxLongitude: minLongitude === maxLongitude ? maxLongitude + 0.002 : maxLongitude,
  };
}

export function projectObservation(
  observation: Observation,
  bounds: Wgs84Bounds,
  size: { width: number; height: number },
): { x: number; y: number } {
  const padding = 24;
  const width = Math.max(1, size.width - padding * 2);
  const height = Math.max(1, size.height - padding * 2);
  const longitudeSpan = Math.max(0.000001, bounds.maxLongitude - bounds.minLongitude);
  const latitudeSpan = Math.max(0.000001, bounds.maxLatitude - bounds.minLatitude);
  return {
    x:
      padding +
      ((observation.position.wgs84.longitude - bounds.minLongitude) / longitudeSpan) * width,
    y:
      padding +
      (1 - (observation.position.wgs84.latitude - bounds.minLatitude) / latitudeSpan) * height,
  };
}
