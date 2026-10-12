# Inventera mera — agent guide

Read [DESIGN.md](./DESIGN.md) before changing behavior. It is the source of truth
for product rules and external contracts. Read the relevant decision record for
coordinate, map, or taxonomy work.

## Working rules

- Preserve offline writes and the shared native/Web repository behavior.
- Keep native-only persistence, MapLibre, sharing, and keyboard modules out of
  Web bundles. Native uses SQLite; Web uses origin-scoped `localStorage`.
- Run Android through `npm run android`; the wrapper selects the required JDK 17.
  Native modules require an Expo development build, not Expo Go.
- Rebuild taxonomy assets with `npm run taxonomy:build`; never edit generated
  assets or put Dyntaxa credentials in the client. Follow
  [docs/taxonomy-package.md](./docs/taxonomy-package.md).
- Follow [docs/decisions/map-source.md](./docs/decisions/map-source.md) for map
  licensing, attribution, and offline use.
- Add or update focused tests for behavior changes. Run `npm test`,
  `npm run typecheck`, and `npm run lint`.
- Record product decisions in `DESIGN.md` and non-obvious technical decisions in
  a short decision record. Do not duplicate implementation details already clear
  from code and tests.
