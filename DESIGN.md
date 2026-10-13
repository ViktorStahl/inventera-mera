# Inventera mera — product design

Inventera mera is a Swedish, offline-first field notebook for wild-plant
observations. Native iOS and Android are the production targets; Expo Web is a
preview. This document defines durable product rules and external contracts.

## Scope

Users create surveys and named locales, record observations, review them in a
list or on a map, and export Excel, GPX, or lossless JSON backups. Taxonomy and
map packages may be installed in advance, including validated custom taxonomy
packages, but field records remain usable without a network connection.

The first release does not include plant identification, Artportalen publishing,
multi-user editing, cloud sync, navigation/tracks/polygons, or a general taxonomy
editor. A future sync feature requires a separate identity, privacy, retention,
and conflict-resolution design.

## Domain rules

### Offline data and hierarchy

- Creating, editing, and reviewing surveys, locales, observations, species
  lists, and drafts must not require a network connection. Records stay on the
  device unless the user explicitly exports them.
- The hierarchy is Survey → Locale → Observation. Every observation belongs to
  one locale, and `Lokalnamn` is always that locale's current name.
- A locale has a required name, time, and position. An observation may inherit
  locale time and position independently or override either value. Locale
  defaults affect new observations only; changing an inherited locale value
  never replaces an explicit override or restored draft.
- New observations start with the current time and request a fresh foreground
  position unless the locale defaults that value to inheritance. Failed capture
  must allow retry or manual RT90 entry.
- Archived surveys are readable and exportable but cannot be edited. Permanent
  deletion is available only after archive, requires confirmation, and removes
  dependent records and drafts.
- Native/browser schema v7 and JSON backup format v6 are current. Upgrade
  schema v6 in place, defaulting uncertain identification to false. Accept JSON
  backup v5 with the same default and export backups as v6. Database schemas
  older than v6 and backups older than v5 remain unsupported; newer databases
  are rejected.

### Species and taxonomy

- Store a species-name snapshot on every observation. Taxonomy updates never
  rewrite historical observations.
- Free-text species are a first-class save path. Preserve spelling,
  capitalization, accents, and internal whitespace; trim outside whitespace.
- A survey may use one species list compatible with its taxonomy. Lists may be
  shared and contain taxonomy-backed or free-text snapshots.
- Search list entries before the remaining taxonomy. Within each group rank
  exact prefix, word prefix, substring, then alias matches, with deterministic
  alphabetical ties. Include free-text list entries and de-duplicate taxonomy
  identity.
- Adding an observed species to the current list and saving the observation is
  one local repository operation. Ignore duplicate normalized identities.
- The default taxonomy initializes new surveys and lists only. It never changes
  an existing selection or saved snapshot. Bundled-package provenance and build
  rules are in [docs/taxonomy-package.md](docs/taxonomy-package.md).

### Amount, coordinates, and time

- Amount is optional. When present it is non-negative and has exactly one unit:
  `stjälkar/strån/skott`, `plantor/tuvor`, `m2`, `dm2`, or `cm2`. Custom units
  are unsupported.
- Device geolocation is canonical WGS84. Derive RT90 2.5 gon V locally with
  Lantmäteriet's national direct projection (EPSG:3847 emulation), not the older
  EPSG:3021 transformation. Manual RT90 input is Northing (X)/Easting (Y); never
  label latitude/longitude as RT90. See
  [the coordinate decision](docs/decisions/coordinates-rt90.md).
- Preserve coordinate precision and reported GPS accuracy in storage and JSON.
  Excel alone applies the rounding contract below.
- Preserve the recorded instant, numeric offset, and IANA time zone. A time-zone
  change must not silently rewrite an observation.

### Local presentation rules

- Filters combine categories with AND and values within a category with OR.
- Map markers use WGS84. Without a basemap, keep markers usable on a neutral
  coordinate plot and state `Basemap unavailable offline`. The map-source and
  licensing boundary is in [docs/decisions/map-source.md](docs/decisions/map-source.md).
- Statistics include active and archived surveys: total observations, average
  per retained survey, 12 device-local calendar months, and the three most
  observed species. Include zero-observation surveys in the average and group
  species by taxonomy identity or normalized free-text identity.
- Achievements are device-local, globally earned, and survive source-survey
  deletion. Evaluate at startup and after observation save; queue unacknowledged
  awards. Reset requires confirmation and permits records to earn awards again.

## Interchange contracts

### Excel

Generate `<sanitized survey title>_<YYYY-MM-DD>.xlsx` locally. The workbook has
one worksheet named `Sheet1`, one row per observation sorted by `observedAt`, and
exactly these columns in this order:

| Column | Mapping |
| --- | --- |
| `Artnamn` | Preferred-name snapshot, otherwise exact entered name |
| `Nord` | RT90 northing (X), rounded to whole numeric metres |
| `Ost` | RT90 easting (Y), rounded to whole numeric metres |
| `Noggrannhet` | Nearest supported metre class with `m`; blank if unknown |
| `Antal` | Numeric amount; blank if absent |
| `Enhet` | Restricted unit; blank if amount is absent |
| `Startdatum` | Local date as an Excel date cell, displayed `yyyy-mm-dd` |
| `Starttid` | Local time as an Excel time cell, displayed `hh:mm` |
| `Lokalnamn` | Owning locale's current name |
| `Biotop-beskrivning` | Owning locale's note |
| `Publik kommentar` | Public comment |
| `Med-observatör` | Additional observers joined with `; ` |
| `Osäker artbestämning` | `X` when identification is uncertain; blank otherwise |

`Antal` and `Enhet` always appear together and are both blank when amount is
absent. Accuracy classes in metres are `1`, `5`, `10`, `25`, `50`, `75`, `100`,
`125`, `150`, `200`, `250`, `300`, `400`, `500`, `750`, `1000`, `1500`, `2000`,
`2500`, `3000`, and `5000`. Choose the nearest class, round midpoint ties upward,
and clamp outside values. Protect string cells from formula injection.

### GPX and JSON

GPX 1.1 contains one waypoint per observation sorted by time, using resolved
WGS84 coordinates. Include ISO 8601 time and species name, public comment in
`cmt`, and available locale, scientific-name, amount, accuracy, and observer
details in the description. Escape XML and omit invalid control characters.

JSON is the lossless transfer format and preserves survey, locale, observation,
species-list, coordinate, accuracy, inheritance, and uncertain-identification
data. Exports never upload or mutate records.

## Privacy, accessibility, and quality

- Exact coordinates and species locations are sensitive. Do not include exact
  coordinates, notes, survey titles, or species names in analytics, logs, or
  error reports without a separate consent and privacy design.
- Request foreground location only for a fresh position or explicit retry.
  Never request background location. Do not embed Dyntaxa credentials in the
  client; provider credentials must be endpoint-scoped and excluded from
  backups, logs, URLs, and exports.
- Core flows target WCAG 2.2 AA, including accessible labels and status,
  keyboard focus, 44 × 44 CSS-pixel touch targets, font scaling, reduced motion,
  safe areas, and no color-only meaning. The phone flow is canonical.
- Release-like native builds must work in airplane mode without Metro. Agree and
  verify representative phone budgets before release: cached shell interaction
  under two seconds and common-prefix species-search feedback under 100 ms.

## Open decisions

1. Required coordinate tolerance and whether raw GPS readings require audit retention.
2. Package hosting organization and approved map-provider terms.
3. Retention, encryption, and device-loss requirements for sensitive locations.
4. Final branding, platform identifiers, supported OS versions, and distribution accounts.
