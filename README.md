# Inventera mera

Offline-first field inventory MVP for wild-plant observations, built with React
Native, Expo, TypeScript, SQLite, and MapLibre Native. A browser preview shares
the same screens and domain logic.

Read [DESIGN.md](./DESIGN.md) for product requirements and target behavior,
[STATUS.md](./STATUS.md) for what is implemented today, and [AGENTS.md](./AGENTS.md)
before making changes. Implementation boundaries and technical decisions are
in [docs/](./docs/), including [storage compatibility](./docs/migrations.md),
[taxonomy packages](./docs/taxonomy-package.md), and [testing](./docs/testing.md).

The app stores surveys, locales, and observations locally, with offline species
search, GPS/RT90 coordinates, maps with a coordinate-plot fallback, and Excel,
GPX, and JSON export. See [STATUS.md](./STATUS.md) for the implemented features
and current gaps.

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
or deployed site to load, while already-entered data remains local. With
Lantmäteriet credentials connected in Settings, the browser can show the online
overview map; otherwise it uses the coordinate plot. Browser credentials remain
in memory until the page reloads.

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

## Rebuild the bundled Dyntaxa taxonomy

Package selection, source provenance, validation, and generated outputs are
documented in [docs/taxonomy-package.md](./docs/taxonomy-package.md). Place a
replacement archive at `dyntaxa-raw/dyntaxa-dwca.zip`, then run:

```sh
npm run taxonomy:build
```

The raw directory is intentionally ignored by Git. Commit the generated native
SQLite asset, web JSON asset, and manifest together.

## Map behavior

See [STATUS.md](./STATUS.md) for current map behavior and
[the map-source decision](./docs/decisions/map-source.md) for the planned
offline source and licensing requirements.

For implemented features and remaining work, see [STATUS.md](./STATUS.md).
