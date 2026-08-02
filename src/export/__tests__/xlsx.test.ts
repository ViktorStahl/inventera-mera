import { strFromU8, unzipSync } from "fflate";

import type { Observation, SpeciesList, Survey, SurveyLocale } from "@/domain/models";
import {
  createSurveyWorkbook,
  EXCEL_ACCURACY_METERS,
  roundAccuracyForExcel,
  sanitizeFileName,
} from "../xlsx";

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
  taxonomyRef: { packageId: "vascular-plants-starter", name: "Kärlväxter – startlista", version: "2026-07-mvp" },
  surveyDate: "2026-07-31",
  status: "active",
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
};

const locale: SurveyLocale = {
  id: "locale-1",
  surveyId: survey.id,
  name: "Lillåsen, norra delen",
  observedAt: "2026-07-31T10:00:00+02:00",
  timeZone: "Europe/Stockholm",
  position: {
    wgs84: { latitude: 57.7, longitude: 11.9 },
    rt90: { northing: 6400000, easting: 1300000, crs: "EPSG:3847" },
    accuracyMeters: 4.2,
    source: "device",
  },
  note: "Fuktig äng",
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
};

const observation: Observation = {
  id: "observation-1",
  surveyId: survey.id,
  localeId: locale.id,
  observedAt: "2026-07-31T10:14:00+02:00",
  timeZone: "Europe/Stockholm",
  localityName: locale.name,
  timeOverridden: true,
  positionOverridden: false,
  position: locale.position,
  species: { source: "free-text", enteredName: "=Farlig formel" },
  publicComment: "Fuktig äng",
  additionalObservers: ["Ada", "Bo"],
  createdAt: "2026-07-31T08:14:00.000Z",
  updatedAt: "2026-07-31T08:14:00.000Z",
};

const speciesList: SpeciesList = {
  id: "list-1",
  name: "Fjällväxter",
  taxonomyRef: survey.taxonomyRef!,
  createdAt: survey.createdAt,
  updatedAt: survey.updatedAt,
};

describe("Excel export", () => {
  it("emits a locale sheet and the exact mandatory Swedish observation headers", () => {
    const files = unzipSync(createSurveyWorkbook(survey, [locale], [observation]));
    const locales = strFromU8(files["xl/worksheets/sheet2.xml"]!);
    const observations = strFromU8(files["xl/worksheets/sheet3.xml"]!);

    expect(locales).toContain(">Lokalnamn</t>");
    expect(locales).toContain(">Lillåsen, norra delen</t>");
    for (const header of ["Artnamn", "Lokalnamn", "Ost", "Nord", "Noggrannhet", "Startdatum", "Publik kommentar", "Med-observatör"]) {
      expect(observations).toContain(`>${header}</t>`);
    }
    expect(observations).not.toContain(">Antal</t>");
    expect(observations).not.toContain(">Enhet</t>");
    expect(observations).toContain("&apos;=Farlig formel");
    expect(locales).toContain('<c r="D2" s="0"><v>5</v></c>');
    expect(observations).toContain('<c r="E2" s="0"><v>5</v></c>');
  });

  it("rounds export accuracy to the closest approved metre value", () => {
    expect(EXCEL_ACCURACY_METERS).toEqual([
      1, 5, 10, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750,
      1000, 1500, 2000, 2500, 3000, 5000,
    ]);
    expect(roundAccuracyForExcel(0)).toBe(1);
    expect(roundAccuracyForExcel(4.2)).toBe(5);
    expect(roundAccuracyForExcel(7.5)).toBe(10);
    expect(roundAccuracyForExcel(17.5)).toBe(25);
    expect(roundAccuracyForExcel(624)).toBe(500);
    expect(roundAccuracyForExcel(625)).toBe(750);
    expect(roundAccuracyForExcel(8000)).toBe(5000);
  });

  it("includes both Antal and Enhet when any row has amount", () => {
    const withAmount: Observation = { ...observation, amount: { value: 0, unit: "plantor/tuvor" } };
    const files = unzipSync(createSurveyWorkbook(survey, [locale], [withAmount]));
    const sheet = strFromU8(files["xl/worksheets/sheet3.xml"]!);
    expect(sheet).toContain(">Antal</t>");
    expect(sheet).toContain(">Enhet</t>");
    expect(sheet).toContain(">plantor/tuvor</t>");
  });

  it("includes the selected species list in survey metadata", () => {
    const files = unzipSync(createSurveyWorkbook(survey, [locale], [observation], speciesList));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain(">Artlista</t>");
    expect(sheet).toContain(">Fjällväxter</t>");
  });

  it("sanitizes unsafe file names", () => {
    expect(sanitizeFileName('A/B: "test"')).toBe("A-B- -test-");
  });
});
