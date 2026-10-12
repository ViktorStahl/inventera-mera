# Local storage and backup compatibility

This document describes the supported compatibility boundary, not a history
of every past schema. Product-level recovery guidance remains in
[DESIGN.md](../DESIGN.md); current implementation status is in
[STATUS.md](../STATUS.md).

## Supported formats

| Store | Current supported version | Fresh-install behavior |
| --- | ---: | --- |
| Native SQLite | 6 | Create schema v6 directly |
| Browser localStorage | 6 | Create schema v6 directly |
| Per-survey JSON backup | 5 | Import format v5 only |

Older native/browser schemas and JSON backup formats are not migrated. The app
does not silently clear or convert unsupported stored data. Before resetting
old local data, export a format-v5 JSON backup using a compatible app version.
Then reset local storage and restore the backup in an app that supports v5.

Keep the safeguard that rejects a database schema newer than the running app.
Do not add a runtime SQLite package just for tests; native migration/startup
behavior can be exercised with Node's built-in `node:sqlite` through an
Expo-SQLite-compatible test adapter.

## Current data rules

- Format-v5 backups include locale observation-default settings, the selected
  species list, its entries, and lossless observation data. Restore validates
  the survey/list relationship and taxonomy. If a matching shared list exists,
  merge missing entries without deleting newer local entries.
- Coordinates retain both WGS84 and RT90 values and original GPS accuracy in
  local storage and backup. Excel-only normalization is defined in
  [DESIGN.md](../DESIGN.md).
- Schema v6 includes the device-local achievement ledger. Awards are global to
  the device, survive deletion of their source survey, and are not included in
  per-survey backups.
- Startup cleanup enforces the fixed amount-unit contract without a schema
  migration: invalid/partial/negative amounts are removed, and drafts with an
  unsupported saved unit are discarded. Restore omits incompatible
  observations. This accepted behavior is intentionally not an old-format
  migration.

Any future schema evolution must state its supported starting version,
preservation behavior, backup implications, and recovery path before release.
Do not claim compatibility for a format unless it is covered by an explicit
implementation and tests.
