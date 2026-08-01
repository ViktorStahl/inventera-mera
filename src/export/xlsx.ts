import { strToU8, zipSync } from "fflate";

import type { Observation, SpeciesList, Survey, SurveyLocale } from "@/domain/models";

type Cell = { value: string | number; kind?: "string" | "number" | "date" };

const REQUIRED_OBSERVATION_HEADERS = [
  "Artnamn",
  "Lokalnamn",
  "Ost",
  "Nord",
  "Noggrannhet",
  "Startdatum",
  "Publik kommentar",
  "Med-observatör",
] as const;

export function createSurveyWorkbook(
  survey: Survey,
  locales: SurveyLocale[],
  observations: Observation[],
  speciesList?: SpeciesList,
): Uint8Array {
  const sortedLocales = [...locales].sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt),
  );
  const sortedObservations = [...observations].sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt),
  );
  const includeAmount = sortedObservations.some((observation) => observation.amount);
  const observationHeaders = includeAmount
    ? [...REQUIRED_OBSERVATION_HEADERS, "Antal", "Enhet"]
    : [...REQUIRED_OBSERVATION_HEADERS];

  const surveyRows: Cell[][] = [
    [stringCell("Fält"), stringCell("Värde")],
    [stringCell("Inventerings-ID"), stringCell(survey.id)],
    [stringCell("Titel"), safeStringCell(survey.title)],
    [stringCell("Beskrivning"), safeStringCell(survey.description ?? "")],
    [stringCell("Län"), safeStringCell(`${survey.region.countyCode} ${survey.region.countyName}`)],
    [
      stringCell("Kommun"),
      safeStringCell(
        survey.region.municipalityCode
          ? `${survey.region.municipalityCode} ${survey.region.municipalityName ?? ""}`.trim()
          : "",
      ),
    ],
    [stringCell("Område"), safeStringCell(survey.region.freeText ?? "")],
    [stringCell("Inventeringsdatum"), stringCell(survey.surveyDate)],
    [stringCell("Taxonomi"), safeStringCell(survey.taxonomyRef?.name ?? "Ingen")],
    [stringCell("Taxonomiversion"), safeStringCell(survey.taxonomyRef?.version ?? "")],
    [stringCell("Artlista"), safeStringCell(speciesList?.name ?? "Ingen")],
    [stringCell("Koordinatsystem"), stringCell("RT90 2,5 gon V · nationell direktprojektion (EPSG:3847)")],
    [stringCell("Antal lokaler"), numberCell(locales.length)],
    [stringCell("Antal observationer"), numberCell(observations.length)],
    [stringCell("Exporterad"), stringCell(new Date().toISOString())],
    [stringCell("Schemaversion"), numberCell(3)],
  ];

  const localeHeaders = [
    "Lokalnamn",
    "Ost",
    "Nord",
    "Noggrannhet",
    "Startdatum",
    "Anteckning",
    "Antal observationer",
  ];
  const localeRows: Cell[][] = [
    localeHeaders.map(stringCell),
    ...sortedLocales.map((locale) => [
      safeStringCell(locale.name),
      numberCell(locale.position.rt90.easting),
      numberCell(locale.position.rt90.northing),
      locale.position.accuracyMeters == null
        ? stringCell("")
        : numberCell(locale.position.accuracyMeters),
      dateCell(localExcelSerial(locale.observedAt)),
      safeStringCell(locale.note ?? ""),
      numberCell(sortedObservations.filter((observation) => observation.localeId === locale.id).length),
    ]),
  ];

  const observationRows: Cell[][] = [
    observationHeaders.map(stringCell),
    ...sortedObservations.map((observation) => {
      const row: Cell[] = [
        safeStringCell(observation.species.preferredName ?? observation.species.enteredName),
        safeStringCell(observation.localityName),
        numberCell(observation.position.rt90.easting),
        numberCell(observation.position.rt90.northing),
        observation.position.accuracyMeters == null
          ? stringCell("")
          : numberCell(observation.position.accuracyMeters),
        dateCell(localExcelSerial(observation.observedAt)),
        safeStringCell(observation.publicComment ?? ""),
        safeStringCell(observation.additionalObservers.join("; ")),
      ];
      if (includeAmount) {
        row.push(
          observation.amount ? numberCell(observation.amount.value) : stringCell(""),
          safeStringCell(observation.amount?.unit ?? ""),
        );
      }
      return row;
    }),
  ];

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
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
        <dc:creator>Inventera mera</dc:creator><cp:lastModifiedBy>Inventera mera</cp:lastModifiedBy>
        <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
      </cp:coreProperties>`),
    "docProps/app.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Inventera mera</Application></Properties>`),
    "xl/workbook.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets><sheet name="Survey" sheetId="1" r:id="rId1"/><sheet name="Locales" sheetId="2" r:id="rId2"/><sheet name="Observations" sheetId="3" r:id="rId3"/></sheets>
      </workbook>`),
    "xl/_rels/workbook.xml.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
        <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>`),
    "xl/styles.xml": xml(stylesXml()),
    "xl/worksheets/sheet1.xml": xml(worksheetXml(surveyRows, 2)),
    "xl/worksheets/sheet2.xml": xml(worksheetXml(localeRows, localeHeaders.length)),
    "xl/worksheets/sheet3.xml": xml(worksheetXml(observationRows, observationHeaders.length)),
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

function worksheetXml(rows: Cell[][], columnCount: number): string {
  const lastCell = `${columnName(Math.max(1, columnCount))}${Math.max(1, rows.length)}`;
  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => cellXml(cell, rowIndex + 1, columnIndex + 1, rowIndex === 0)).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <dimension ref="A1:${lastCell}"/>
      <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
      <sheetFormatPr defaultRowHeight="18"/>
      <sheetData>${sheetData}</sheetData>
      <autoFilter ref="A1:${columnName(Math.max(1, columnCount))}${Math.max(1, rows.length)}"/>
    </worksheet>`;
}

function cellXml(cell: Cell, row: number, column: number, header: boolean): string {
  const reference = `${columnName(column)}${row}`;
  if (cell.kind === "number" || cell.kind === "date") {
    const style = cell.kind === "date" ? 2 : header ? 1 : 0;
    return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
  }
  const style = header ? 1 : 0;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>
      <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
      <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF276B4B"/><bgColor indexed="64"/></patternFill></fill></fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="3">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
        <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
      </cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`;
}

function localExcelSerial(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) throw new Error("Observationen har ett ogiltigt datum.");
  const [, year, month, day, hour, minute] = match;
  const milliseconds = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return milliseconds / 86_400_000 + 25_569;
}

function safeStringCell(value: string): Cell {
  return stringCell(/^[=+\-@]/.test(value) ? `'${value}` : value);
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
