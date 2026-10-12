# Inventera mera

Offline-first React Native field notebook for wild-plant observations. See
[DESIGN.md](./DESIGN.md) for product rules and [AGENTS.md](./AGENTS.md) before
making changes.

## Run

Requires Node.js 22.13 or later and the Expo SDK 57 native toolchain.

```sh
npm install
npm run web
```

Browser data is origin-scoped local storage. Clearing site data removes it; use
a JSON backup for important records. Create a browser bundle with
`npm run export:web`.

For Android, `npm run android` selects the required JDK 17. Inspect it with
`npm run android:java`, or set `INVENTERA_JAVA_HOME` and
`INVENTERA_ANDROID_HOME` when auto-detection fails.

```sh
npx expo prebuild
npm run android
```

Use `npm run ios` on macOS. Native modules require an Expo development build and
do not run in Expo Go.

## Verify

```sh
npm run typecheck
npm run lint
npm test
```

Before release, exercise offline persistence, process termination, location
denial, export/share, storage pressure, accessibility, and app upgrades on
representative physical iOS and Android devices. Simulator and Expo Go results
do not replace release-build verification.

## Rebuild the bundled taxonomy

Place the untracked source archive at `dyntaxa-raw/dyntaxa-dwca.zip`, run
`npm run taxonomy:build`, and commit the generated native database, Web dataset,
and manifest together. See [docs/taxonomy-package.md](./docs/taxonomy-package.md).
