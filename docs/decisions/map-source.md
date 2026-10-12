# Decision: map source

Status: MVP direction accepted; licensing and package delivery remain open.

Use MapLibre behind a provider boundary. The intended offline field basemap is
Lantmäteriet's downloadable raster topographic map, subject to approved access,
redistribution, attribution, personal-data, and update terms. Approved data must
be packaged as bounded regions through an organisation-controlled endpoint with
source, version, bounds, zoom, checksum, licence, and attribution metadata.

The current authenticated `topowebb` overview WMTS is temporary and online-only.
It must not be prefetched or offered as an offline region, and its credentials
must remain endpoint-scoped and outside localStorage, backups, logs, URLs, and
exports. The source is documented to end on 2026-12-31. Without a basemap, local
markers and the coordinate-plot fallback remain available.

Do not download offline tiles from `tile.openstreetmap.org`. Any OSM-derived
alternative must be self-hosted or expressly licensed and retain required
attribution. Offline regions may ship only after provider approval and physical
iOS/Android verification of download, integrity, deletion, attribution, and
offline rendering.

References:

- [Lantmäteriet downloadable raster map](https://geotorget.lantmateriet.se/geodataprodukter/topografisk-webbkarta-nedladdning-raster-api)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
