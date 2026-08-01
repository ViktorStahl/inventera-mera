# Inventera mera — product and technical design

Status: MVP implemented; remaining sections describe the production-capable target  
Last updated: 2026-07-31

Platform decision: React Native with Expo for iOS and Android, plus an Expo Web
browser preview. Native remains the field-production target.

Android builds are pinned operationally to JDK 17 through the repository's npm
wrapper. This avoids machine-global JDK upgrades changing the Gradle runtime;
the current Android Gradle Plugin 8.12 declares JDK 17 as its default.

## Implementation status (MVP, 2026-07-31)

The repository contains a working local-only MVP for the requested core flow:
survey list/search/create/open, observation creation with draft recovery, SCB
county/municipality selection, offline starter-taxonomy search with free text,
RT90 input and device-position conversion, observation list/map, Excel export,
and JSON backup/restore. Data is persisted in SQLite on native devices and in
origin-scoped browser storage in the web preview.

The browser preview shares the core routes and uses localStorage, browser file
downloads, browser geolocation, and an RT90 coordinate map. It is responsive but
is not yet an installable/service-worker-backed PWA. Two integrations deliberately
remain adapters rather than simulated production
features. The bundled vascular-plant list is a small workflow-testing subset
until an authorised, versioned Dyntaxa distribution source is chosen. The map
accepts a MapLibre style URL for the selected Lantmäteriet raster product and
falls back to an offline coordinate plot until the organisation supplies its
approved processed tile endpoint and attribution. Custom taxonomy import,
managed map-package downloads, observation editing/deletion, and survey
archiving are post-MVP items described below, not claims about the current app.

## 1. Product summary

Inventera mera is a React Native mobile application, built with Expo and
TypeScript, for recording wild-plant observations in the field. A user creates
a survey for a region, chooses a downloaded or custom taxonomy, records
observations with time and RT90 coordinates, reviews them in a list or on a map,
and exports the survey to an Excel workbook. The supported production targets
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
- Add, edit, duplicate, and delete observations within a survey.
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
- A general taxonomy editor. Custom taxonomies are imported as versioned lists.

### Confirmed product decisions

- Swedish is the first interface language; the code remains translation-ready.
- The MVP is local-only. It has no account, login, server-side survey storage,
  or synchronization. JSON backup/restore is the lossless transfer mechanism,
  while Excel is the human/external-system export.
- A survey region is selected from searchable Swedish counties and
  municipalities, with optional free text for a more specific area.
- Amount is optional. When an amount is entered, a unit is required.
- All taxonomic ranks/statuses within the selected taxonomy group are
  selectable for now. Rank and status remain visible so users can judge the
  suggestion.
- The MVP basemap uses Lantmäteriet's downloadable raster topographic map.
- `Lokalnamn` belongs to each observation. A new observation defaults it from
  the most recently created observation in the same survey, with the survey
  title as the first-observation fallback; the user may always change it.
- Excel uses the Swedish interchange columns defined in section 11.

## 3. Primary user and core journeys

The primary user is a field botanist or inventory worker using one hand on a
phone, often in rain, bright light, gloves, or intermittent reception. The
design favours large targets, short forms, explicit save feedback, and retained
drafts over dense desktop controls.

### 3.1 Prepare before going offline

1. Install and open the mobile application.
2. Download the vascular-plant taxonomy or import a custom taxonomy.
3. Create a survey and choose its region and taxonomy.
4. Optionally download a map package covering the field area.
5. See an explicit `Ready offline` status for the app, taxonomy, survey, and
   optional map package.

### 3.2 Record an observation

1. Open a survey and tap the add button.
2. The form defaults to the current local date and time.
3. Tap `My location`; the app obtains WGS84 device coordinates, shows the
   reported accuracy, and transforms them locally to RT90.
4. Confirm or change the prefilled locality name.
5. Search downloaded species names, select a suggestion, or add the typed name
   as free text.
6. Optionally enter amount with unit, a public comment, and additional
   observers, then save.
7. The observation appears immediately in the list and map with a `Saved on
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
| `/surveys/new` | Create survey | Define title, description, region, taxonomy |
| `/surveys/:surveyId` | Survey detail | Observation list and survey summary |
| `/surveys/:surveyId/map` | Survey map | Map, markers, selected-observation card |
| `/surveys/:surveyId/observations/new` | Add observation | Capture all observation fields |
| `/surveys/:surveyId/observations/:observationId` | Observation detail/edit | Review and change an observation |
| `/species/select` | Species picker | Search the active taxonomy or use free text |
| `/taxonomies` | Offline taxonomies | Download, import, update, and remove packages |
| `/settings` | Settings and data | Language, map source, backup/restore, storage |

Navigation uses typed Expo Router routes and supports platform deep links where
useful. Unsaved form state must survive an application background/termination
or a round-trip to the species picker. Restore the draft and ask before
discarding it.

## 5. Screen design

### 5.1 Survey list

- Sticky app bar with app title and connection/offline-readiness status.
- Search by survey title, description, or region, case- and accent-insensitive.
- Default order: most recently updated first; allow title and survey-date sort.
- Each card shows title, observation count, survey date, region, and a chevron.
- Empty state explains how to create the first survey; no-results state keeps
  the search visible.
- Floating add button opens the create-survey screen and has an accessible
  label, not only a plus icon.

### 5.2 Create/edit survey

- Required: title and a county or municipality.
- Optional: description.
- Taxonomy: one downloaded Dyntaxa/custom package, or `No taxonomy`.
- A taxonomy that is not present locally cannot be chosen for offline use; the
  screen offers a download/import action without losing entered form values.
- The region picker searches the current, bundled SCB county/municipality list
  by name and code. Choosing a municipality also records its county. An
  optional free-text field captures a more specific area. Region data is
  versioned with its SCB source year. It is descriptive and helps choose a map
  package; it does not constrain where observations may be saved.
- Saving is atomic. On success, navigate to the new survey.

### 5.3 Open survey

- App bar contains back, survey title, and an overflow menu.
- Summary shows survey date, taxonomy name/version, region, and offline status.
- Tabs are `Observations (n)` and `Map`; they remain reachable with screen
  readers and preserve scroll/viewport state when switching.
- Each observation row shows local time, locality, preferred/common name,
  scientific name when available, amount, and a free-text badge when relevant.
- The menu contains edit survey, export Excel, backup survey, and archive.
- Archive is reversible. Permanent deletion requires a second explicit action.

### 5.4 Add/edit observation

Fields, in order:

1. Local date and time, required; default now.
2. Locality name (`Lokalnamn`), required. For a new observation, default to the
   most recently created observation's locality in this survey; for the first
   observation, default to the survey title. The value remains freely editable.
3. Coordinates in `RT90 2.5 gon V (EPSG:3021)`, required:
   `Northing (X)` and `Easting (Y)`, both in metres.
4. Location accuracy in metres, read-only when supplied by device GPS.
5. Species, required, either a selected taxon or free text.
6. Amount, optional non-negative number. If present, unit is required. Suggested
   units include `individer`, `stjälkar`, `tuvor` and `täckning`, while custom
   unit text remains allowed.
7. Public comment (`Publik kommentar`), optional multiline plain text. Make its
   exported/public character clear in the label.
8. Additional observers (`Med-observatör`), optional repeatable names. Trim
   names, preserve spelling and ordering, and prevent empty entries.

Defaulting runs only when creating a genuinely new blank form. A restored draft
always wins, and later changes to another observation never rewrite an open
draft. "Most recently created" means the observation with the latest
`createdAt` in the survey, not the latest biological `observedAt`, which may be
backdated.

Quick actions set the current time, acquire the current location, or clear the
coordinate fields. Location capture must show `locating`, `success with
accuracy`, `permission denied`, `unavailable`, and `timed out` states. Saving
is possible after manual coordinate entry even if geolocation fails.

Validate on blur and save. Preserve all entered values after validation errors.
The save button remains reachable above the mobile keyboard. A destructive
delete action is only shown when editing an existing observation.

### 5.5 Species picker

- Search matches preferred Swedish name, scientific name, synonyms, and the
  imported custom aliases, case- and accent-insensitively.
- Suggestions appear after one character, ordered by exact prefix, word prefix,
  substring, then synonym match. Deterministic alphabetical order breaks ties.
- Results show preferred name, scientific name, and a clear synonym/status
  indication when applicable.
- Limit the first result set (for example, 30 rows) and virtualize longer lists.
- Keyboard, switch-control, and screen-reader selection must work as well as
  touch selection.
- The exact current input is always offered as `Add as free text`, including
  when taxonomy matches exist. Trim outside whitespace but preserve spelling,
  capitalization, accents, and internal whitespace in the saved snapshot.

### 5.6 Map

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

### 5.7 Offline and storage feedback

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
  region: {
    countyCode: string;
    countyName: string;
    municipalityCode?: string;
    municipalityName?: string;
    freeText?: string;
    source: "SCB";
    sourceVersion: string;
    boundingBoxWgs84?: [west: number, south: number, east: number, north: number];
  };
  taxonomyRef?: {
    packageId: string;
    name: string;
    version: string;
  };
  surveyDate: string; // YYYY-MM-DD; defaults to creation date
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};
```

The taxonomy reference is a snapshot. Removing a taxonomy package does not
remove the name/version from an existing survey or damage its observations.

### 6.2 Observation

```ts
type Observation = {
  id: string;
  surveyId: string;
  observedAt: string; // instant with numeric offset, e.g. 2026-07-31T10:14:00+02:00
  timeZone: string; // IANA zone, e.g. Europe/Stockholm
  localityName: string;
  position: {
    wgs84: { latitude: number; longitude: number };
    rt90: { northing: number; easting: number; crs: "EPSG:3847" };
    accuracyMeters?: number;
    source: "device" | "manual-rt90" | "map";
  };
  species: {
    source: "taxonomy" | "free-text";
    enteredName: string;
    taxonId?: string;
    preferredName?: string;
    scientificName?: string;
    taxonomyPackageId?: string;
    taxonomyVersion?: string;
  };
  amount?: { value: number; unit: string };
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

`amount` is absent as a whole or contains both a value and a non-blank unit; a
partially populated amount is invalid. Additional observers are observation
level data because field companions may change during a survey. `localityName`
is trimmed, required, stored as an observation snapshot, and is never derived
again after the observation is saved.

### 6.3 Taxonomy package

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

### 6.4 Local operation metadata

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
  do not silently discard additional stored precision.
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
taxonomic relationships. SLU exposes the Dyntaxa Taxon Service API and a Darwin
Core Archive export; the archive is updated daily. The initial package is the
vascular-plant branch (`Kärlväxter`), subject to confirming the authoritative
root taxon/list identifier during implementation. Do not filter the package to
species: all included ranks and statuses are selectable for the MVP, including
subspecies, hybrids, aggregates, and higher or otherwise non-species taxa.
Preserve rank/status and make them visible in search results.

Do not call protected Dyntaxa endpoints directly from the mobile client with a
secret.
Create taxonomy packages in a build/admin job:

1. Download the official archive/API data under its current terms.
2. Select the target taxonomic subtree and supported ranks/statuses.
3. Normalize the minimal search fields and preserve source IDs.
4. Produce a versioned SQLite package with FTS5 search tables plus a small
   manifest, record count, source URL/date, licence/citation, and SHA-256.
5. Publish over HTTPS. The app downloads it to a staging file, verifies the
   checksum and format, then atomically moves and activates it.
6. Keep the previous version until activation succeeds; allow rollback/removal
   when it is not the only copy needed for an active survey.

Searching the active package is entirely local through parameterized SQLite
FTS5/prefix queries. Never load the entire taxonomy into JavaScript or the React
Native render thread. Query and paginate only the result fields needed by the
species picker.

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
| Surveys/observations/drafts | Application SQLite database | Local source of truth, transactions, backed up |
| Taxonomy metadata | Application SQLite database | Active-version pointer and provenance |
| Taxonomy packages | Application document directory as SQLite files | Staged, checksum verified, atomically activated |
| Map regions | MapLibre Native offline storage | User initiated, bounded, provider-authorized |
| Small UI preferences | Async key/value settings | Non-critical only; never survey data |
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
| Region | County and optional municipality/free-text area, with SCB codes |
| Survey date | ISO date |
| Taxonomy | Name, source, and version |
| Observation count | Integer |
| Exported at | ISO timestamp with offset |
| Application/schema version | Version identifiers |

### Sheet `Observations`

One row per observation, sorted by `observedAt`. The first eight column names
are mandatory and exact:

| Column | Mapping |
| --- | --- |
| `Artnamn` | Preferred-name snapshot when available; otherwise the exact free-text/entered name |
| `Lokalnamn` | Observation locality name |
| `Ost` | RT90 easting (Y), numeric metres |
| `Nord` | RT90 northing (X), numeric metres |
| `Noggrannhet` | Location accuracy in metres; blank when unknown |
| `Startdatum` | Observation date/time as a real Excel date cell, displayed `yyyy-mm-dd hh:mm` |
| `Publik kommentar` | Public comment; blank when absent |
| `Med-observatör` | Additional observer names joined with `; `; blank when absent |

`Antal` is optional at workbook level. If at least one observation has an
amount, append both `Antal` and `Enhet`; never emit one without the other. Rows
without an amount leave both cells blank. Application validation guarantees
that every numeric `Antal` has a non-blank `Enhet`.

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

- **No taxonomy:** free-text species entry remains available.
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

- Survey/observation validation and migrations.
- Locality defaulting: restored draft, previous observation, and first-observation
  survey-title fallback.
- Coordinate control points, bounds, axis order, and round trips.
- Taxonomy normalization/ranking and CSV import validation.
- File-name/cell sanitization and workbook column mapping.
- Date/time-zone and daylight-saving boundaries.

### Component tests

- All form states, draft restoration, error focus, and free-text path.
- Species keyboard/touch selection and accessible announcements.
- Online/offline/storage indicators.
- Map fallback without a basemap.

### End-to-end tests

1. Install the release-like build, go offline, create a survey, add a GPS/manual
   observation, terminate/relaunch the app, and verify persistence.
2. Download a taxonomy, go offline, find by Swedish/scientific/synonym name, and
   save; also save unmatched free text.
3. Interrupt taxonomy/map download and verify existing data still works.
4. Create observations, view/select all markers offline, edit one, and export.
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
- User can add/edit/delete observations with locality name, manual RT90
  coordinates, free-text species, optional amount/unit, public comment,
  additional observers, and draft recovery.
- Records survive process termination and application restart.

### Phase 2 — location and taxonomy

- Device location transforms to RT90 offline and displays accuracy.
- Fixed control-point tests prove axis order and acceptable transformation.
- Vascular-plant taxonomy can be downloaded atomically and searched offline.
- A valid custom CSV taxonomy can be previewed, imported, selected, and removed.
- Updating/removing taxonomy data does not alter historical observations.

### Phase 3 — map and export

- All positioned observations render and can be selected on the map.
- Lantmäteriet raster map regions can be downloaded, rendered, and removed on
  supported devices under the approved source terms; markers still work when
  no package covers the viewport.
- Export produces the documented two-sheet `.xlsx` fully offline.
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
- [SCB: county and municipality codes](https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/)
- [Mapbox: mobile offline maps](https://docs.mapbox.com/help/dive-deeper/mobile-offline/)
- [MapTiler: mobile and offline map options](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-build-mobile-apps-with-maps-using-sdk/)
- [MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/)
- [Expo: development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [Expo: SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo: Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [MapLibre React Native](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
