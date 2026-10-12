# Inventera mera — implementation status

Last checked: 2026-10-12

This file describes what is present in the repository today. Product
requirements and target behavior live in [DESIGN.md](./DESIGN.md).

## Implemented

- Expo React Native app for iOS and Android, plus a responsive Expo Web preview.
- Local survey, locale, observation, and species-list workflows. Native data is
  stored in SQLite; browser data is stored in origin-scoped `localStorage`.
- Survey archiving and restore. Archived surveys are view-only and exportable;
  permanent deletion is available only after archiving and cascades to child
  records and drafts.
- Observation form draft recovery and independent live inheritance of locale
  time and position.
- Bundled offline Dyntaxa vascular-plant taxonomy containing 10,711 accepted
  species and subspecies from the 2026-06-18 Darwin Core Archive. Native search
  uses the bundled SQLite FTS5 database; Web uses a generated JSON dataset.
- Reusable species lists, list-first suggestions, default taxonomy selection,
  and free-text species snapshots.
- Local WGS84 to RT90 conversion, manual RT90 entry, and device position capture.
- Local statistics and achievements.
- Artportalen-compatible Excel export with one worksheet and 12 fixed columns,
  GPX export, and lossless per-survey JSON backup/restore.
- Map filters and selectable observations on both platforms. The authenticated
  Lantmäteriet overview WMTS can provide an online basemap; without map access,
  observations remain available on a coordinate plot.

## Not implemented yet

- Importing custom taxonomy packages or downloading/updating additional
  taxonomy packages in the app. The Dyntaxa package is bundled with the app.
- Managed offline map-region downloads. The current Lantmäteriet overview WMTS
  is online-only; preparing and distributing approved offline raster regions
  still needs an organisation-controlled endpoint and licensing verification.
- An installable or service-worker-backed offline Web app. The Web preview must
  load the app from a development server or deployed site, although saved data
  remains local between visits.
- Observation duplication.
- Verification of release builds and GPS/map workflows on representative
  physical iOS and Android devices.

## Current map details

Users connect the current Lantmäteriet overview WMTS with their own credentials
in Settings. Native credentials use platform secure storage. Browser credentials
remain in memory until the page reloads. The app falls back to a selectable
coordinate plot when credentials, reception, or service access are unavailable.
The planned downloadable raster source and its licensing requirements are
documented in [the map-source decision](./docs/decisions/map-source.md).

## Current storage versions

- Native SQLite schema: version 6.
- Browser storage schema: version 6.
- Per-survey JSON backup format: version 5.
