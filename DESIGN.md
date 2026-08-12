# Inventera mera — product and technical design

Status: MVP implemented; remaining sections describe the production-capable target  
Last updated: 2026-08-12

Platform decision: React Native with Expo for iOS and Android, plus an Expo Web
browser preview. Native remains the field-production target.

Android builds are pinned operationally to JDK 17 through the repository's npm
wrapper. This avoids machine-global JDK upgrades changing the Gradle runtime;
the current Android Gradle Plugin 8.12 declares JDK 17 as its default.

## Implementation status (MVP, 2026-08-02)

The repository contains a working local-only MVP for the requested core flow:
survey list/search/create/open, locale creation, observations within locales,
draft recovery, offline Dyntaxa taxonomy
search with free text, reusable species lists with list-first suggestions and a
default-taxonomy setting, RT90 input and device-position conversion, map filtering,
Excel export, JSON backup/restore, and offline editing and permanent deletion of
surveys, locales, and observations. Data is persisted in SQLite on native
devices and in origin-scoped browser storage in the web preview. Deletion
cascades through the hierarchy and requires explicit destructive confirmation.

The browser preview shares the core routes and uses localStorage, browser file
downloads, browser geolocation, and an RT90 coordinate map. It is responsive but
is not yet an installable/service-worker-backed PWA. The bundled Dyntaxa package
contains 10,711 accepted species and subspecies below the vascular-plant root
from the 2026-06-18 Darwin Core Archive. Native search uses its bundled SQLite
FTS5 database; the browser preview searches a compact generated JSON equivalent.
The map
accepts a MapLibre style URL for the selected Lantmäteriet raster product and
falls back to an offline coordinate plot until the organisation supplies its
approved processed tile endpoint and attribution. Custom taxonomy import,
managed map-package downloads, observation duplication, and reversible survey
archiving remain post-MVP items described below, not claims about the current app.

## 1. Product summary

Inventera mera is a React Native mobile application, built with Expo and
TypeScript, for recording wild-plant observations in the field. A user creates
a survey, chooses a downloaded or custom taxonomy, creates named
locales with a time and RT90 coordinate, records observations within those
locales, reviews them in a list or on a map, and exports the survey to an Excel
workbook. The supported production targets
are iOS and Android phones.

The field workflow is offline-first. Once the app and the selected taxonomy
have been downloaded, loss of reception must not prevent a user from opening a
survey, searching for a species, adding an observation, viewing already cached
map data, or exporting their work.

The attached six-screen mockup is the visual and interaction reference. The
first implementation should follow its compact cards, dark-green app bars,
bottom-right primary action, list/map tabs, and simple single-column forms,
without treating its sample values as a data contract.

The initial interface language is Swedish. Code, persisted field names, and
technical documentation use English. Introduce an i18n layer before adding a
second language. The browser build is a development/evaluation preview rather
than the initial field-production target; reusable domain logic remains
independent of platform views where practical.

## 2. Goals and non-goals

### Goals

- List, search, create, open, edit, and archive surveys.
- Add, edit, and delete locales within a survey.
- Add, edit, duplicate, and delete observations within a locale.
- Capture the current time and device position with minimal taps.
- Enter coordinates manually in RT90 2.5 gon V.
- Search a downloaded Dyntaxa taxonomy, initially vascular plants
  (`Kärlväxter`), by Swedish or scientific name.
- Import and select user-provided taxonomy groups.
- Always allow a species name to be saved as free text.
- Show observations on a map and make an offline map package optional.
- Export one survey and all of its observations to `.xlsx`.
- Keep field data safe across application restarts, app updates, brief failures,
  and loss of connectivity.

### Non-goals for the first release

- Identification of plants from images.
- Publishing observations directly to Artportalen or another external system.
- Multi-user editing, project administration, or conflict resolution.
- Background cloud synchronization. The local data model will be sync-ready,
  but sync is a separately designed feature.
- Navigation, routing, tracks, polygons, or line observations.
- A general taxonomy editor. Custom taxonomies are imported as versioned
  packages; they are distinct from user-maintained species lists.

### Confirmed product decisions

- Swedish is the first interface language; the code remains translation-ready.
- The MVP is local-only. It has no account, login, server-side survey storage,
  or synchronization. JSON backup/restore is the lossless transfer mechanism,
  while Excel is the human/external-system export.
- Surveys do not store a county, municipality, region code, or free-text area.
  Location context belongs to named locales and their coordinates.
- Amount is optional. When an amount is entered, a unit is required and must be
  one of `stjälkar/strån/skott`, `plantor/tuvor`, `m2`, `dm2`, or `cm2`.
  Custom unit text is not supported. Tapping the selected unit again clears it.
- Mobile form screens resize around the software keyboard and scroll the
  focused field into view, including when focus changes while the keyboard is
  already open. Native forms use a keyboard-aware scroll view that follows the
  actual keyboard frame, including IME accessory rows such as Gboard's options,
  and keeps 24 density-independent pixels below the focused input. It does not
  use numeric text-input targets or React Native's legacy scroll-responder
  measurement helper. A drag may dismiss the keyboard without discarding form
  data. Expo Web retains a plain scroll view without native keyboard imports.
- The bundled Dyntaxa taxonomy contains only accepted taxa with raw rank
  `species` or `subspecies` below the accepted `Tracheophyta` root. Non-accepted
  scientific names and alternative Swedish names are searchable aliases, not
  separate selectable taxa. Rank and status remain visible in suggestions.
- Every survey has one selected taxonomy and may reference one reusable species
  list (`artlista`) built against that taxonomy. A new list is empty. Lists may
  contain taxonomy-backed snapshots and free-text species, can be renamed, and
  can have entries added or removed independently of observations.
- Species suggestions are ranked in two strict groups: closest matching entries
  in the survey's species list first, followed by closest matching entries in
  the rest of the selected taxonomy. When saving an observation, the user may
  add its species snapshot to the survey's current list in the same local
  transaction. Duplicate list entries are ignored by normalized identity.
- The app setting `default taxonomy` supplies the initial selection for new
  surveys and species lists. Changing it never changes existing surveys, lists,
  or observation snapshots. The installed MVP choice is the complete configured
  Dyntaxa vascular-plant package of accepted species and subspecies.
- The MVP basemap uses Lantmäteriet's downloadable raster topographic map.
- The field hierarchy is Survey → Locale → Observation. A locale has a required
  name, time, and coordinate plus an optional note.
- `Lokalnamn` is the locale's current name. Observations refer to a locale and
  cannot rename it independently.
- An observation uses its locale's time and coordinate by default. The user can
  override either value independently or return it to live inheritance. Editing
  an inherited locale value therefore updates all non-overridden observations.
- Observation entry keeps the primary task near the top: species and amount
  precede a single inline accordion for time and position. Its compact header
  says whether those values follow the locale or are specific to the
  observation; its fields open directly beneath that header in the same box.
- Excel uses the Swedish interchange columns defined in section 11.
- Excel rounds `Noggrannhet` to the nearest supported metre class: `1`, `5`,
  `10`, `25`, `50`, `75`, `100`, `125`, `150`, `200`, `250`, `300`, `400`,
  `500`, `750`, `1000`, `1500`, `2000`, `2500`, `3000`, or `5000`. Exact ties
  use the higher class; values outside the range use the nearest endpoint. This
  export normalization never changes the locally stored accuracy.
- The local-only MVP allows permanent survey deletion after explicit
  confirmation. It deletes the survey, its locales, their observations, and
  associated drafts in one local operation. Locale deletion similarly cascades
  to its observations. Reversible archiving remains a later feature.
- SQLite schema v2 migrates saved v1 observations by grouping exact locality
  names per survey into locales. The earliest-created observation supplies each
  locale's defaults and differing later values become explicit overrides.
  Existing v1 form drafts are deliberately deleted rather than recovered,
  because their shape is incompatible with the locale workflow.
- SQLite schema v3 adds species lists, list entries, a nullable survey/list
  relation, and application settings. Deleting a list deletes its entries and
  detaches it from surveys; it never deletes or rewrites observations.
- SQLite schema v4 removes all survey region columns and discards saved survey
  form drafts from the earlier shape. Existing surveys, locales, observations,
  taxonomy selections, and species-list relations are preserved. Browser data
  and restored backup versions 1–3 likewise discard obsolete survey region data.

## 3. Primary user and core journeys

The primary user is a field botanist or inventory worker using one hand on a
phone, often in rain, bright light, gloves, or intermittent reception. The
design favours large targets, short forms, explicit save feedback, and retained
drafts over dense desktop controls.

### 3.1 Prepare before going offline

1. Install and open the mobile application.
2. Download the vascular-plant taxonomy or import a custom taxonomy; optionally
   prepare a reusable species list.
3. Create a survey and choose its taxonomy and optional species list.
4. Optionally download a map package covering the field area.
5. See an explicit `Ready offline` status for the app, taxonomy, survey, and
   optional map package.

### 3.2 Create a locale and record an observation

1. Open a survey, add a locale, and enter its name, time, and coordinate.
2. Open the locale and add an observation. Its time and coordinate initially
   follow the locale.
3. If needed, override time and/or coordinate. Tap `My location`; the app obtains WGS84 device coordinates, shows the
   reported accuracy, and transforms them locally to RT90.
4. Search downloaded species names, select a suggestion, or add the typed name
   as free text.
5. If the survey uses a species list, optionally add the observed species to it.
6. Optionally enter amount with unit, a public comment, and additional
   observers, then save.
7. The observation appears immediately in the locale list and survey map with a `Saved on
   this device` confirmation.

### 3.3 Review and export

1. Switch between the observations list and map.
2. Tap an observation or marker to view or edit its details.
3. Open the survey menu and select `Export to Excel`.
4. Save or share the generated workbook using the native OS share sheet.

## 4. Information architecture and routes

| Route | Screen | Purpose |
| --- | --- | --- |
| `/surveys` | Survey list | Search and open surveys; show count and date |
| `/surveys/new` | Create survey | Define title, description, taxonomy, and optional species list |
| `/surveys/:surveyId` | Survey detail | Locale list and survey summary |
| `/surveys/:surveyId/locales/new` | Add locale | Capture locale name, time, coordinate, and note |
| `/surveys/:surveyId/locales/:localeId` | Locale detail | Observation list and locale summary |
| `/surveys/:surveyId/locales/:localeId/edit` | Edit locale | Change or delete a locale |
| `/surveys/:surveyId/locales/:localeId/observations/new` | Add observation | Capture observation fields and overrides |
| `/surveys/:surveyId/map` | Survey map | Filter by locale/species/date and view markers |
| `/surveys/:surveyId/observations/:observationId` | Observation detail/edit | Review and change an observation |
| `/species/select` | Species picker | Search the active taxonomy or use free text |
| `/species-lists` | Species lists | Search, open, and create reusable species lists |
| `/species-lists/new` | Create species list | Name an empty list and choose its taxonomy |
| `/species-lists/:listId` | Species list detail | Rename the list and remove entries |
| `/species-lists/:listId/add` | Add list entries | Add taxonomy matches or free-text species |
| `/taxonomies` | Offline taxonomies | Download, import, update, and remove packages |
| `/settings` | Settings | Choose the default taxonomy; later language/map/storage settings |

Navigation uses typed Expo Router routes and supports platform deep links where
useful. Unsaved form state must survive an application background/termination
or a round-trip to the species picker. Restore the draft and ask before
discarding it.

Navigation history follows the domain hierarchy: survey list → survey → locale
→ observation. After create, edit, or delete actions, dismiss back to the
closest existing canonical parent/detail route instead of pushing or replacing
it with a duplicate. Consequently, Back from a locale goes to its survey and
Back from an observation result goes from locale to survey without revisiting
the locale twice.

## 5. Screen design

### 5.1 Survey list

- Sticky app bar with app title and connection/offline-readiness status.
- Search by survey title, description, or locale name, case- and accent-insensitive.
- Default order: most recently updated first; allow title and survey-date sort.
- Each card shows title, locale and observation counts, survey date, and a chevron.
- Empty state explains how to create the first survey; no-results state keeps
  the search visible.
- Floating add button opens the create-survey screen and has an accessible
  label, not only a plus icon.

### 5.2 Create/edit survey

- Required: title, survey date, and taxonomy.
- Optional: description.
- Taxonomy: one downloaded Dyntaxa/custom package. It defaults from application
  settings and is required for a new survey.
- Species list: optional and limited to lists built against the chosen
  taxonomy. The form can create and select a new empty list without discarding
  other survey fields. Changing taxonomy clears an incompatible list choice.
- A taxonomy that is not present locally cannot be chosen for offline use; the
  screen offers a download/import action without losing entered form values.
- Saving is atomic. On success, navigate to the new survey.

### 5.3 Open survey

- App bar contains back, survey title, and an overflow menu.
- Summary shows survey date, taxonomy name/version, selected species-list name
  (or `Ingen`), and offline status.
- Tabs are `Locales (n)` and `Map`; they remain reachable with screen
  readers and preserve scroll/viewport state when switching.
- Each locale row shows name, date/time, and observation count. Opening a locale
  shows its observations with time, preferred/common name, scientific name,
  amount, and an indication when time or coordinate overrides the locale.
- The MVP shows edit, export, backup, and permanent deletion as visible actions
  below the locale list so they remain discoverable on compact phones. A
  later menu may consolidate these actions when archiving is added.
- Archive is reversible. Permanent deletion requires a second explicit action
  and clearly states that all locales and observations will also be deleted.

### 5.4 Add/edit locale

Fields are required locale name, local date/time, and RT90 coordinate, with
optional accuracy and note. Device GPS can populate both canonical WGS84 and
derived RT90 values. Editing a locale immediately changes its inherited name,
time, or position on dependent observations. Deleting a locale requires
confirmation and deletes all observations in it.

### 5.5 Add/edit observation

The primary form order is:

1. Species, required, either a selected taxon or free text.
2. When the survey has a species list, an optional control to add the current
   taxonomy/free-text species to that list as part of save. It is omitted when
   the normalized species identity is already present.
3. Amount, optional non-negative number. If present, unit is required and is
   selected from exactly `stjälkar/strån/skott`, `plantor/tuvor`, `m2`, `dm2`,
   or `cm2`. The control does not accept custom text and toggles the selected
   unit off when it is pressed again, allowing an accidental choice to be cleared.
4. One accordion whose header identifies the owning locale and states whether
   time/position follow it or are specific to the observation. Expanding it
   reveals local date/time, RT90 Northing/Easting, optional accuracy, and their
   quick actions immediately below the header inside the same bordered box.
   Date/time and coordinates are required and live-inherited unless independently
   overridden. Accuracy is read-only when supplied by device GPS.
5. Public comment (`Publik kommentar`), optional multiline plain text. Make its
   exported/public character clear in the label.
6. Additional observers (`Med-observatör`), optional repeatable names. Trim
   names, preserve spelling and ordering, and prevent empty entries.

The inherited-details section is collapsed for a new or edited observation
whose time and position both follow its locale. It starts expanded for an
existing or restored draft with either override, expands automatically when a
contained field fails validation, and retains its open/closed state during the
current form session. The accordion header remains directly adjacent to the
fields it reveals, so expansion never inserts controls elsewhere in the form.

Defaulting runs only when creating a genuinely new blank form. A restored v2
draft always wins. `Use locale time` and `Use locale position` clear their
respective override instead of copying a new snapshot.

Quick actions set the current time, restore locale time/position, or acquire
the current location. Location capture must show `locating`, `success with
accuracy`, `permission denied`, `unavailable`, and `timed out` states. Saving
is possible after manual coordinate entry even if geolocation fails.

Validate on blur and save. Preserve all entered values after validation errors.
The primary save button is in a persistent footer that follows the native
keyboard frame—including IME accessory rows—and stays above the safe area on
Web. A destructive delete action is only shown when editing an existing
observation.

### 5.6 Species picker

- Search matches preferred Swedish name, scientific name, synonyms, and the
  imported custom aliases, case- and accent-insensitively.
- Suggestions appear after one character, ordered by exact prefix, word prefix,
  substring, then synonym match. Deterministic alphabetical order breaks ties.
- If the survey has a species list, matching list entries form the first result
  group and matching taxonomy entries not in the list form the second. Match
  quality orders results within each group. Both taxonomy-backed and free-text
  list entries participate; taxonomy identities are de-duplicated.
- Results show preferred name, scientific name, and a clear synonym/status
  indication when applicable.
- Limit the first result set (for example, 30 rows) and virtualize longer lists.
- Keyboard, switch-control, and screen-reader selection must work as well as
  touch selection.
- The exact current input is always offered as `Add as free text`, including
  when taxonomy matches exist. Trim outside whitespace but preserve spelling,
  capitalization, accents, and internal whitespace in the saved snapshot.

### 5.7 Map

- Render markers from canonical WGS84 longitude/latitude values.
- Fit all markers on first open, with a sensible maximum zoom; retain the last
  user viewport after that.
- Distinguish the selected marker and the user's current location. Do not imply
  that GPS accuracy is better than the native location API reports.
- Marker selection opens a bottom card with time, locality, species, amount,
  accuracy, and a link to observation detail. Cluster overlapping markers when
  useful.
- The marker overlay and its list remain available offline even if no basemap
  package was downloaded. In that case show a neutral grid/background and the
  message `Basemap unavailable offline` rather than an error or blank screen.
- The layer control shows map source, package date/extent, attribution, and
  whether the current viewport is available offline.
- Filters support one or more locales, one or more species, and an optional
  exact date. Selections within a category use OR; categories combine with AND.
  The filtering itself is local and remains available without reception.

### 5.8 Offline and storage feedback

The global connection indicator distinguishes:

- `Online` — network appears available.
- `Offline · saved on this device` — data entry remains fully functional.
- `Preparing offline data` — a user-requested taxonomy/map download is active.
- `Storage almost full` — storage quota needs attention.

Do not use network-reachability state as proof that a remote service is
reachable. It is only a hint; each network request handles timeout/failure
independently. Never tell a user that local-only data has synced when cloud
synchronization is not part of the release.

## 6. Domain model

All IDs are client-generated UUID v4 values. All records include `createdAt`,
`updatedAt`, and `schemaVersion`. Timestamps are ISO 8601 strings. Mutations run
inside SQLite transactions with foreign-key enforcement enabled.

### 6.1 Survey

```ts
type Survey = {
  id: string;
  title: string;
  description?: string;
  taxonomyRef?: {
    packageId: string;
    name: string;
    version: string;
  };
  speciesListId?: string;
  surveyDate: string; // YYYY-MM-DD; defaults to creation date
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};
```

The taxonomy reference is a snapshot. Removing a taxonomy package does not
remove the name/version from an existing survey or damage its observations.

```ts
type Position = {
  wgs84: { latitude: number; longitude: number };
  rt90: { northing: number; easting: number; crs: "EPSG:3847" };
  accuracyMeters?: number;
  source: "device" | "manual-rt90" | "map";
};
```

### 6.2 Locale

```ts
type SurveyLocale = {
  id: string;
  surveyId: string;
  name: string;
  observedAt: string;
  timeZone: string;
  position: Position;
  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

Locale names are required but are not required to be unique within a survey;
the UUID is identity. Coordinates use the same dual WGS84/RT90 representation
and canonical-input rules as observation coordinate overrides.

### 6.3 Observation

```ts
type Observation = {
  id: string;
  surveyId: string;
  localeId: string;
  // Effective values returned by the repository after live inheritance:
  observedAt: string;
  timeZone: string;
  localityName: string;
  position: Position;
  timeOverridden: boolean;
  positionOverridden: boolean;
  species: {
    source: "taxonomy" | "free-text";
    enteredName: string;
    taxonId?: string;
    preferredName?: string;
    scientificName?: string;
    taxonomyPackageId?: string;
    taxonomyVersion?: string;
  };
  amount?: {
    value: number;
    unit: "stjälkar/strån/skott" | "plantor/tuvor" | "m2" | "dm2" | "cm2";
  };
  publicComment?: string;
  additionalObservers: string[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};
```

Both coordinate representations are persisted to make export auditable and map
rendering fast. For device capture, WGS84 is canonical and RT90 is derived. For
manual RT90 entry, RT90 is canonical input and WGS84 is derived. Edits recompute
the other representation in the same transaction.

SQLite stores nullable time and position override columns. Repository reads
join the owning locale and return the effective values above. `localityName`
is always resolved from the locale's current name and is also materialized into
exports/backups for readability; it is not independently editable.

`amount` is absent as a whole or contains both a value and one of the five
fixed units; a partial amount or custom unit is invalid. Additional observers
are observation-level data because field companions may change during a survey.

### 6.4 Taxonomy package

```ts
type TaxonomyPackage = {
  id: string;
  source: "dyntaxa" | "custom";
  sourceId?: string; // root taxon/list identifier when supplied
  name: string;
  version: string;
  language: string;
  createdAt: string;
  downloadedAt: string;
  checksumSha256: string;
  entryCount: number;
  formatVersion: number;
};

type TaxonSearchEntry = {
  packageId: string;
  taxonId: string;
  preferredName?: string;
  scientificName: string;
  synonyms: string[];
  rank?: string;
  parentTaxonId?: string;
  status?: string;
  normalizedSearchText: string;
};
```

### 6.5 Species list and application settings

```ts
type SpeciesList = {
  id: string;
  name: string;
  taxonomyRef: TaxonomyReference;
  createdAt: string;
  updatedAt: string;
};

type SpeciesListEntry = {
  id: string;
  speciesListId: string;
  speciesKey: string; // package+taxon ID, or normalized free-text identity
  species: SpeciesSnapshot;
  createdAt: string;
};

type AppSettings = {
  defaultTaxonomyPackageId: string;
};
```

`(speciesListId, speciesKey)` is unique. Species snapshots in lists have the
same historical/provenance semantics as observation snapshots. A list belongs
to exactly one taxonomy package; free-text entries remain allowed. A list may
be shared by several surveys and changes are immediately reflected in future
suggestions for all of them.

### 6.6 Local operation metadata

Records should include a monotonic local revision and tombstones for deleted
records so a later sync feature can be added without changing field-data
semantics. Do not implement a remote sync queue until its server contract,
identity model, conflict policy, and privacy requirements are designed.

## 7. Coordinates and geospatial behaviour

RT90 2.5 gon V is formally EPSG:3021. For transformations from GPS-compatible
WGS84/SWEREF 99 coordinates, Lantmäteriet instructs PROJ users to request
EPSG:3847, the national direct-projection emulation; asking for EPSG:3021 selects
an older transformation. The client therefore performs deterministic offline
transformations with the official direct-projection parameters and records
EPSG:3847 as the transformation CRS.

Rules:

- UI and export use the explicit labels `RT90 Northing (X)` and `RT90 Easting
  (Y)`; do not use two unlabeled numeric inputs.
- Retain metre precision from conversion. Display whole metres by default but
  do not silently discard additional stored precision. The only normalization
  is the explicit Excel accuracy classification defined in section 11; it does
  not mutate the stored position.
- Reject non-finite values and values outside the official EPSG area of use;
  warn, rather than silently swapping, when values look reversed.
- Validate the transformation against fixed control points in Sweden and test a
  WGS84 → RT90 → WGS84 round trip within the selected library's documented
  tolerance.
- Include CRS, axis names, and location source in export.
- The application is not a cadastral/surveying instrument. Display the device's
  accuracy and state that coordinate precision does not guarantee field
  accuracy.

Lantmäteriet documents direct planar transformation between SWEREF 99 and RT90
2.5 gon V and publishes both the parameters and control points. Use those
references to review implementation rather than inventing projection parameters.

## 8. Taxonomy acquisition and offline search

### 8.1 Dyntaxa source

Dyntaxa is continuously maintained and contains preferred names, synonyms, and
taxonomic relationships. The bundled source is the Dyntaxa Darwin Core Archive
published 2026-06-18 (dataset `de8934f4-a136-481c-a87a-b0b202b80a31`, DOI
`10.15468/j43wfc`, CC0 1.0). Its authoritative vascular-plant root is the
accepted phylum `Tracheophyta`, Dyntaxa ID
`urn:lsid:dyntaxa.se:Taxon:6000506`, with preferred Swedish name `kärlväxter`.

The package includes an accepted taxon only when it descends from that root via
`parentNameUsageID` and its Darwin Core `taxonRank` is exactly `species` or
`subspecies`. The build cross-checks this hierarchy selection against the
archive's denormalized `phylum = Tracheophyta` value. Scientific synonym rows
that refer to one of the selected accepted taxa and alternative Swedish
vernacular names are retained as search aliases. Higher ranks, varieties,
forms, hybrids, aggregates, non-accepted duplicate results, and taxa outside
vascular plants are excluded.

Do not call protected Dyntaxa endpoints directly from the mobile client with a
secret.
Create taxonomy packages in a build/admin job. For the bundled package, place
the source at `dyntaxa-raw/dyntaxa-dwca.zip` and run
`npm run taxonomy:build`. The source directory is ignored by Git; the generated
SQLite database, web dataset, and manifest are versioned application assets.

The build job must:

1. Download the official archive/API data under its current terms.
2. Select the target taxonomic subtree and supported ranks/statuses.
3. Normalize the minimal search fields and preserve source IDs.
4. Produce a versioned SQLite package with FTS5 search tables, a compact web
   equivalent, and a small manifest with record count, source date,
   licence/citation, and SHA-256 checksums.
5. Bundle the MVP package with the application. A future catalogue may publish
   packages over HTTPS; the app then downloads to a staging file, verifies the
   checksum and format, then atomically moves and activates it.
6. Keep the previous version until activation succeeds; allow rollback/removal
   when it is not the only copy needed for an active survey.

Searching the active native package is entirely local through parameterized
SQLite FTS5/prefix queries. Native code never loads the entire taxonomy into
JavaScript or the React Native render thread and queries only result fields
needed by the species picker. The Expo Web preview has no native SQLite layer;
it uses the generated compact tuple dataset and performs the equivalent local,
accent-insensitive search without network access.

### 8.2 Custom taxonomy import

Accept UTF-8 CSV in the first release with these columns:

```text
id,preferredName,scientificName,synonyms,rank,parentId
```

Only `preferredName` or `scientificName` is required per row. `id` is optional;
generate a deterministic package-scoped ID if absent. Separate synonyms with
`|`. Import shows column mapping, validation errors with row numbers, a preview,
and the final count before committing. Duplicate names are allowed but shown as
separate choices. The original file name, checksum, and import date are kept in
package metadata.

## 9. Offline-first architecture

### 9.1 Chosen stack

- React Native + TypeScript, managed with Expo.
- Expo Router for file-based, typed navigation and deep links.
- Expo development builds and the React Native new architecture; Expo Go is
  useful only for modules it contains and is not the application runtime.
- `expo-sqlite` with WAL mode, foreign keys, explicit migrations, prepared
  statements, and FTS5 for taxonomy search.
- `expo-location` for foreground, user-initiated position capture. Background
  location is not requested for the first release.
- `expo-file-system` for downloaded packages, backups, and generated exports.
- `expo-sharing` and the platform share sheet for `.xlsx` and backup files.
- MapLibre React Native/MapLibre Native for maps and managed offline regions.
- `expo-network` as a reachability hint, never as a substitute for request error
  handling.
- A reviewed JavaScript projection library such as `proj4` for WGS84 ↔ the
  EPSG:3847 RT90 direct-projection emulation, isolated behind a tested domain
  adapter.
- A React-Native-compatible `.xlsx` writer verified in the Expo development
  build; evaluate ExcelJS and SheetJS against licensing, memory, formula-safety,
  and file-output requirements before selecting one.
- Jest and React Native Testing Library for units/components, plus Maestro or
  Detox for native end-to-end journeys after an early device-test spike.

Confirm exact Expo SDK and package versions, platform requirements, licences,
new-architecture compatibility, and binary impact at implementation time; this
document intentionally does not pin versions.

### 9.2 Storage boundaries

| Data | Storage | Strategy |
| --- | --- | --- |
| Application code/static assets | Native application bundle | Versioned release or controlled Expo Update |
| Surveys/locales/observations/species lists/settings/drafts | Application SQLite database | Local source of truth, transactions, backed up |
| Taxonomy metadata | Application SQLite database | Active-version pointer and provenance |
| Taxonomy packages | Application document directory as SQLite files | Staged, checksum verified, atomically activated |
| Map regions | MapLibre Native offline storage | User initiated, bounded, provider-authorized |
| Future non-domain UI preferences | Async key/value settings | Non-critical only; never survey data |
| Tokens/credentials for future sync | SecureStore/Keychain/Keystore | Small secrets only |

Before large downloads, check available disk space and package size. Never
evict surveys, observations, or drafts automatically. Map regions are the first
safe eviction candidates, then unused taxonomy versions, always with explicit
user confirmation before removing downloaded data.

### 9.3 Application lifecycle and updates

- The application code and core assets ship in the native binary and work
  without a first online launch after installation.
- Handle foreground, background, inactive, low-memory, and termination states;
  persist drafts before the app becomes inactive where the OS permits.
- Use signed app-store releases. If Expo Updates is enabled, configure signed
  updates, runtime-version compatibility, rollback, and a safe activation point
  so an open observation draft is not interrupted.
- Do not accept an HTTP error body or incomplete response as a taxonomy/map
  package. Download to a unique staging path and verify before activation.
- Treat native application version, Expo runtime version, and SQLite migration
  version separately.
- Build development clients whenever native dependencies/configuration change,
  and verify release builds independently of the Metro development server.

### 9.4 Write guarantees and recovery

- Save observation form drafts to SQLite after meaningful changes (debounced)
  and immediately when the app becomes inactive/backgrounded where supported.
- Save the final observation in one transaction, then remove its draft.
- Disable repeat submission while committing and enforce unique IDs so retrying
  cannot create a duplicate.
- Provide downloadable JSON backup and validated restore in addition to Excel.
  Excel is an interchange/report format, not a lossless application backup.
- Keep the app usable if an application update, taxonomy update, or map download
  fails; report the failed optional operation separately.
- The schema v1 → v2 migration preserves saved observations by creating locales
  as described in Confirmed product decisions. It clears all v1 drafts. This is
  an intentional one-time exception to draft recovery, approved because the old
  form has no locale identity or independent override semantics.
- The schema v2 → v3 migration preserves field records and adds `species_lists`,
  `species_list_entries`, `surveys.species_list_id`, and the singleton
  `app_settings` row. Old observation drafts default the new add-to-list flag to
  false; an existing user edit is never overwritten.
- The schema v3 → v4 migration preserves surveys and their child records while
  removing the seven obsolete survey-region columns. Survey create/edit drafts
  are discarded because their saved shape contains those removed fields.
- JSON backup format v4 includes the survey's currently selected species list
  and all of its entries. Restore validates the relation and taxonomy. If the
  same shared list already exists locally, restore merges missing entries
  without deleting newer local entries. Restoring formats v1–v3 is supported,
  but any legacy survey-region object is deliberately discarded.
- The fixed amount-unit decision does not add a SQLite schema migration. On
  startup, native and browser repositories permanently delete observations
  whose amount is negative, partial, or uses another unit, and discard
  observation drafts with an unsupported saved unit. Backup restore likewise
  omits incompatible observations. This intentional data-loss policy was
  explicitly accepted for the local-only MVP.

## 10. Map-source strategy

MapLibre Native is the rendering layer, not the data licence. Configure sources
behind an adapter and display the attribution required by the selected source.

### Chosen MVP source

Use Lantmäteriet's downloadable raster topographic map for the MVP. It is a
better field-inventory fit than a general street map:

- Start with `Topografisk webbkarta Nedladdning, raster` for the fastest MVP
  path. Lantmäteriet describes it as a zoomable map intended for situations
  where its online viewing services cannot be reached. Preprocess approved
  source data into bounded regions and serve it from an organisation-controlled
  tile endpoint that MapLibre Native can download into offline regions.
- `Topografi 10 Nedladdning, vektor` is a later enhancement. It includes land types,
  roads, hydrography, buildings, and reviewed place names and supports a custom,
  botanist-oriented style. This gives more control and potentially better
  compact vector packages, but requires a tile-generation and styling pipeline.
- Confirm the exact dataset version, access method, personal-data conditions,
  redistribution terms, attribution, and update process with Lantmäteriet
  before publishing packages. Persist these details in each package manifest.

The local-only MVP may still use a static distribution service for public map
and taxonomy packages; `local-only` means that surveys and observations are not
uploaded.

### Deferred alternatives

- OSM-derived self-hosted vector tiles are the open fallback if the
  Lantmäteriet pipeline blocks delivery. Preserve ODbL attribution and publish
  through infrastructure intended for application traffic.
- Mapbox has first-class mobile offline regions and can accelerate a prototype,
  but introduces a proprietary SDK, account/billing, offline limits, and vendor
  lock-in. Adopting it would replace the MapLibre decision and requires explicit
  product approval.
- MapTiler supports offline MBTiles/data extracts, but MapTiler Cloud's standard
  terms prohibit bulk tile download unless separately agreed. Use only a data
  extract or agreement that expressly covers the intended offline workflow.
- OpenTopography remains an optional terrain/elevation source, not the default
  basemap.
- Never implement an offline-download button against
  `tile.openstreetmap.org`; OSMF's tile policy expressly prohibits prefetch and
  offline use of that service.

Before final selection, an early spike must prove download, pause/resume,
checksum/activation, deletion, attribution, and offline rendering on physical
iOS and Android devices for one representative Swedish municipality at the
intended zoom levels.

Minimum map-package metadata: ID, source, version/date, bounds, minimum/maximum
zoom, byte size, checksum, attribution text/link, licence link, downloadedAt,
and lastUsedAt.

## 11. Excel export contract

Generate `<sanitized survey title>_<YYYY-MM-DD>.xlsx` in the application cache
or document directory, without uploading data. The workbook contains:

### Sheet `Survey`

| Field | Value |
| --- | --- |
| Survey ID | UUID |
| Title | Survey title |
| Description | Optional description |
| Survey date | ISO date |
| Taxonomy | Name, source, and version |
| Species list | Selected list name, or `Ingen` |
| Locale count | Integer |
| Observation count | Integer |
| Exported at | ISO timestamp with offset |
| Application/schema version | Version identifiers |

### Sheet `Locales`

One row per locale with `Lokalnamn`, `Ost`, `Nord`, `Noggrannhet`,
`Startdatum`, `Anteckning`, and `Antal observationer`. This is contextual app
data; the mandatory external observation interchange contract remains on the
next sheet. `Noggrannhet` uses the same rounded export class as observations.

### Sheet `Observations`

One row per observation, sorted by `observedAt`. The first eight column names
are mandatory and exact:

| Column | Mapping |
| --- | --- |
| `Artnamn` | Preferred-name snapshot when available; otherwise the exact free-text/entered name |
| `Lokalnamn` | Current name of the observation's owning locale |
| `Ost` | RT90 easting (Y), numeric metres |
| `Nord` | RT90 northing (X), numeric metres |
| `Noggrannhet` | Location accuracy rounded to the nearest supported metre class; blank when unknown |
| `Startdatum` | Observation date/time as a real Excel date cell, displayed `yyyy-mm-dd hh:mm` |
| `Publik kommentar` | Public comment; blank when absent |
| `Med-observatör` | Additional observer names joined with `; `; blank when absent |

`Antal` is optional at workbook level. If at least one observation has an
amount, append both `Antal` and `Enhet`; never emit one without the other. Rows
without an amount leave both cells blank. Application validation guarantees
that every numeric `Antal` uses one of `stjälkar/strån/skott`, `plantor/tuvor`,
`m2`, `dm2`, or `cm2` in `Enhet`.

The supported `Noggrannhet` classes are `1`, `5`, `10`, `25`, `50`, `75`,
`100`, `125`, `150`, `200`, `250`, `300`, `400`, `500`, `750`, `1000`, `1500`,
`2000`, `2500`, `3000`, and `5000` metres. Export chooses the closest value,
breaks an exact midpoint upward, clamps below/above the range to `1`/`5000`,
and leaves unknown accuracy blank. The original value remains in SQLite and
the lossless JSON backup.

Keep this sheet limited to the interchange columns above so downstream imports
are not broken by application metadata. The `Survey` sheet carries contextual
metadata, and the JSON backup carries the complete lossless record including
IDs, taxonomy provenance, both coordinate systems, and audit timestamps.

Freeze/filter the header row, wrap comments, and prevent strings beginning with
`=`, `+`, `-`, or `@` from becoming formulas (formula injection). Display an
explicit success/failure result and test Swedish characters, long comments,
free-text species, multiple observers, blank accuracy, zero amount with unit,
conditional amount columns, and an empty survey. Offer the native share sheet
after generation and a `Save to Files` or equivalent platform action. Delete
temporary export files according to a clear retention policy; do not delete
explicit backups.

## 12. Accessibility and responsive behaviour

- Meet WCAG 2.2 AA for implemented flows.
- Minimum touch target 44 × 44 CSS pixels and visible keyboard focus.
- Do not rely on green/red or icons alone for meaning.
- Use semantic headings, landmarks, forms, labels, status messages, dialogs,
  and tabs. Announce saved/offline/error state without stealing focus.
- Keep text readable at 200% zoom and with user font scaling.
- Respect safe-area insets and reduced-motion preferences.
- Test supported compact phone sizes, dynamic type, and both portrait and
  landscape where the application permits rotation.
- On tablets, constrain forms to a readable width; the phone flow remains
  canonical rather than becoming a separate tablet application.

## 13. Security and privacy

- Surveys and exact coordinates can be sensitive. Keep them local by default,
  make export an explicit action, and explain where data is stored.
- Request geolocation only after a user taps `My location`; explain denial and
  allow manual entry.
- No analytics, error-report payloads, or logs may contain exact coordinates,
  notes, survey titles, or species names without a separate consent/privacy
  design.
- Escape user text in UI, sanitize file names, protect spreadsheet cells from
  formula injection, and validate imported package schemas/sizes.
- Use HTTPS with platform transport-security requirements for packages and any
  future API.
- Keep API/subscription keys server-side or in a controlled build job.
- A future sync feature requires authentication, authorization, encryption,
  retention, deletion, audit, and conflict-resolution design before launch.

## 14. Error and edge-case behaviour

- **Taxonomy unavailable:** an existing observation can still retain its saved
  snapshot, but a new survey must choose an installed taxonomy; free-text
  observation entry remains available within that survey.
- **Taxonomy download interrupted:** keep the old version; delete staging data;
  offer retry.
- **Taxon renamed/removed:** existing observation snapshots do not change; new
  picker results use the active package.
- **No GPS permission/fix:** manual RT90 entry remains available.
- **Poor GPS accuracy:** show the value and warning but allow save.
- **Coordinates reversed/outside Sweden:** block clearly impossible values and
  suggest checking Northing/Easting; never swap silently.
- **No offline basemap:** show markers on a neutral spatial background and link
  to offline-map settings.
- **Storage pressure:** protect manual records/drafts and offer removal of map
  packs or unused taxonomy versions.
- **Process termination/crash during entry:** restore the draft.
- **Duplicate save tap:** one observation only.
- **Clock/time-zone change:** retain the recorded instant, numeric offset, and
  IANA zone; edits are explicit.
- **Export too large:** generate asynchronously with progress and clear failure;
  do not mutate source records.

## 15. Testing strategy

### Unit and property tests

- Survey/locale/observation validation, fixed amount units, incompatible-data
  cleanup, and migrations.
- Locale live inheritance, independent time/position overrides, restored v2
  drafts, and clearing incompatible v1 drafts.
- Coordinate control points, bounds, axis order, and round trips.
- Dyntaxa subtree/rank selection, package manifest consistency, taxonomy
  normalization/ranking, and CSV import validation.
- Species-list identity, list-first ranking, shared-list deletion, schema v3/v4
  migrations (including region removal), and backup merge behaviour.
- File-name/cell sanitization, workbook column mapping, and GPS-accuracy class
  boundaries.
- Date/time-zone and daylight-saving boundaries.

### Component tests

- All form states, draft restoration, error focus, and free-text path.
- Observation-details accordion adjacency, collapse/expand state,
  override/error auto-expansion, status wording, and keyboard-sticky save action.
- Species keyboard/touch selection and accessible announcements.
- Online/offline/storage indicators.
- Map fallback without a basemap.

### End-to-end tests

1. Install the release-like build, go offline, create a survey and locale, add a
   GPS/manual observation, terminate/relaunch the app, and verify persistence.
2. Download a taxonomy, go offline, find by Swedish/scientific/synonym name, and
   save; also save unmatched free text and add both kinds to a species list.
3. Interrupt taxonomy/map download and verify existing data still works.
4. Create locales and observations, filter markers by locale/species offline,
   edit inherited and overridden values, and export.
5. Upgrade from the previous SQLite schema with data intact.
6. Run critical flows on the smallest supported phone, with dynamic type,
   external keyboard where applicable, and VoiceOver/TalkBack audits.

Test release builds on currently supported iOS and Android versions and on
representative physical phones, including airplane mode, process termination,
low-storage conditions, location denial, file sharing, and app upgrade. Do not
treat simulator or Expo Go results as release verification.

## 16. Delivery phases and acceptance criteria

### Phase 1 — native local field notebook

- Signed Expo development builds install on iOS and Android test devices and
  launch in airplane mode without Metro or a prior online application launch.
- User can create/open/archive surveys and search the list.
- User can add/edit/delete locales with name, time, coordinate, and note.
- User can add/edit/delete observations with inherited or overridden time and
  coordinate, free-text species, optional amount/unit, public comment,
  additional observers, and v2 draft recovery.
- Records survive process termination and application restart.

### Phase 2 — location and taxonomy

- Device location transforms to RT90 offline and displays accuracy.
- Fixed control-point tests prove axis order and acceptable transformation.
- The bundled vascular-plant taxonomy can be searched offline by Swedish name,
  scientific name, and retained synonym.
- A valid custom CSV taxonomy can be previewed, imported, selected, and removed.
- Updating/removing taxonomy data does not alter historical observations.

### Phase 3 — map and export

- All positioned observations render and can be selected on the map.
- Lantmäteriet raster map regions can be downloaded, rendered, and removed on
  supported devices under the approved source terms; markers still work when
  no package covers the viewport.
- Export produces the documented three-sheet `.xlsx` fully offline.
- Required map/taxonomy attribution and provenance are visible.

### Phase 4 — production hardening

- Critical E2E offline scenarios pass in release-like builds on supported iOS
  and Android devices.
- Accessibility audit has no critical/serious issues in core journeys.
- Quota handling, interrupted downloads, migrations, backup/restore, and update
  recovery are tested.
- Performance budgets are agreed and met on a representative mid-range phone;
  target initial cached shell interaction under 2 seconds and species search
  feedback under 100 ms for common prefix queries.

## 17. Decisions requiring product confirmation

These do not block the local-first foundation, but must be resolved before the
corresponding feature is finalized:

1. What is the required coordinate accuracy/tolerance, and must original raw
   GPS readings be retained for audit?
2. Which deployment organisation will host taxonomy and offline map packages,
   and which Lantmäteriet/provider terms has it approved?
3. What retention, encryption, and device-loss requirements apply to sensitive
   species locations?
4. What are the final app name, icon/branding, iOS bundle identifier, Android
   application ID, supported OS versions, and distribution accounts?

## 18. Authoritative references

- [Lantmäteriet: RT 90–SWEREF 99 transformation](https://www.lantmateriet.se/sv/geodata/gps-geodesi-och-swepos/Transformationer/RT-90---SWEREF-99/)
- [Lantmäteriet: RT 90 reference system](https://www.lantmateriet.se/sv/geodata/gps-geodesi-och-swepos/Referenssystem/Tvadimensionella-system/RT-90/)
- [EPSG registry: RT90 2.5 gon V, EPSG:3021](https://epsg.org/crs_3021/RT90-2-5-gon-V.html)
- [Lantmäteriet: Swedish transformations in PROJ](https://www.lantmateriet.se/globalassets/geodata/gps-och-geodetisk-matning/svenska-transformationer-i-proj-web.pdf)
- [Lantmäteriet: RT90/SWEREF 99 control points](https://www.lantmateriet.se/contentassets/0f296052c56d425bb180430084d491d9/kontrollpunkter.pdf)
- [SLU Artdatabanken: Dyntaxa](https://www.slu.se/artdatabanken/arter-och-natur/taxonomi/dyntaxa/)
- [SLU Artdatabanken: taxonomic APIs and Darwin Core export](https://www.slu.se/artdatabanken/rapportering-och-fynd/oppna-data-och-apier/om-slu-artdatabankens-apier/apier-for-taxonomisk-information/)
- [SLU Artdatabanken developer portal](https://api-portal.artdatabanken.se/)
- [OpenStreetMap Foundation tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [OpenTopography developer resources](https://opentopography.org/developers)
- [Lantmäteriet: Topografi 10 Nedladdning, vektor](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/topografi-10-nedladdning-vektor/)
- [Lantmäteriet: downloadable topographic-map alternatives](https://www.lantmateriet.se/sv/geodata/vara-produkter/Produktnyheter/Geografisk-information/avveckling-av-produkten-topografisk-webbkarta-visning-oversiktlig/)
- [Mapbox: mobile offline maps](https://docs.mapbox.com/help/dive-deeper/mobile-offline/)
- [MapTiler: mobile and offline map options](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-build-mobile-apps-with-maps-using-sdk/)
- [MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/)
- [Expo: development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Expo: SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo: Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [MapLibre React Native](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
