# Decision: WGS84 and RT90

Status: Accepted

Device geolocation remains canonical WGS84 latitude/longitude. Derive RT90 2.5
gon V locally with Lantmäteriet's national direct-projection parameters—the
EPSG:3847 emulation. Although RT90 2.5 gon V is formally EPSG:3021, that older
transformation is not intended for GPS-compatible WGS84/SWEREF 99 input.

For manual RT90 entry, RT90 Northing (X)/Easting (Y) is canonical and WGS84 is
derived. Store both representations and the location source; never silently swap
axes or label latitude/longitude as RT90. Preserve stored precision.

References:

- [Lantmäteriet: RT 90–SWEREF 99 transformation](https://www.lantmateriet.se/sv/geodata/gps-geodesi-och-swepos/Transformationer/RT-90---SWEREF-99/)
- [Lantmäteriet: Swedish transformations in PROJ](https://www.lantmateriet.se/globalassets/geodata/gps-och-geodetisk-matning/svenska-transformationer-i-proj-web.pdf)
- [Lantmäteriet: control points](https://www.lantmateriet.se/contentassets/0f296052c56d425bb180430084d491d9/kontrollpunkter.pdf)
