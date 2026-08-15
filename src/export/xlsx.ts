import { strToU8, zipSync } from "fflate";

import type { Observation, Survey, SurveyLocale } from "@/domain/models";

type Cell = {
  value: string | number;
  kind: "blank" | "string" | "number" | "date" | "time";
};

export const ARTPORTALEN_HEADERS = [
  "Artnamn",
  "Nord",
  "Ost",
  "Noggrannhet",
  "Antal",
  "Enhet",
  "Startdatum",
  "Starttid",
  "Lokalnamn",
  "Biotop-beskrivning",
  "Publik kommentar",
  "Med-observatör",
] as const;

export const EXCEL_ACCURACY_METERS = [
  1, 5, 10, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750,
  1000, 1500, 2000, 2500, 3000, 5000,
] as const;

export function roundAccuracyForExcel(accuracyMeters: number): number {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    throw new Error("Noggrannheten måste vara noll eller större.");
  }
  let closest: number = EXCEL_ACCURACY_METERS[0];
  let closestDistance = Math.abs(accuracyMeters - closest);
  for (const candidate of EXCEL_ACCURACY_METERS.slice(1)) {
    const distance = Math.abs(accuracyMeters - candidate);
    if (distance < closestDistance || (distance === closestDistance && candidate > closest)) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest;
}

export function createSurveyWorkbook(
  survey: Survey,
  locales: SurveyLocale[],
  observations: Observation[],
): Uint8Array {
  const localeById = new Map(locales.map((locale) => [locale.id, locale]));
  const sortedObservations = [...observations].sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt),
  );
  const rows: Cell[][] = [
    ARTPORTALEN_HEADERS.map(stringCell),
    ...sortedObservations.map((observation) => {
      const dateTime = localExcelDateTime(observation.observedAt);
      const locale = localeById.get(observation.localeId);
      return [
        safeStringCell(observation.species.preferredName ?? observation.species.enteredName),
        numberCell(observation.position.rt90.northing),
        numberCell(observation.position.rt90.easting),
        observation.position.accuracyMeters == null
          ? blankCell()
          : stringCell(`${roundAccuracyForExcel(observation.position.accuracyMeters)}m`),
        observation.amount ? numberCell(observation.amount.value) : blankCell(),
        safeOptionalStringCell(observation.amount?.unit),
        dateCell(dateTime.dateSerial),
        timeCell(dateTime.timeSerial),
        safeStringCell(observation.localityName),
        safeOptionalStringCell(locale?.note),
        safeOptionalStringCell(observation.publicComment),
        safeOptionalStringCell(observation.additionalObservers.join("; ")),
      ];
    }),
  ];
  const sharedStrings = collectSharedStrings(rows);
  const createdAt = new Date().toISOString();

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
        <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
        <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
        <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
      </Types>`),
    "_rels/.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
      </Relationships>`),
    "docProps/core.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <dc:creator>Inventera mera</dc:creator><dc:title>${escapeXml(survey.title)}</dc:title>
        <cp:lastModifiedBy>Inventera mera</cp:lastModifiedBy>
        <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
      </cp:coreProperties>`),
    "docProps/app.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Inventera mera</Application></Properties>`),
    "xl/workbook.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
      </workbook>`),
    "xl/_rels/workbook.xml.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
      </Relationships>`),
    "xl/styles.xml": xml(stylesXml()),
    "xl/sharedStrings.xml": xml(sharedStringsXml(sharedStrings.values, sharedStrings.count)),
    "xl/worksheets/sheet1.xml": xml(worksheetXml(rows, sharedStrings.indexByValue)),
  };
  return zipSync(files, { level: 6 });
}

export function sanitizeFileName(value: string): string {
  const sanitized = value
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (sanitized || "inventering").slice(0, 80);
}

function collectSharedStrings(rows: Cell[][]): {
  values: string[];
  indexByValue: Map<string, number>;
  count: number;
} {
  const values: string[] = [];
  const indexByValue = new Map<string, number>();
  let count = 0;
  for (const row of rows) {
    for (const cell of row) {
      if (cell.kind !== "string") continue;
      count += 1;
      const value = String(cell.value);
      if (indexByValue.has(value)) continue;
      indexByValue.set(value, values.length);
      values.push(value);
    }
  }
  return { values, indexByValue, count };
}

function worksheetXml(rows: Cell[][], sharedStringIndexes: Map<string, number>): string {
  const lastCell = `L${Math.max(1, rows.length)}`;
  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) =>
          cellXml(cell, rowIndex + 1, columnIndex + 1, rowIndex === 0, sharedStringIndexes),
        )
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <dimension ref="A1:${lastCell}"/>
      <sheetViews><sheetView workbookViewId="0"/></sheetViews>
      <sheetFormatPr defaultRowHeight="15"/>
      <sheetData>${sheetData}</sheetData>
    </worksheet>`;
}

function cellXml(
  cell: Cell,
  row: number,
  column: number,
  header: boolean,
  sharedStringIndexes: Map<string, number>,
): string {
  const reference = `${columnName(column)}${row}`;
  if (cell.kind === "blank") return `<c r="${reference}" s="0"/>`;
  if (cell.kind === "string") {
    const sharedStringIndex = sharedStringIndexes.get(String(cell.value));
    if (sharedStringIndex == null) throw new Error("Exceltexten kunde inte kodas.");
    return `<c r="${reference}" s="${header ? 1 : 0}" t="s"><v>${sharedStringIndex}</v></c>`;
  }
  const style = cell.kind === "date" ? 2 : cell.kind === "time" ? 3 : 0;
  return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
}

function sharedStringsXml(values: string[], count: number): string {
  const items = values
    .map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${values.length}">${items}</sst>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts>
      <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
      <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6E0B4"/><bgColor indexed="64"/></patternFill></fill></fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="4">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
        <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
      </cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`;
}

function localExcelDateTime(value: string): { dateSerial: number; timeSerial: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) throw new Error("Observationen har ett ogiltigt datum.");
  const [, year, month, day, hour, minute, second = "0"] = match;
  const dateSerial =
    Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000 + 25_569;
  const timeSerial =
    (Number(hour) * 3_600 + Number(minute) * 60 + Number(second)) / 86_400;
  return { dateSerial, timeSerial };
}

function safeStringCell(value: string): Cell {
  return stringCell(/^[=+\-@]/.test(value) ? `'${value}` : value);
}

function safeOptionalStringCell(value?: string): Cell {
  return value ? safeStringCell(value) : blankCell();
}

function blankCell(): Cell {
  return { value: "", kind: "blank" };
}

function stringCell(value: string): Cell {
  return { value, kind: "string" };
}

function numberCell(value: number): Cell {
  return { value, kind: "number" };
}

function dateCell(value: number): Cell {
  return { value, kind: "date" };
}

function timeCell(value: number): Cell {
  return { value, kind: "time" };
}

function columnName(column: number): string {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xml(value: string): Uint8Array {
  return strToU8(value.trim());
}
