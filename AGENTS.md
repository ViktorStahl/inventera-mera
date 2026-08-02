# Inventera mera — agent guide

Read [DESIGN.md](./DESIGN.md) before planning or changing the application. It is
the source of truth for product scope, user flows, data contracts, offline
behaviour, architecture, and acceptance criteria.

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
- Amount units are restricted to `stjälkar/strån/skott`, `plantor/tuvor`, `m2`,
  `dm2`, and `cm2`; never offer or persist custom units. This rule intentionally
  uses startup cleanup rather than a new schema migration, as documented in
  `DESIGN.md`.
- Preserve the Survey → Locale → Observation hierarchy. `Lokalnamn` is the
  required owning locale's current name. Observations live-inherit locale time
  and position unless the respective value is explicitly overridden; never
  overwrite a restored v2 draft or an explicit override.
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
  subject to the packaging/licensing verification defined in `DESIGN.md`.
- Make schema changes through explicit SQLite migrations and keep export
  compatibility in mind.
- Add or update automated tests with each behaviour change. Test offline
  workflows, coordinate transformations, persistence migrations, and exports
  as appropriate.
- Record any deliberate deviation or newly resolved product decision in
  `DESIGN.md` in the same change.

## Initial delivery order

1. Expo application shell, Expo Router routes, SQLite schema, and development
   builds for iOS and Android.
2. Survey list/create/open flows.
3. Observation entry, GPS capture, RT90 transformation, and free-text species.
4. Downloaded taxonomy search and custom taxonomy import.
5. Map view and explicitly licensed offline region packs.
6. Excel export, recovery/backup, and hardening.
