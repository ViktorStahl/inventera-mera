import type { SurveyLocale } from "@/domain/models";
import { buildLocaleInput, localeToDraft } from "../localeFormData";

const locale: SurveyLocale = {
  id: "locale-1",
  surveyId: "survey-1",
  name: "Lillåsen",
  observedAt: "2026-10-12T09:00:00+02:00",
  timeZone: "Europe/Stockholm",
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6_400_000, easting: 1_300_000, crs: "EPSG:3847" },
    accuracyMeters: 4,
    source: "device",
  },
  useLocaleTimeByDefault: true,
  useLocalePositionByDefault: false,
  createdAt: "2026-10-12T07:00:00.000Z",
  updatedAt: "2026-10-12T07:00:00.000Z",
};

describe("locale form data", () => {
  it("round-trips unchanged date, timezone, device position, and defaults", () => {
    const input = buildLocaleInput(locale.surveyId, localeToDraft(locale), locale);

    expect(input).toMatchObject({
      name: locale.name,
      observedAt: locale.observedAt,
      timeZone: locale.timeZone,
      position: locale.position,
      useLocaleTimeByDefault: true,
      useLocalePositionByDefault: false,
    });
  });

  it("parses comma decimals and removes empty optional text", () => {
    const draft = localeToDraft(locale);
    const input = buildLocaleInput(locale.surveyId, {
      ...draft,
      name: "  Ny lokal  ",
      northing: "6400000,5",
      easting: "1300000,25",
      accuracyMeters: "",
      positionSource: "manual-rt90",
      note: "   ",
    });

    expect(input.name).toBe("Ny lokal");
    expect(input.position.rt90).toEqual({
      northing: 6_400_000.5,
      easting: 1_300_000.25,
      crs: "EPSG:3847",
    });
    expect(input.position.accuracyMeters).toBeUndefined();
    expect(input.note).toBeUndefined();
  });
});
