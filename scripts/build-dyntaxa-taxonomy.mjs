import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { strFromU8, unzipSync } from "fflate";

const ROOT_TAXON_ID = "urn:lsid:dyntaxa.se:Taxon:6000506";
const PACKAGE_ID = "vascular-plants-starter"; // Stable legacy ID; do not break saved surveys.
const SOURCE_ARCHIVE = resolve("dyntaxa-raw/dyntaxa-dwca.zip");
const DATABASE_OUTPUT = resolve("assets/taxonomies/dyntaxa-vascular-plants.db");
const WEB_OUTPUT = resolve("src/data/generated/dyntaxaVascularPlants.json");
const MANIFEST_OUTPUT = resolve("src/data/generated/dyntaxaVascularPlants.manifest.json");
const INCLUDED_RANKS = new Set(["species", "subspecies"]);

const archiveBytes = readFileSync(SOURCE_ARCHIVE);
progress("Reading Darwin Core archive");
const archive = unzipSync(archiveBytes, {
  filter(file) {
    return ["Taxon.csv", "VernacularName.csv", "eml.xml", "meta.xml"].includes(file.name);
  },
});

const taxonRows = parseTsv(requiredArchiveText(archive, "Taxon.csv"));
const vernacularRows = parseTsv(requiredArchiveText(archive, "VernacularName.csv"));
progress(`Parsed ${taxonRows.rows.length} taxon-name rows and ${vernacularRows.rows.length} vernacular-name rows`);
const eml = requiredArchiveText(archive, "eml.xml");
assertColumns(taxonRows.headers, [
  "taxonId",
  "acceptedNameUsageID",
  "parentNameUsageID",
  "scientificName",
  "taxonRank",
  "taxonomicStatus",
  "phylum",
]);
assertColumns(vernacularRows.headers, [
  "taxonId",
  "vernacularName",
  "language",
  "countryCode",
  "isPreferredName",
]);

const acceptedById = new Map();
for (const row of taxonRows.rows) {
  if (row.taxonomicStatus === "accepted") acceptedById.set(row.taxonId, row);
}

const root = acceptedById.get(ROOT_TAXON_ID);
if (!root || root.scientificName !== "Tracheophyta" || root.taxonRank !== "phylum") {
  throw new Error(`Expected ${ROOT_TAXON_ID} to be the accepted Tracheophyta phylum.`);
}

const descendantMemo = new Map([[ROOT_TAXON_ID, true]]);
function isDescendantOfVascularPlants(taxonId) {
  if (descendantMemo.has(taxonId)) return descendantMemo.get(taxonId);
  const visited = [];
  let currentId = taxonId;
  while (currentId && !descendantMemo.has(currentId)) {
    if (visited.includes(currentId)) throw new Error(`Taxonomy cycle detected at ${currentId}.`);
    visited.push(currentId);
    currentId = acceptedById.get(currentId)?.parentNameUsageID;
  }
  const result = descendantMemo.get(currentId) === true;
  for (const visitedId of visited) descendantMemo.set(visitedId, result);
  return result;
}

const selectedRows = [...acceptedById.values()].filter(
  (row) => INCLUDED_RANKS.has(row.taxonRank) && isDescendantOfVascularPlants(row.taxonId),
);
const phylumSelectedRows = [...acceptedById.values()].filter(
  (row) => INCLUDED_RANKS.has(row.taxonRank) && row.phylum === "Tracheophyta",
);
if (selectedRows.length !== phylumSelectedRows.length) {
  throw new Error(
    `Hierarchy selected ${selectedRows.length} taxa but the Darwin Core phylum field selected ${phylumSelectedRows.length}.`,
  );
}

const selectedIds = new Set(selectedRows.map((row) => row.taxonId));
const scientificSynonyms = new Map();
for (const row of taxonRows.rows) {
  if (
    row.taxonomicStatus !== "accepted" &&
    selectedIds.has(row.acceptedNameUsageID) &&
    row.scientificName
  ) {
    appendUnique(scientificSynonyms, row.acceptedNameUsageID, row.scientificName);
  }
}

const swedishNames = new Map();
for (const row of vernacularRows.rows) {
  if (row.language !== "sv" || !selectedIds.has(row.taxonId) || !row.vernacularName) continue;
  const names = swedishNames.get(row.taxonId) ?? [];
  if (!names.some((name) => normalized(name.value) === normalized(row.vernacularName))) {
    names.push({ value: row.vernacularName.normalize("NFC"), preferred: row.isPreferredName === "true" });
  }
  swedishNames.set(row.taxonId, names);
}

let multiplePreferredSwedishNames = 0;
const taxa = selectedRows.map((row) => {
  const names = swedishNames.get(row.taxonId) ?? [];
  const preferredNames = names.filter((name) => name.preferred);
  if (preferredNames.length > 1) multiplePreferredSwedishNames += 1;
  const preferredName = (preferredNames[0] ?? names[0])?.value ?? row.scientificName;
  const aliases = [
    ...(scientificSynonyms.get(row.taxonId) ?? []),
    ...names.filter((name) => normalized(name.value) !== normalized(preferredName)).map((name) => name.value),
  ];
  return [
    row.taxonId,
    preferredName,
    row.scientificName,
    uniqueSorted(aliases, [preferredName, row.scientificName]),
    row.taxonRank === "species" ? "art" : "underart",
    row.taxonomicStatus,
  ];
});
taxa.sort(
  (left, right) =>
    left[1].localeCompare(right[1], "sv") ||
    left[2].localeCompare(right[2], "sv") ||
    left[0].localeCompare(right[0]),
);
progress(`Selected ${taxa.length} accepted species/subspecies below Tracheophyta`);

const publicationDate = matchRequired(eml, /<pubDate>([^<]+)<\/pubDate>/, "EML publication date");
const archiveSha256 = sha256(archiveBytes);
const rankCounts = Object.fromEntries(
  ["art", "underart"].map((rank) => [rank, taxa.filter((taxon) => taxon[4] === rank).length]),
);
const taxaWithPreferredSwedishName = taxa.filter(
  (taxon) => normalized(taxon[1]) !== normalized(taxon[2]),
).length;
const synonymCount = taxa.reduce((sum, taxon) => sum + taxon[3].length, 0);
const version = `${publicationDate}-dwca`;
const rootScientificName = root.scientificName;

// The source archive contains hundreds of thousands of name rows. Release the
// build-only structures before serializing both output formats.
taxonRows.rows.length = 0;
vernacularRows.rows.length = 0;
acceptedById.clear();
descendantMemo.clear();
scientificSynonyms.clear();
swedishNames.clear();
selectedRows.length = 0;
phylumSelectedRows.length = 0;
for (const name of Object.keys(archive)) delete archive[name];

mkdirSync(dirname(DATABASE_OUTPUT), { recursive: true });
mkdirSync(dirname(WEB_OUTPUT), { recursive: true });
rmSync(DATABASE_OUTPUT, { force: true });

progress("Writing native SQLite taxonomy package");
const taxonomyDatabase = new DatabaseSync(DATABASE_OUTPUT);
try {
  taxonomyDatabase.exec(`
    PRAGMA page_size = 4096;
    PRAGMA journal_mode = DELETE;
    CREATE TABLE package_manifest(key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE VIRTUAL TABLE taxon_search USING fts5(
      id UNINDEXED,
      preferred_name,
      scientific_name,
      synonyms,
      taxon_rank UNINDEXED,
      status UNINDEXED,
      tokenize = 'unicode61 remove_diacritics 2'
    );
  `);
  const insertManifest = taxonomyDatabase.prepare(
    "INSERT INTO package_manifest(key, value) VALUES (?, ?)",
  );
  for (const [key, value] of [
    ["packageId", PACKAGE_ID],
    ["version", version],
    ["rootTaxonId", ROOT_TAXON_ID],
    ["entryCount", String(taxa.length)],
    ["sourceArchiveSha256", archiveSha256],
  ]) insertManifest.run(key, value);
  const insertTaxon = taxonomyDatabase.prepare(`INSERT INTO taxon_search
    (id, preferred_name, scientific_name, synonyms, taxon_rank, status)
    VALUES (?, ?, ?, ?, ?, ?)`);
  taxonomyDatabase.exec("BEGIN IMMEDIATE;");
  try {
    for (const taxon of taxa) {
      insertTaxon.run(taxon[0], taxon[1], taxon[2], taxon[3].join(" | "), taxon[4], taxon[5]);
    }
    taxonomyDatabase.exec("COMMIT;");
  } catch (error) {
    taxonomyDatabase.exec("ROLLBACK;");
    throw error;
  }
  taxonomyDatabase.exec("VACUUM;");
  progress("Verifying native SQLite taxonomy package");
  const databaseCount = Number(taxonomyDatabase.prepare("SELECT count(*) AS count FROM taxon_search").get().count);
  if (databaseCount !== taxa.length) {
    throw new Error(`SQLite package contains ${databaseCount} rows; expected ${taxa.length}.`);
  }
} finally {
  taxonomyDatabase.close();
}

progress("Writing web taxonomy package");
writeFileSync(WEB_OUTPUT, `${JSON.stringify({ formatVersion: 1, taxa })}\n`);
const manifest = {
  formatVersion: 1,
  packageId: PACKAGE_ID,
  name: "Kärlväxter (Dyntaxa)",
  version,
  source: "Dyntaxa. Svensk taxonomisk databas",
  sourceDatasetId: "de8934f4-a136-481c-a87a-b0b202b80a31",
  sourceDoi: "https://doi.org/10.15468/j43wfc",
  sourcePublicationDate: publicationDate,
  sourceArchiveSha256: archiveSha256,
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
  rootTaxonId: ROOT_TAXON_ID,
  rootScientificName,
  rootPreferredName: "kärlväxter",
  includedRawRanks: [...INCLUDED_RANKS],
  entryCount: taxa.length,
  rankCounts,
  taxaWithPreferredSwedishName,
  synonymCount,
  multiplePreferredSwedishNames,
  databaseFile: "dyntaxa-vascular-plants.db",
  databaseSha256: sha256(readFileSync(DATABASE_OUTPUT)),
};
writeFileSync(MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
progress("Wrote package manifest");

process.stdout.write(
  `Built ${manifest.name} ${manifest.version}: ${manifest.entryCount} accepted taxa ` +
    `(${rankCounts.art} species, ${rankCounts.underart} subspecies), ` +
    `${taxaWithPreferredSwedishName} with a Swedish name, ${synonymCount} search aliases.\n`,
);

function parseTsv(value) {
  const lines = value.replace(/^\uFEFF/, "").split("\n");
  const headers = (lines.shift() ?? "").replace(/\r$/, "").split("\t");
  const rows = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (!line) continue;
    const values = line.split("\t");
    if (values.length !== headers.length) {
      throw new Error(`Invalid TSV row: expected ${headers.length} fields, received ${values.length}.`);
    }
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }
  return { headers, rows };
}

function requiredArchiveText(archiveFiles, name) {
  const bytes = archiveFiles[name];
  if (!bytes) throw new Error(`Archive is missing ${name}.`);
  return strFromU8(bytes);
}

function assertColumns(headers, required) {
  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`Archive is missing columns: ${missing.join(", ")}.`);
}

function appendUnique(map, key, value) {
  const values = map.get(key) ?? [];
  if (!values.some((current) => normalized(current) === normalized(value))) values.push(value.normalize("NFC"));
  map.set(key, values);
}

function uniqueSorted(values, excluded) {
  const excludedNames = new Set(excluded.map(normalized));
  const unique = new Map();
  for (const value of values) {
    const key = normalized(value);
    if (key && !excludedNames.has(key) && !unique.has(key)) unique.set(key, value.normalize("NFC"));
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right, "sv"));
}

function normalized(value) {
  return String(value).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv");
}

function matchRequired(value, pattern, description) {
  const match = pattern.exec(value);
  if (!match?.[1]) throw new Error(`Could not read ${description}.`);
  return match[1];
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function progress(message) {
  process.stderr.write(`[dyntaxa] ${message}\n`);
}
