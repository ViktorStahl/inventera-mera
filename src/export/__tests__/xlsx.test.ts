import { strFromU8, unzipSync } from "fflate";

import type { Observation, Survey } from "@/domain/models";
import { createSurveyWorkbook, sanitizeFileName } from "../xlsx";

const survey: Survey = {
  id: "survey-1",
  title: "Ängsmark vid Lillåsen",
  region: {
    countyCode: "14",
    countyName: "Västra Götalands län",
    municipalityCode: "1480",
    municipalityName: "Göteborg",
    source: "SCB",
    sourceVersion: "2026",
  },
  taxonomyRef: {
    packageId: "vascular-plants-starter",
    name: "Kärlväxter – startlista",
    version: "2026-07-mvp",
  },
  surveyDate: "2026-07-31",
  status: "active",
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
};

const observation: Observation = {
  id: "observation-1",
  surveyId: survey.id,
  observedAt: "2026-07-31T10:14:00+02:00",
  timeZone: "Europe/Stockholm",
  localityName: "Lillåsen, norra delen",
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" },
    accuracyMeters: 4.2,
    source: "device",
  },
  species: { source: "free-text", enteredName: "=Farlig formel" },
  publicComment: "Fuktig äng",
  additionalObservers: ["Ada", "Bo"],
  createdAt: "2026-07-31T08:14:00.000Z",
  updatedAt: "2026-07-31T08:14:00.000Z",
};

describe("Excel export", () => {
  it("emits the exact mandatory Swedish observation headers", () => {
    const files = unzipSync(createSurveyWorkbook(survey, [observation]));
    const sheet = strFromU8(files["xl/worksheets/sheet2.xml"]!);

    for (const header of [
      "Artnamn",
      "Lokalnamn",
      "Ost",
      "Nord",
      "Noggrannhet",
      "Startdatum",
      "Publik kommentar",
      "Med-observatör",
    ]) {
      expect(sheet).toContain(`>${header}</t>`);
    }
    expect(sheet).not.toContain(">Antal</t>");
    expect(sheet).not.toContain(">Enhet</t>");
    expect(sheet).toContain("&apos;=Farlig formel");
  });

  it("includes both Antal and Enhet when any row has amount", () => {
    const withAmount: Observation = {
      ...observation,
      amount: { value: 0, unit: "individer" },
    };
    const files = unzipSync(createSurveyWorkbook(survey, [withAmount]));
    const sheet = strFromU8(files["xl/worksheets/sheet2.xml"]!);
    expect(sheet).toContain(">Antal</t>");
    expect(sheet).toContain(">Enhet</t>");
  });

  it("sanitizes unsafe file names", () => {
    expect(sanitizeFileName('A/B: "test"')).toBe("A-B- -test-");
  });
});
