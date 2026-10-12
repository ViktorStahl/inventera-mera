# Inventera mera — agent guide

Read [DESIGN.md](./DESIGN.md) and the relevant linked documents before planning
or changing the application. DESIGN.md is the source of truth for product
scope, user flows, domain behavior, external contracts, and acceptance
criteria. [docs/architecture.md](./docs/architecture.md) and
[docs/decisions/](./docs/decisions/) record implementation architecture and
decisions; [docs/migrations.md](./docs/migrations.md) defines supported storage
formats; [docs/testing.md](./docs/testing.md) describes verification;
[STATUS.md](./STATUS.md) records current implementation status.

## Working rules

- Preserve the offline-first contract: creating and editing surveys and
  observations must never require a network connection.
- Build the product as a React Native application with Expo, TypeScript, and
  the React Native new architecture. Use an Expo development build for native
  modules; do not assume Expo Go is the production runtime.
- Run Android builds through `npm run android`; its wrapper selects JDK 17 as
  required by the current Android Gradle Plugin. Do not allow a newer system JDK
  to silently replace that build runtime.
- Keep the UI mobile-first, touch-friendly, accessible, and usable in Swedish
  on supported iOS and Android phones.
- Preserve the Expo Web preview. Browser persistence uses localStorage behind
  the same repository API as native SQLite; browser exports must use downloads,
  and browser maps must not import MapLibre Native.
- Keep WGS84 coordinates from device geolocation as the canonical geographic
  value and derive RT90 2.5 gon V locally with Lantmäteriet's national direct
  projection (the EPSG:3847 emulation), not the older transformation selected
  by EPSG:3021. Never label latitude/longitude values as RT90.
- Store a species-name snapshot on every observation even when it references a
  taxonomy ID. Taxonomy updates must not rewrite historical observations.
- Free-text species are a first-class supported case, not an error or fallback
  that blocks saving.
- A survey may use one species list compatible with its taxonomy. Search must
  rank closest list matches before closest non-list taxonomy matches, including
  free-text list entries. Adding the observed species to the current list and
  saving the observation must be one offline repository operation.
- The default taxonomy setting only initializes new surveys and species lists;
  never use it to rewrite an existing selection or species snapshot.
- Preserve the Swedish Excel interchange contract in `DESIGN.md`. In
  particular, never export `Antal` without `Enhet`, and keep the mandatory
  column names exact.
- Round `Noggrannhet` only in Excel export to the fixed metre classes documented
  in `DESIGN.md`; preserve the original accuracy in SQLite and JSON backup.
- Amount units are restricted to `stjälkar/strån/skott`, `plantor/tuvor`, `m2`,
  `dm2`, and `cm2`; never offer or persist custom units. This rule intentionally
  uses startup cleanup rather than a new schema migration, as documented in
  `docs/migrations.md`.
- Preserve the Survey → Locale → Observation hierarchy. `Lokalnamn` is the
  required owning locale's current name. New observations default to current
  time and a new position; each locale may independently default future
  observations to live-inherit its time and/or position. Never rewrite existing
  observations or overwrite a restored v2 draft or explicit override when a
  locale default changes.
- Do not put Dyntaxa subscription credentials in the mobile client. Generate
  downloadable taxonomy packages outside the client.
- Rebuild the bundled Dyntaxa package with `npm run taxonomy:build`; do not edit
  generated taxonomy assets manually. The source archive belongs at
  `dyntaxa-raw/dyntaxa-dwca.zip` and remains untracked. Preserve the accepted
  `Tracheophyta` root `urn:lsid:dyntaxa.se:Taxon:6000506`, include only accepted
  `species` and `subspecies`, and retain non-accepted scientific names only as
  search aliases for their accepted taxon.
- Do not implement offline map downloads from `tile.openstreetmap.org`; its
  usage policy forbids that. Use a provider that explicitly permits offline
  use, or a self-hosted map package, and retain required attribution.
- Use Lantmäteriet's downloadable raster topographic map as the MVP basemap,
  subject to the packaging/licensing verification in
  `docs/decisions/map-source.md`.
- Native and browser storage schema v6 and JSON backup format v5 are the
  currently supported formats. Do not add migration support for local schemas
  1–5 or backup formats 1–4. A future schema change must explicitly define its
  supported upgrade path from the then-current format and recovery boundary in
  `docs/migrations.md`, and keep the backup contract in DESIGN.md.
- Add or update automated tests with each behavior change. Test offline
  workflows, coordinate transformations, current-format persistence, and
  exports as appropriate; see `docs/testing.md`.
- Record product decisions in `DESIGN.md` and implementation/architecture
  decisions in the relevant `docs/decisions/` document in the same change.

## Initial delivery order

1. Expo application shell, Expo Router routes, SQLite schema, and development
   builds for iOS and Android.
2. Survey list/create/open flows.
3. Observation entry, GPS capture, RT90 transformation, and free-text species.
4. Downloaded taxonomy search and custom taxonomy import.
5. Map view and explicitly licensed offline region packs.
6. Excel export, recovery/backup, and hardening.
