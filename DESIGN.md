# Inventera mera — product and behavior design

Status: Product target and acceptance criteria. See [STATUS.md](./STATUS.md) for
what is implemented today.
Last updated: 2026-10-12

This is the source of truth for product scope, user journeys, domain behavior,
data semantics, external interchange contracts, and acceptance criteria.
Implementation architecture and decisions live in [docs/architecture.md](docs/architecture.md)
and [docs/decisions/](docs/decisions/); supported storage formats are in
[docs/migrations.md](docs/migrations.md); taxonomy package mechanics are in
[docs/taxonomy-package.md](docs/taxonomy-package.md); verification planning is
in [docs/testing.md](docs/testing.md).

The product is a React Native application built with Expo and TypeScript for
iOS and Android phones, with an Expo Web preview. Native is the field-production
target. Swedish is the initial interface language.

## 1. Product scope

Inventera mera is an offline-first field notebook for wild-plant observations.
A user creates a survey, chooses a taxonomy and optional species list, creates
named locales, records observations, reviews records in a list or on a map, and
exports them to Excel or GPX. JSON backup/restore is the lossless transfer path.

### Goals

- Create, open, search, edit, and archive surveys.
- Add, edit, and delete locales and observations in active surveys.
- Capture time and device position quickly, or enter RT90 coordinates manually.
- Search an installed taxonomy by Swedish/scientific names and aliases; support
  custom taxonomy packages and free-text species.
- Review observations on a map, with offline map packages optional.
- Export a survey and its observations to .xlsx or .gpx, and create a lossless
  JSON backup.
- Keep records safe across restarts, brief failures, and loss of connectivity.

### Non-goals for the first release

- Photo-based plant identification or direct publishing to Artportalen.
- Multi-user editing, project administration, or conflict resolution.
- Background cloud synchronization. A future sync feature needs a separate
  identity, server, privacy, and conflict design.
- Navigation, tracks, polygons, or line observations.
- A general taxonomy editor; custom taxonomies are imported packages.

## 2. Product and domain rules

### Offline use and data ownership

Creating, editing, and reviewing surveys, locales, and observations must not
require a network connection. Taxonomy and map packages may be distributed
online, but survey and observation records stay on-device unless the user
explicitly exports them. If no basemap is available, map markers remain usable
on a neutral coordinate plot.

### Survey → Locale → Observation

- A survey has one selected taxonomy and may reference one compatible reusable
  species list. Surveys do not store county, municipality, region code, or
  free-text area.
- A locale has a required current name, time, and position, plus an optional
  note. Locale names need not be unique. `Lokalnamn` always means the owning
  locale's current name and cannot be edited separately on an observation.
- Every observation belongs to one locale. Its time and position may
  independently follow the locale live or be explicit observation overrides.
  Changing locale defaults affects future observations only; editing an
  inherited locale value affects only non-overridden observations.
- New observations default to the current time and a fresh device position.
  Each locale may independently default future observations to its time and/or
  position. A restored draft and explicit override always take precedence.
- Archiving is immediate and reversible. Archived surveys are viewable and
  exportable but read-only; they cannot receive new locales/observations or
  locale/observation edits. Permanent deletion is available only after archive,
  requires confirmation, and removes dependent records and drafts.

### Species and taxonomy

- Store a species-name snapshot on every observation, including
  taxonomy-backed records. Taxonomy updates never rewrite historical snapshots.
- Free-text species are a first-class save path, not an error or fallback.
  Preserve entered spelling, capitalization, accents, and internal whitespace;
  trim only outside whitespace.
- A survey's species list is compatible with its selected taxonomy. Lists may
  contain taxonomy-backed snapshots and free-text species and may be shared.
- Search matching species-list entries before matching taxa outside the list.
  Rank match quality within each group; include free-text list entries and
  de-duplicate taxonomy identity.
- Adding the observed species to the current list and saving the observation is
  one local repository operation. Duplicate list entries are ignored by
  normalized identity.
- The default taxonomy initializes only new surveys/lists; it never changes an
  existing selection or a saved species snapshot. The MVP Dyntaxa package
  contains accepted species/subspecies beneath the vascular-plant root; see
  [the package specification](docs/taxonomy-package.md).

### Amounts, coordinates, and time

- Amount is optional. If present it is non-negative and has exactly one unit:
  `stjälkar/strån/skott`, `plantor/tuvor`, `m2`, `dm2`, or `cm2`.
  Custom units are not supported. Startup cleanup and backup behavior are
  documented in [storage compatibility](docs/migrations.md).
- Device geolocation is canonical WGS84; derive RT90 2.5 gon V locally using
  Lantmäteriet's national direct projection (EPSG:3847 emulation), not the
  older EPSG:3021 transformation. Manual RT90 input is explicit
  Northing (X)/Easting (Y). Never label latitude/longitude as RT90. See the
  [coordinate decision](docs/decisions/coordinates-rt90.md).
- Preserve coordinate precision and reported GPS accuracy in storage and JSON.
  Round RT90 coordinates and accuracy only for Excel, as specified below.
- Keep recorded time, numeric offset, and IANA time zone. A time-zone change
  does not silently rewrite the observation instant.

### Compatibility and other confirmed decisions

- Native SQLite and browser storage schema v6 and JSON backup format v5 are the
  only supported formats. Fresh local stores initialize directly at v6;
  older local schemas and backup formats are no longer migrated. Before
  resetting old data, export a v5 backup using a compatible app version.
  See [docs/migrations.md](docs/migrations.md).
- The square 1024 × 1024 `icon/app-icon.png` is the Expo launcher icon and Web
  favicon; Android uses it as the adaptive foreground over a matching green.
- The MVP is local-only: no account, login, server-side survey storage, or sync.
  Excel and GPX are human/external-system exports; JSON is the lossless backup.
- The intended offline field basemap is Lantmäteriet's downloadable raster
  topographic map, subject to access/licensing verification. The current
  authenticated overview WMTS is temporary and online-only; see the
  [map-source decision](docs/decisions/map-source.md).
- Swedish is the first interface language. Add an i18n layer before introducing
  another language.

## 3. Core journeys

### Prepare for field work

1. Install and open the app.
2. Ensure the taxonomy is available (bundled or imported), and optionally
   prepare a reusable species list.
3. Create a survey and choose its taxonomy and optional list.
4. Optionally prepare an approved offline map package.
5. Show clear readiness for the app, taxonomy, survey, and optional map.

### Create a locale and record an observation

1. In a survey, create a locale with name, time, and coordinate.
2. Add an observation. It starts with current time and requests a fresh
   foreground device position unless the locale defaults that value to live
   inheritance.
3. If location capture fails, permit retry or manual RT90 entry. Show reported
   accuracy and transform device WGS84 to RT90 locally.
4. Choose a taxonomy suggestion or save the exact typed name as free text.
5. Optionally add the species snapshot to the survey's list as part of save.
6. Optionally enter amount/unit, public comment, and additional observers.
7. Save locally and show confirmation; the record appears immediately in the
   locale and survey map.

### Review and export

1. Switch between an observation list and map; select a row or marker to review
   or edit its observation.
2. Export Excel or GPX, or create a JSON backup.
3. Use the native share/save action or a browser download. Export never uploads
   survey data.

## 4. Essential interaction behavior

- Survey list defaults to active surveys. An explicit archived toggle includes
  archived records; archived contents remain readable and exportable.
- Preserve unsaved form state across app background/termination and round trips
  to the species picker. Ask before discarding a restored draft.
- Observation fields are ordered for field speed: species, optional add-to-list,
  amount/unit, time and position details, public comment, additional observers.
  Time and position inheritance are independent. Keep the details disclosure
  adjacent to its fields and expand it on capture/validation failure.
- Amount selection uses only the five fixed units above; selecting the current
  unit again clears it. Export labels make clear that `Publik kommentar` is
  public, and additional observer names are trimmed while preserving spelling
  and order.
- Validate fields on blur and save, preserve entered values after validation
  errors, and prevent a repeated save tap from creating a duplicate.
- Species search is accent-insensitive and supports preferred Swedish name,
  scientific name, and aliases. Match quality is exact prefix, word prefix,
  substring, then alias match, with deterministic alphabetical tie-breaking.
  Offer the exact typed input as free text even when suggestions exist.
- Map markers use WGS84. Fit markers on first open, then retain the user's
  viewport. Selection shows observation details. Filters combine categories
  with AND and values within a category with OR; filtering remains local.
  Without a basemap, show markers on a neutral grid and say
  `Basemap unavailable offline`.
- Show local/offline readiness without claiming that records have synced.
  Network reachability is only a hint, not proof that a service is available.
- Statistics are local across active and archived surveys. Show total
  observations, average per retained survey, monthly totals, and the three most
  observed species; do not expose survey/locale names or per-survey breakdowns.
  The average includes retained surveys with zero observations. Monthly totals
  use each observation's effective time and stored time zone for the current
  device-local month and preceding 11 months, including empty months. Count
  each observation once and group species by taxonomy package plus taxon ID or
  normalized free-text identity; display snapshot names.
- Achievement awards are device-local, globally earned, and survive source
  survey deletion. Evaluate at startup and after saving an observation; queued
  unacknowledged awards return on next launch. Reset requires confirmation and
  existing records may earn awards again on the next evaluation.

Platform navigation, keyboard/layout implementation, and provider configuration
are documented in [architecture](docs/architecture.md) and the linked
[decisions](docs/decisions/).

## 5. Excel and GPX contracts

### 5.1 Excel export

Generate `<sanitized survey title>_<YYYY-MM-DD>.xlsx` locally without upload.
The workbook contains exactly one worksheet named `Sheet1`, one row per
observation sorted by `observedAt`, and these 12 columns in this exact order:

| Column | Mapping |
| --- | --- |
| `Artnamn` | Preferred-name snapshot when available; otherwise exact free-text/entered name |
| `Nord` | RT90 northing (X), rounded to whole numeric metres and formatted with no decimals |
| `Ost` | RT90 easting (Y), rounded to whole numeric metres and formatted with no decimals |
| `Noggrannhet` | Rounded metre class as text with `m` suffix, e.g. `25m`; blank if unknown |
| `Antal` | Numeric amount; blank if absent |
| `Enhet` | Restricted amount unit; blank if amount is absent |
| `Startdatum` | Local observation date as a real Excel date cell, displayed `yyyy-mm-dd` |
| `Starttid` | Local observation time as a real Excel time cell, displayed `hh:mm` |
| `Lokalnamn` | Current name of the owning locale |
| `Biotop-beskrivning` | Owning locale's note; blank when absent |
| `Publik kommentar` | Public comment; blank when absent |
| `Med-observatör` | Additional observer names joined with `; `; blank when absent |

`Antal` and `Enhet` are always present as a pair in the header. If amount
is absent, leave both row cells blank; never export only one. Every numeric
amount has one of the five supported units.

The supported `Noggrannhet` classes in metres are `1`, `5`, `10`, `25`,
`50`, `75`, `100`, `125`, `150`, `200`, `250`, `300`, `400`,
`500`, `750`, `1000`, `1500`, `2000`, `2500`, `3000`, and `5000`.
Choose the nearest class; exact midpoint ties round upward; clamp to the nearest
endpoint outside the range. Add the `m` suffix; unknown accuracy is blank.
This normalization does not change stored data or the JSON backup.

Keep the workbook limited to these interchange columns. Protect cells from
formula injection for strings beginning with `=`, `+`, `-`, or `@`.
Show explicit success/failure and provide native sharing or browser download.
Test exact headers, Swedish text, locale-note mapping, separate date/time cells,
long comments, free-text species, multiple observers, blank accuracy, zero with
unit, and empty surveys. Temporary exports have a clear retention policy;
explicit backups are not deleted.

### 5.2 GPX export

Generate a local GPX 1.1 file with one waypoint per observation, sorted by
observation time. Use the observation's resolved WGS84 latitude/longitude, never
RT90 values. Include ISO 8601 time and species name; put public comment in
`cmt`. Include locale name, scientific name, amount/unit, accuracy, and
additional observers in the description when available. Escape XML text and
omit invalid XML control characters. GPX export does not mutate or upload data.

## 6. Privacy and accessibility

- Exact coordinates and species locations may be sensitive. Keep records
  local, make export explicit, and explain where data is stored.
- Request foreground location only when a fresh position is needed or the user
  retries; explain denial and allow manual entry. Never request background
  location.
- Do not put Dyntaxa subscription credentials in the mobile client. Keep
  provider credentials within the storage and endpoint restrictions in
  [the credential decision](docs/decisions/map-credentials.md).
- Do not send exact coordinates, notes, survey titles, or species names in
  analytics, logs, or error reports without a separate consent/privacy design.
- Core flows must meet WCAG 2.2 AA: accessible labels/status/dialogs/tabs, visible
  keyboard focus, minimum 44 × 44 CSS-pixel touch targets, no color-only
  meaning, readable text at 200% zoom, and support for user font scaling,
  reduced motion, and safe areas.
- The phone flow is canonical. Constrain tablet form width rather than creating
  a separate tablet application.

## 7. Acceptance criteria

### Local field notebook

- Native development builds install and launch in airplane mode without Metro
  or a prior online launch.
- Users can create/open surveys, manage locales and observations, archive and
  restore surveys, and permanently delete only archived surveys with
  confirmation.
- Observation time and position follow the independent locale defaults or use
  explicit overrides; free-text species and fixed-unit amounts can be saved.
- Records and drafts survive process termination and app restart.

### Location and taxonomy

- Device location transforms to RT90 offline and displays accuracy; control
  points validate axis order and transformation tolerance.
- Bundled vascular-plant taxonomy search works offline by Swedish name,
  scientific name, and retained synonym.
- Valid custom CSV packages can be previewed, imported, selected, and removed.
  Taxonomy changes never alter historical observations.

### Map and interchange

- Positioned observations render and can be selected/filtered on the map.
- Approved offline raster regions can be installed/rendered/removed on
  supported devices; markers work outside package coverage or with no basemap.
- Excel export conforms exactly to the contract above; GPX uses WGS84. Required
  source attribution/provenance is visible.

### Production readiness

- Critical offline end-to-end flows and accessibility audit pass on release-like
  builds for supported iOS/Android devices.
- Current-format storage, backup/restore, quota handling, interrupted optional
  downloads, and update recovery are verified.
- Agree and meet representative mid-range phone budgets: cached shell interaction
  under 2 seconds and common-prefix species search feedback under 100 ms.

## 8. Decisions still requiring confirmation

Resolve before finalizing the corresponding feature:

1. Required coordinate accuracy/tolerance and whether raw GPS readings must be
   retained for audit.
2. Package hosting organization and approved Lantmäteriet/provider terms.
3. Retention, encryption, and device-loss requirements for sensitive locations.
4. Final app name/branding, platform identifiers, supported OS versions, and
   distribution accounts.

## 9. Product references

- [Lantmäteriet: RT 90–SWEREF 99 transformation](https://www.lantmateriet.se/sv/geodata/gps-geodesi-och-swepos/Transformationer/RT-90---SWEREF-99/)
- [Lantmäteriet: RT90/SWEREF 99 control points](https://www.lantmateriet.se/contentassets/0f296052c56d425bb180430084d491d9/kontrollpunkter.pdf)
- [SLU Artdatabanken: Dyntaxa](https://www.slu.se/artdatabanken/arter-och-natur/taxonomi/dyntaxa/)
- [Lantmäteriet: downloadable topographic-map alternatives](https://www.lantmateriet.se/sv/geodata/vara-produkter/Produktnyheter/Geografisk-information/avveckling-av-produkten-topografisk-webbkarta-visning-oversiktlig/)
- [Lantmäteriet: Topografisk webbkarta Nedladdning, raster](https://geotorget.lantmateriet.se/geodataprodukter/topografisk-webbkarta-nedladdning-raster-api)
