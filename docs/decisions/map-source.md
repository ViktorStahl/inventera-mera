# Map-source decision

Status: Accepted for the MVP direction; licensing/package delivery remains open.

Product-level offline behavior is defined in [DESIGN.md](../../DESIGN.md), and
implementation status is tracked in [STATUS.md](../../STATUS.md).

## Decision

Use MapLibre as the map renderer, behind a provider adapter. The intended field
MVP basemap is Lantmäteriet's downloadable raster topographic map, subject to
verification of access, personal-data conditions, redistribution, attribution,
and update terms. Preprocess approved source data into bounded regions hosted
by an organisation-controlled endpoint that can serve MapLibre offline packs.
Persist source/version/date, bounds, zoom range, size, checksum, attribution,
licence, `downloadedAt`, and `lastUsedAt` in each package manifest.

The current authenticated overview WMTS is temporary and online-only. It uses
the colored `topowebb` PNG layer, Web Mercator matrix set `3857`, and
user-supplied Basic Auth. It is not suitable for offline prefetch or detailed
field maps. Keep provider details isolated so replacing it does not affect
observation data. In the absence of a basemap, keep local markers and the
coordinate-plot fallback available.

## Alternatives and constraints

- `Topografi 10 Nedladdning, vektor` is a possible later source with richer
  styling, but requires a tile-generation pipeline.
- Self-hosted OSM-derived vector tiles are a fallback; preserve ODbL attribution
  and do not use `tile.openstreetmap.org` for offline downloads.
- Mapbox brings mobile offline support but adds proprietary SDK, account,
  billing, usage limits, and vendor lock-in; adopting it requires approval.
- MapTiler Cloud standard terms restrict bulk downloads; use only an expressly
  authorized extract/agreement. OpenTopography is optional terrain data, not
  the default basemap.

Before shipping offline regions, verify a representative Swedish municipality
on physical iOS and Android devices: download, pause/resume, checksum and
activation, deletion, attribution, and offline rendering at intended zoom
levels. This must follow provider approval, not precede it.

## References

- [Lantmäteriet: Topografi 10 Nedladdning, vektor](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/topografi-10-nedladdning-vektor/)
- [Lantmäteriet: topographic-map alternatives](https://www.lantmateriet.se/sv/geodata/vara-produkter/Produktnyheter/Geografisk-information/avveckling-av-produkten-topografisk-webbkarta-visning-oversiktlig/)
- [Lantmäteriet: Topografisk webbkarta Visning, översiktlig](https://geotorget.lantmateriet.se/geodataprodukter/topografisk-webbkarta-visning-oversiktlig-api)
- [Lantmäteriet: Topografisk webbkarta Nedladdning, raster](https://geotorget.lantmateriet.se/geodataprodukter/topografisk-webbkarta-nedladdning-raster-api)
- [OpenStreetMap Foundation tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [Mapbox mobile offline maps](https://docs.mapbox.com/help/dive-deeper/mobile-offline/)
- [MapTiler mobile/offline options](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-build-mobile-apps-with-maps-using-sdk/)
- [MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/)
- [OpenTopography developer resources](https://opentopography.org/developers)
