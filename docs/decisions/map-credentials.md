# Decision: temporary Lantmäteriet map credentials

Status: Accepted for the temporary online overview WMTS; remove with that source.

The source choice is described in [map-source.md](map-source.md). Current
implemented behavior is tracked in [STATUS.md](../../STATUS.md).

## Decision

Each user supplies their own Basic Auth username and password. On iOS and
Android, store them in Expo SecureStore with device-only keychain accessibility.
On Web, keep them in module memory only; never persist them to localStorage,
sessionStorage, IndexedDB, JSON backups, logs, URLs, or exports.

Validate credentials against GetCapabilities before accepting them. Scope the
Authorization header strictly to the Lantmäteriet WMTS endpoint. When opening
the map, use stored/session credentials directly and let the map request
determine service availability; do not send another GetCapabilities request on
every open. Renderer failure immediately falls back to the offline coordinate
plot.

This temporary source is documented to end on 2026-12-31 and its overview
resolution is not a durable detailed field map. Do not add an offline-region
download action or prefetch against this WMTS. Remove the credential flow when
the source is retired.
