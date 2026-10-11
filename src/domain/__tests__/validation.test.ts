import type { LocaleDraft, ObservationDraft, SurveyDraft } from "../models";
import {
  parseAdditionalObservers,
  validateLocaleDraft,
  validateObservationDraft,
  validateSurveyDraft,
} from "../validation";

describe("survey validation", () => {
  it("accepts a survey without county or municipality data", () => {
    const draft: SurveyDraft = {
      title: "Ängsmark vid Lillåsen",
      description: "",
      surveyDate: "2026-08-12",
      taxonomyPackageId: "dyntaxa-vascular-plants",
      speciesListId: "",
    };

    expect(validateSurveyDraft(draft)).toEqual({});
  });
});

const validDraft: ObservationDraft = {
  date: "2026-07-31",
  time: "10:14",
  timeOverridden: false,
  northing: "6400000",
  easting: "1300000",
  accuracyMeters: "4.5",
  positionSource: "manual-rt90",
  positionOverridden: false,
  speciesQuery: "Ängsvädd",
  amount: "",
  unit: "",
  publicComment: "",
  additionalObservers: "",
  addToSpeciesList: false,
};

describe("observation validation", () => {
  it("requires a unit whenever amount is present", () => {
    const errors = validateObservationDraft({ ...validDraft, amount: "12" });
    expect(errors.unit).toBe("Enhet krävs när antal anges.");
  });

  it("accepts zero with a unit", () => {
    const errors = validateObservationDraft({ ...validDraft, amount: "0", unit: "m2" });
    expect(errors).toEqual({});
  });

  it("rejects a unit outside the fixed list", () => {
    const errors = validateObservationDraft({
      ...validDraft,
      amount: "12",
      unit: "individer" as never,
    });
    expect(errors.unit).toBe("Välj en enhet i listan.");
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

describe("locale validation", () => {
  const locale: LocaleDraft = {
    name: "Lillåsen",
    date: "2026-07-31",
    time: "10:14",
    northing: "6400000",
    easting: "1300000",
    accuracyMeters: "",
      positionSource: "manual-rt90",
      note: "",
      useLocaleTimeByDefault: false,
      useLocalePositionByDefault: false,
  };

  it("requires a name and valid RT90 coordinate", () => {
    const errors = validateLocaleDraft({ ...locale, name: "", northing: "12" });
    expect(errors.name).toBeDefined();
    expect(errors.northing).toBeDefined();
  });
});
