import proj4 from "proj4";

const WGS84 = "EPSG:4326";
const RT90_DIRECT_PROJECTION = "EPSG:3847";

proj4.defs(
  RT90_DIRECT_PROJECTION,
  "+proj=tmerc +lat_0=0 +lon_0=15.806284529 +k=1.00000561024 +x_0=1500064.274 +y_0=-667.711 +ellps=GRS80 +units=m +no_defs +type=crs",
);

export type Wgs84Coordinate = { latitude: number; longitude: number };
export type Rt90Coordinate = { northing: number; easting: number };

export function wgs84ToRt90(coordinate: Wgs84Coordinate): Rt90Coordinate {
  assertFinite(coordinate.latitude, "Latitud");
  assertFinite(coordinate.longitude, "Longitud");
  const [easting, northing] = proj4(WGS84, RT90_DIRECT_PROJECTION, [
    coordinate.longitude,
    coordinate.latitude,
  ]);
  return { northing, easting };
}

export function rt90ToWgs84(coordinate: Rt90Coordinate): Wgs84Coordinate {
  assertRt90(coordinate);
  const [longitude, latitude] = proj4(RT90_DIRECT_PROJECTION, WGS84, [
    coordinate.easting,
    coordinate.northing,
  ]);
  return { latitude, longitude };
}

export function assertRt90(coordinate: Rt90Coordinate): void {
  assertFinite(coordinate.northing, "Nord");
  assertFinite(coordinate.easting, "Öst");
  if (coordinate.northing < 6_100_000 || coordinate.northing > 7_700_000) {
    throw new Error("Nord ligger utanför RT90:s normala område för Sverige.");
  }
  if (coordinate.easting < 1_200_000 || coordinate.easting > 1_900_000) {
    throw new Error("Öst ligger utanför RT90:s normala område för Sverige.");
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} måste vara ett tal.`);
  }
}
