import * as Location from "expo-location";
import {
  captureCurrentDevicePosition,
  DevicePositionPermissionError,
} from "../devicePosition";

jest.mock("expo-location", () => ({
  Accuracy: { High: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPosition = Location.getCurrentPositionAsync as jest.Mock;

describe("device position", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns canonical WGS84 and locally derived RT90 coordinates", async () => {
    requestPermission.mockResolvedValue({ granted: true });
    getPosition.mockResolvedValue({
      coords: { latitude: 57.7089, longitude: 11.9746, accuracy: 3.2 },
    });

    const position = await captureCurrentDevicePosition();

    expect(position).toMatchObject({
      wgs84: { latitude: 57.7089, longitude: 11.9746 },
      rt90: { crs: "EPSG:3847" },
      accuracyMeters: 3.2,
      source: "device",
    });
    expect(Number.isFinite(position.rt90.northing)).toBe(true);
    expect(Number.isFinite(position.rt90.easting)).toBe(true);
  });

  it("reports a denied permission distinctly", async () => {
    requestPermission.mockResolvedValue({ granted: false });

    await expect(captureCurrentDevicePosition()).rejects.toBeInstanceOf(
      DevicePositionPermissionError,
    );
    expect(getPosition).not.toHaveBeenCalled();
  });
});
