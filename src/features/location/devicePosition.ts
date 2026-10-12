import * as Location from "expo-location";

import { wgs84ToRt90 } from "@/domain/coordinates";
import type { Position } from "@/domain/models";

export class DevicePositionPermissionError extends Error {}

export async function captureCurrentDevicePosition(): Promise<Position> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new DevicePositionPermissionError("Position nekades");
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const wgs84 = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
  const rt90 = wgs84ToRt90(wgs84);
  return {
    wgs84,
    rt90: { ...rt90, crs: "EPSG:3847" },
    accuracyMeters: location.coords.accuracy ?? undefined,
    source: "device",
  };
}
