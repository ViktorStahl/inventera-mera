# Testing and release verification

Product acceptance criteria are in [DESIGN.md](../DESIGN.md). Implemented
features and known gaps are tracked in [STATUS.md](../STATUS.md).

## Automated tests

Add or update automated tests with each behavior change. Test domain rules at
the lowest useful layer and cover repository behavior against both native and
browser storage adapters where shared behavior is intended.

The repository uses Jest/Jest Expo and React Native Testing Library for
automated tests. The native end-to-end harness is not selected; evaluate
Maestro or Detox after an early physical-device test spike.

Coverage should include:

- Survey/locale/observation validation, fixed amount units, current-schema
  initialization, and incompatible-data cleanup.
- Locale live inheritance, independent time/position overrides, restored
  drafts, and preservation of explicit values.
- Coordinate control points, bounds, axis order, and round trips.
- Taxonomy package selection, alias normalization/ranking, and CSV validation.
- Species-list identity, list-first ranking, shared-list semantics, and
  format-v5 backup round-trips/merge behavior.
- Excel exact headers and cell mapping, formula/file-name sanitization, and
  accuracy-class boundaries; GPX WGS84 output and XML escaping.
- Date/time-zone and daylight-saving boundaries.
- Component states for form validation, draft restoration, free-text entry,
  keyboard interaction, accessibility feedback, online/offline states, and map
  fallback.

Do not add tests whose only purpose is to assert rejection of native/browser
schemas 1–5 or backup formats 1–4. Continue testing rejection of a database
newer than the application and correctness of the supported current formats.

## Native and Web device coverage

End-to-end scenarios for release-like native builds:

1. Go offline, create a survey and locale, add a GPS/manual observation,
   terminate/relaunch, and verify persistence.
2. Search taxonomy by Swedish/scientific/synonym name while offline; save a
   taxonomy-backed and free-text observation and add both to a species list.
3. Interrupt taxonomy/map download and verify existing records remain usable.
4. Filter map markers offline, edit inherited/overridden values, and export.
5. Exercise backup/restore and app update recovery for supported formats.
6. Run critical journeys on the smallest supported phone, with dynamic type,
   an external keyboard where applicable, and VoiceOver/TalkBack.

Test supported iOS and Android release builds on representative physical
devices, including airplane mode, process termination, low-storage conditions,
location denial, file sharing, and app upgrade. Simulator and Expo Go results
do not replace release verification. Test Web persistence, browser downloads,
keyboard behavior, and the map fallback separately.

Run `npm test`, `npm run typecheck`, and `npm run lint` for repository changes.
Native dependency/configuration changes also require a fresh development build.
