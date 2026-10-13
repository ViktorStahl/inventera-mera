import type { SurveyLocale } from "@/domain/models";
import { timeLocal, todayLocal } from "@/domain/time";
import {
  newObservationDraft,
  shouldAutomaticallyCapturePosition,
} from "../observationDefaults";

const locale: SurveyLocale = {
  id: "locale-1",
  surveyId: "survey-1",
  name: "Lillåsen",
  observedAt: "2026-10-10T09:15:00+02:00",
  timeZone: "Europe/Stockholm",
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6_400_000, easting: 1_300_000, crs: "EPSG:3847" },
    accuracyMeters: 5,
    source: "device",
  },
  useLocaleTimeByDefault: false,
  useLocalePositionByDefault: false,
  createdAt: "2026-10-10T07:15:00.000Z",
  updatedAt: "2026-10-10T07:15:00.000Z",
};

describe("new observation locale defaults", () => {
  it("uses current time and starts ready for automatic position capture by default", () => {
    const now = new Date("2026-10-11T12:34:00.000Z");
    expect(newObservationDraft(locale, now)).toMatchObject({
      date: todayLocal(now),
      time: timeLocal(now),
      timeOverridden: true,
      identificationUncertain: false,
      northing: "",
      easting: "",
      accuracyMeters: "",
      positionSource: "manual-rt90",
      positionOverridden: true,
      latitude: undefined,
      longitude: undefined,
    });
  });

  it("inherits only the values enabled on the locale", () => {
    expect(newObservationDraft({
      ...locale,
      useLocaleTimeByDefault: true,
      useLocalePositionByDefault: true,
    })).toMatchObject({
      date: "2026-10-10",
      time: "09:15",
      timeOverridden: false,
      identificationUncertain: false,
      northing: "6400000",
      easting: "1300000",
      accuracyMeters: "5",
      positionSource: "device",
      positionOverridden: false,
      latitude: 57.7,
      longitude: 11.9,
    });
  });

  it("automatically captures position only for a fresh observation that does not inherit it", () => {
    expect(shouldAutomaticallyCapturePosition(locale, false, false)).toBe(true);
    expect(shouldAutomaticallyCapturePosition({
      ...locale,
      useLocalePositionByDefault: true,
    }, false, false)).toBe(false);
    expect(shouldAutomaticallyCapturePosition(locale, true, false)).toBe(false);
    expect(shouldAutomaticallyCapturePosition(locale, false, true)).toBe(false);
  });
});
