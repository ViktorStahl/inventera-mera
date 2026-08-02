import {
  isObservationUnit,
  isSupportedObservationAmount,
  OBSERVATION_UNITS,
} from "../amount";

describe("observation amount units", () => {
  it("exposes exactly the approved units", () => {
    expect(OBSERVATION_UNITS).toEqual([
      "stjälkar/strån/skott",
      "plantor/tuvor",
      "m2",
      "dm2",
      "cm2",
    ]);
  });

  it("rejects custom units and invalid amount records", () => {
    expect(isObservationUnit("individer")).toBe(false);
    expect(isSupportedObservationAmount({ value: 2, unit: "individer" })).toBe(false);
    expect(isSupportedObservationAmount({ value: -1, unit: "m2" })).toBe(false);
    expect(isSupportedObservationAmount({ value: 2, unit: "plantor/tuvor" })).toBe(true);
    expect(isSupportedObservationAmount(undefined)).toBe(true);
  });
});
