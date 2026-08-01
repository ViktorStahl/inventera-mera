import type { ObservationDraft } from "../models";
import { parseAdditionalObservers, validateObservationDraft } from "../validation";

const validDraft: ObservationDraft = {
  date: "2026-07-31",
  time: "10:14",
  localityName: "Lillåsen",
  northing: "6400000",
  easting: "1300000",
  accuracyMeters: "4.5",
  positionSource: "manual-rt90",
  speciesQuery: "Ängsvädd",
  amount: "",
  unit: "",
  publicComment: "",
  additionalObservers: "",
};

describe("observation validation", () => {
  it("requires a unit whenever amount is present", () => {
    const errors = validateObservationDraft({ ...validDraft, amount: "12" });
    expect(errors.unit).toBe("Enhet krävs när antal anges.");
  });

  it("accepts zero with a unit", () => {
    const errors = validateObservationDraft({ ...validDraft, amount: "0", unit: "individer" });
    expect(errors).toEqual({});
  });

  it("rejects calendar rollover dates and out-of-range times", () => {
    const errors = validateObservationDraft({
      ...validDraft,
      date: "2026-02-30",
      time: "24:15",
    });

    expect(errors.date).toBeDefined();
    expect(errors.time).toBeDefined();
  });

  it("parses ordered additional observers", () => {
    expect(parseAdditionalObservers("Ada Lovelace; Carl von Linné,  Eva")).toEqual([
      "Ada Lovelace",
      "Carl von Linné",
      "Eva",
    ]);
  });
});
