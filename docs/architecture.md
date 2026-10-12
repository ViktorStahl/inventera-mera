# Architecture and platform boundaries

This document records implementation constraints. Product behavior and domain
invariants are defined in [DESIGN.md](../DESIGN.md); current delivery status is
in [STATUS.md](../STATUS.md).

## Runtime and navigation

- React Native, TypeScript, Expo, and the React Native new architecture are the
  application baseline. Use Expo development builds for native modules; Expo Go
  is not the production runtime.
- Expo Router provides typed file-based routes and deep links. Navigation
  follows Survey → Locale → Observation. After mutations, return to the nearest
  canonical parent rather than adding a duplicate route to history.
- Native iOS and Android are the field-production targets. Expo Web is a
  development/evaluation preview that shares domain logic and repository API.
- Keep browser-specific persistence, downloads, and map rendering platform
  isolated. Browser persistence uses origin-scoped `localStorage`, exports use
  downloads, and browser code must not import MapLibre Native.
- Keep domain rules independent of platform views where practical. Build
  Android through `npm run android`, which selects the supported JDK 17.

## Offline boundary and storage

Surveys, locales, observations, species lists, settings, and drafts are owned by
the device. Creating and editing these records must never require network
access. Native persistence uses Expo SQLite with WAL, foreign-key enforcement,
prepared statements, and transactional mutations; the browser preview uses a
compatible localStorage repository implementation. Repository behavior should
remain consistent across adapters.

Taxonomy/map package distribution may use a static service, but survey and
observation records are never uploaded. Taxonomy packages are staged, checked
against their manifest/checksum, and activated atomically. Map regions are
user-initiated, bounded, and must be licensed for offline use. Never evict
surveys, observations, or drafts automatically; ask before removing downloaded
packages. See [the map-source decision](decisions/map-source.md).

Native app code and core assets ship in the application binary. Drafts should
be persisted after meaningful changes and when the app becomes inactive where
the platform permits. A final observation save and its draft removal are one
repository operation. Prevent duplicate submission and retain entered values
on recoverable failures.

Current schema and backup compatibility is documented in
[migrations.md](migrations.md). Do not infer local-data compatibility from the
application, Expo runtime, SQLite schema, or backup version: they are separate
version lifecycles.

## Data and service boundaries

- Device location is requested only in the foreground and on demand for a new
  observation or explicit retry. Background location is out of scope.
- Coordinates are stored with explicit WGS84 and RT90 meanings; transformation
  behavior is specified in [the coordinate decision](decisions/coordinates-rt90.md).
- Keep provider-specific map configuration behind an adapter. Attribution must
  remain visible and source terms must permit the intended use.
- Do not nest the interactive map viewport inside a vertical scroll view.
  Gestures starting on the map belong to the map; potentially long filters use
  a separate scrollable modal.
- Keep package credentials/secrets out of the mobile client unless the
  provider explicitly requires user credentials; see
  [the temporary provider-credentials decision](decisions/map-credentials.md).
- Protect sensitive survey data: no analytics, logs, or error payloads may
  include exact coordinates, notes, survey titles, or species names without a
  separate consent/privacy design. Escape user text, sanitize file names,
  validate imported package shape/size, and protect spreadsheet output from
  formula injection.
- A future sync feature requires its own identity, authorization, encryption,
  retention, deletion, audit, and conflict-resolution design before launch.

## Downloads, exports, and failure isolation

Use the platform share sheet for native exports and browser downloads on Web.
Taxonomy, map, backup, and export work should report failure separately and
must not compromise saved field records. Incomplete responses and HTTP error
bodies are never valid packages. Keep old taxonomy data until a new package
activates successfully.

Build native development clients whenever native dependencies or configuration
change. Verify release builds independently of Metro; simulator or Expo Go
results are not release verification. See [testing.md](testing.md) for the
verification matrix.
