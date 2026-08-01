import { rt90ToWgs84, wgs84ToRt90 } from "../coordinates";

describe("RT90 coordinate conversion", () => {
  it("matches Lantmäteriet's national direct-projection control example", () => {
    const rt90 = wgs84ToRt90({ latitude: 60.666369395, longitude: 17.132577526 });

    expect(rt90.northing).toBeCloseTo(6_728_420.04, 3);
    expect(rt90.easting).toBeCloseTo(1_572_575.11, 3);
  });

  it("round-trips a position in Sweden with stable axis order", () => {
    const original = { latitude: 57.70887, longitude: 11.97456 };
    const rt90 = wgs84ToRt90(original);

    expect(rt90.northing).toBeGreaterThan(6_100_000);
    expect(rt90.easting).toBeGreaterThan(1_200_000);
    const roundTrip = rt90ToWgs84(rt90);
    expect(roundTrip.latitude).toBeCloseTo(original.latitude, 6);
    expect(roundTrip.longitude).toBeCloseTo(original.longitude, 6);
  });

  it("rejects swapped or out-of-area values", () => {
    expect(() => rt90ToWgs84({ northing: 1_300_000, easting: 6_500_000 })).toThrow(
      "Nord",
    );
  });
});
