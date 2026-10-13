import { strFromU8, unzipSync } from "fflate";

import type { Observation, Survey, SurveyLocale } from "@/domain/models";
import {
  ARTPORTALEN_HEADERS,
  createSurveyWorkbook,
  EXCEL_ACCURACY_METERS,
  roundAccuracyForExcel,
  sanitizeFileName,
} from "../xlsx";

const survey: Survey = {
  id: "survey-1",
  title: "Ängsmark vid Lillåsen",
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
  useLocaleTimeByDefault: false,
  useLocalePositionByDefault: false,
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
  identificationUncertain: false,
  position: locale.position,
  species: { source: "free-text", enteredName: "=Farlig formel" },
  publicComment: "Publik kommentar",
  additionalObservers: ["Ada", "Bo"],
  createdAt: "2026-07-31T08:14:00.000Z",
  updatedAt: "2026-07-31T08:14:00.000Z",
};

describe("Excel export", () => {
  it("matches the fixed single-sheet Artportalen column contract", () => {
    const workbook = readWorkbook([observation]);

    expect(Object.keys(workbook.files).filter((name) => name.startsWith("xl/worksheets/"))).toEqual([
      "xl/worksheets/sheet1.xml",
    ]);
    expect(workbook.workbookXml).toContain('<sheet name="Sheet1" sheetId="1" r:id="rId1"/>');
    expect(readRow(workbook.sheetXml, workbook.sharedStrings, 1)).toEqual(ARTPORTALEN_HEADERS);
    expect(readRow(workbook.sheetXml, workbook.sharedStrings, 2)).toEqual([
      "'=Farlig formel",
      6400000,
      1300000,
      "5m",
      "",
      "",
      46234,
      (10 * 60 + 14) / (24 * 60),
      "Lillåsen, norra delen",
      "Fuktig äng",
      "Publik kommentar",
      "Ada; Bo",
      "",
    ]);
    expect(workbook.sheetXml).toContain('<c r="G2" s="2"><v>46234</v></c>');
    expect(workbook.sheetXml).toContain(`<c r="H2" s="3"><v>${(10 * 60 + 14) / (24 * 60)}</v></c>`);
    expect(workbook.stylesXml).toContain('formatCode="yyyy-mm-dd"');
    expect(workbook.stylesXml).toContain('formatCode="hh:mm"');
  });

  it("rounds RT90 coordinates to whole numeric metres without decimal formatting", () => {
    const withDecimalCoordinates: Observation = {
      ...observation,
      position: {
        ...observation.position,
        rt90: {
          ...observation.position.rt90,
          northing: 6400000.49,
          easting: 1300000.5,
        },
      },
    };
    const workbook = readWorkbook([withDecimalCoordinates]);

    expect(readRow(workbook.sheetXml, workbook.sharedStrings, 2).slice(1, 3)).toEqual([
      6400000,
      1300001,
    ]);
    expect(workbook.sheetXml.match(/<c r="[BC]2" s="4">/g)).toHaveLength(2);
    expect(workbook.stylesXml).toContain(
      '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    );
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

  it("always includes both amount columns and preserves a zero amount with its unit", () => {
    const withAmount: Observation = {
      ...observation,
      amount: { value: 0, unit: "plantor/tuvor" },
    };
    const workbook = readWorkbook([withAmount]);

    expect(readRow(workbook.sheetXml, workbook.sharedStrings, 2).slice(4, 6)).toEqual([
      0,
      "plantor/tuvor",
    ]);
  });

  it("appends the uncertainty column and marks uncertain identifications with X", () => {
    const uncertain = { ...observation, identificationUncertain: true };
    const workbook = readWorkbook([uncertain]);
    const certainWorkbook = readWorkbook([observation]);

    expect(ARTPORTALEN_HEADERS.at(-1)).toBe("Osäker artbestämning");
    expect(readRow(workbook.sheetXml, workbook.sharedStrings, 2).at(-1)).toBe("X");
    expect(readRow(certainWorkbook.sheetXml, certainWorkbook.sharedStrings, 2).at(-1)).toBe("");
  });

  it("writes missing optional values as blank cells", () => {
    const withoutOptionals: Observation = {
      ...observation,
      position: { ...observation.position, accuracyMeters: undefined },
      publicComment: undefined,
      additionalObservers: [],
    };
    const localeWithoutNote: SurveyLocale = { ...locale, note: undefined };
    const files = unzipSync(createSurveyWorkbook(survey, [localeWithoutNote], [withoutOptionals]));
    const sheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const sharedStrings = readSharedStrings(strFromU8(files["xl/sharedStrings.xml"]!));

    expect(readRow(sheetXml, sharedStrings, 2).slice(3, 6)).toEqual(["", "", ""]);
    expect(readRow(sheetXml, sharedStrings, 2).slice(9, 12)).toEqual(["", "", ""]);
  });

  it("keeps the fixed headers for an empty survey", () => {
    const workbook = readWorkbook([]);

    expect(workbook.sheetXml).toContain('<dimension ref="A1:M1"/>');
    expect(workbook.sheetXml).not.toContain('<row r="2">');
  });

  it("sanitizes unsafe file names", () => {
    expect(sanitizeFileName('A/B: "test"')).toBe("A-B- -test-");
  });
});

function readWorkbook(observations: Observation[]): {
  files: Record<string, Uint8Array>;
  workbookXml: string;
  sheetXml: string;
  sharedStrings: string[];
  stylesXml: string;
} {
  const files = unzipSync(createSurveyWorkbook(survey, [locale], observations));
  return {
    files,
    workbookXml: strFromU8(files["xl/workbook.xml"]!),
    sheetXml: strFromU8(files["xl/worksheets/sheet1.xml"]!),
    sharedStrings: readSharedStrings(strFromU8(files["xl/sharedStrings.xml"]!)),
    stylesXml: strFromU8(files["xl/styles.xml"]!),
  };
}

function readSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si><t xml:space="preserve">(.*?)<\/t><\/si>/g)].map((match) =>
    unescapeXml(match[1]!),
  );
}

function readRow(xml: string, sharedStrings: string[], rowNumber: number): (string | number)[] {
  const row = new RegExp(`<row r="${rowNumber}">(.*?)<\\/row>`).exec(xml)?.[1];
  if (!row) throw new Error(`Missing row ${rowNumber}`);
  return [
    ...row.matchAll(/<c r="[A-Z]+\d+" s="\d+"(?: t="(s)")?(?:><v>(.*?)<\/v><\/c>|\/>)/g),
  ].map((match) => {
    if (match[2] == null) return "";
    return match[1] === "s" ? sharedStrings[Number(match[2])]! : Number(match[2]);
  });
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}
