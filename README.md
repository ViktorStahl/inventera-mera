# Inventera mera

Offline-first field inventory MVP for wild-plant observations, built with React
Native, Expo, TypeScript, SQLite, and MapLibre Native. A browser preview shares
the same screens and domain logic.

Read [DESIGN.md](./DESIGN.md) for the product and architecture contract and
[AGENTS.md](./AGENTS.md) before making changes.

## Implemented MVP

- Swedish iOS/Android user interface and responsive browser preview.
- Create, search, list, open, edit, and permanently delete surveys with
  confirmation; deleting a survey also deletes its locales and observations.
- Bundled, searchable 2026 SCB list of 21 counties and 290 municipalities.
- Add, edit, and delete named locales with date/time, RT90 coordinates, optional
  GPS capture/accuracy, and note.
- Add, edit, and delete observations within a locale. Time and coordinate use
  live locale defaults and can be overridden independently; species, amount/unit,
  public comment, and additional observers remain observation fields.
- Transform GPS coordinates locally with Lantmäteriet's national RT90 direct
  projection and verify it against their published control example.
- Small offline vascular-plant starter taxonomy plus unrestricted free text.
- Reusable offline species lists: create/rename/delete lists, add/remove
  taxonomy or free-text species, attach a list to a survey, and rank matching
  list entries before the rest of the taxonomy.
- Configurable default taxonomy for new surveys and species lists.
- SQLite persistence, observation-form draft recovery, and local-only data.
- MapLibre map markers when a map style is configured, plus an always-available
  marker-only offline fallback and local species/locale/date filters.
- Exact Swedish Excel observation interchange columns with conditional `Antal`
  + `Enhet`, plus Survey and Locales sheets.
- Lossless per-survey JSON backup and restore, including the selected species
  list snapshot.

## Run in a browser

```sh
npm install
npm run web
```

Open the URL printed by Expo, normally <http://localhost:8081>. Browser data is
stored locally for that site and persists across restarts. Clearing site data
removes it, so use JSON backup for anything important. GPS requires permission
and a secure context; `localhost` is accepted by current browsers.

Create a deployable browser bundle with `npm run export:web`. The browser is a
preview target, not an installable offline PWA: it needs the development server
or deployed site to load, while already-entered data remains local. Its map uses
the RT90 coordinate plot; the configured Lantmäteriet/MapLibre basemap remains a
native-app feature.

## Run locally

Requirements: Node.js 22.13 or later and the native toolchain required by Expo
SDK 57. Android builds use JDK 17, which is the required/default JDK for the
project's Android Gradle Plugin 8.12. The `npm run android` wrapper locates an
installed JDK 17 and ignores incompatible newer defaults such as JDK 26.

```sh
npm install
npx expo prebuild
npm run android
```

Inspect the selected JDK with `npm run android:java`. If auto-detection cannot
find it, run with `INVENTERA_JAVA_HOME=/path/to/jdk-17 npm run android`. The
wrapper also locates the usual Android SDK directories; override that with
`INVENTERA_ANDROID_HOME=/path/to/Android/Sdk` when necessary.

Use `npm run ios` on macOS with Xcode. MapLibre contains native code, so the
native app requires an Expo development build and does not run in Expo Go.

Run checks with:

```sh
npm run typecheck
npm run lint
npm test
```

## Lantmäteriet map configuration

The selected MVP source is Lantmäteriet's downloadable raster topographic map.
The source data must first be processed and exposed from an approved static tile
distribution endpoint. Copy `.env.example` to `.env` and set:

```text
EXPO_PUBLIC_MAP_STYLE_URL=https://example.invalid/lantmateriet/style.json
```

The style must reference the approved Lantmäteriet raster tiles and include
required attribution. With no URL, the app clearly labels the missing basemap
and continues to plot observations offline on a coordinate grid.

## MVP boundaries

- The bundled taxonomy is a workflow-testing starter list, not the complete
  Dyntaxa vascular-plant package. The package build/download adapter still
  needs an authorised distribution endpoint.
- Lantmäteriet map package generation and offline-region download management
  require the selected organisation-controlled endpoint and final terms review.
- Native release builds and GPS/map behaviour must be verified on physical iOS
  and Android devices before field use.
- `npm audit --omit=dev` currently reports 13 moderate transitive advisories in
  the Expo/native build toolchain (none high or critical). Expo Doctor requires
  the installed compatible versions; do not apply npm's suggested downgrade to
  Expo 46.
