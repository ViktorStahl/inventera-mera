# Coordinate decision: WGS84 and RT90

Status: Accepted

Product coordinate semantics are in [DESIGN.md](../../DESIGN.md). This record
captures the transformation and implementation constraints.

## Decision

Keep device geolocation as canonical WGS84 latitude/longitude. Derive RT90 2.5
gon V locally using Lantmäteriet's national direct-projection parameters, the
EPSG:3847 emulation. RT90 2.5 gon V is formally EPSG:3021, but selecting that
older transformation for GPS-compatible WGS84/SWEREF 99 inputs is not the
intended result.

For manual RT90 entry, RT90 is the user's canonical input and WGS84 is derived.
Store both representations with explicit axis names and the location source;
recompute the other representation on edits in the same repository operation.

## Consequences and validation

- Label axes explicitly as `RT90 Northing (X)` and `RT90 Easting (Y)`; never
  label latitude/longitude as RT90.
- Preserve stored precision. Display whole metres by default; Excel's separate
  rounding rules are in [DESIGN.md](../../DESIGN.md).
- Reject non-finite and out-of-area values. Warn about likely reversed axes;
  never silently swap them.
- Test fixed Swedish control points, axis order, geographic bounds, and
  WGS84 → RT90 → WGS84 round trips within the selected library's documented
  tolerance.
- Show reported device accuracy and explain that coordinate precision does
  not guarantee field accuracy. This app is not a cadastral/surveying tool.

## References

- [Lantmäteriet: RT 90–SWEREF 99 transformation](https://www.lantmateriet.se/sv/geodata/gps-geodesi-och-swepos/Transformationer/RT-90---SWEREF-99/)
- [Lantmäteriet: RT 90 reference system](https://www.lantmateriet.se/sv/geodata/gps-geodesi-och-swepos/Referenssystem/Tvadimensionella-system/RT-90/)
- [EPSG registry: RT90 2.5 gon V, EPSG:3021](https://epsg.org/crs_3021/RT90-2-5-gon-V.html)
- [Lantmäteriet: Swedish transformations in PROJ](https://www.lantmateriet.se/globalassets/geodata/gps-och-geodetisk-matning/svenska-transformationer-i-proj-web.pdf)
- [Lantmäteriet: RT90/SWEREF 99 control points](https://www.lantmateriet.se/contentassets/0f296052c56d425bb180430084d491d9/kontrollpunkter.pdf)
