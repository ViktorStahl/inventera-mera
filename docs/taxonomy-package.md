# Taxonomy package

Product behavior for taxonomy selection, species snapshots, free text, and
search ranking is defined in [DESIGN.md](../DESIGN.md). Current implementation
status is in [STATUS.md](../STATUS.md).

## Bundled Dyntaxa package

The bundled source is the Dyntaxa Darwin Core Archive published 2026-06-18
(dataset `de8934f4-a136-481c-a87a-b0b202b80a31`, DOI
[`10.15468/j43wfc`](https://doi.org/10.15468/j43wfc), CC0 1.0). The accepted
vascular-plant root is `Tracheophyta`, ID
`urn:lsid:dyntaxa.se:Taxon:6000506`, Swedish preferred name `kärlväxter`.

Include only accepted descendants whose raw Darwin Core rank is exactly
`species` or `subspecies`. Cross-check the parent hierarchy against the
archive's denormalized `phylum = Tracheophyta` value. Retain scientific synonym
rows for selected accepted taxa and alternative Swedish vernacular names as
search aliases; do not expose those aliases as separate selectable taxa.
Exclude higher ranks, varieties, forms, hybrids, aggregates, non-accepted
duplicate results, and taxa outside the root.

Do not call protected Dyntaxa endpoints from the mobile client or embed
subscription credentials. Generate downloadable packages in a controlled
build/admin job. For the bundled package:

1. Put the source archive at `dyntaxa-raw/dyntaxa-dwca.zip` (untracked).
2. Run `npm run taxonomy:build`.
3. Commit the generated native SQLite asset, compact Web dataset, and manifest
   together. Do not hand-edit generated assets.

The build validates required Darwin Core columns, hierarchy, accepted ranks,
row counts, and source/output SHA-256 checksums. Preserve source IDs and family
taxon IDs where available. The manifest records source date, citation/licence,
record count, format version, and checksums.

## Runtime package behavior

Native taxonomy search is local through parameterized SQLite FTS5/prefix
queries. Do not load the entire package into JavaScript or the React Native
render thread. Web uses the generated compact dataset for equivalent local,
accent-insensitive search. Future downloads must be validated and staged before
atomic activation; keep the prior usable package until activation succeeds.

Custom taxonomy import is planned as UTF-8 CSV with columns
`id,preferredName,scientificName,synonyms,rank,parentId`. Either preferred or
scientific name is required; synonyms are separated by `|`. Import should show
mapping, row-numbered validation errors, preview, and final count before commit.
Record source filename, checksum, and import date in package metadata.

## Sources

- [SLU Artdatabanken: Dyntaxa](https://www.slu.se/artdatabanken/arter-och-natur/taxonomi/dyntaxa/)
- [SLU Artdatabanken: taxonomic APIs and Darwin Core export](https://www.slu.se/artdatabanken/rapportering-och-fynd/oppna-data-och-apier/om-slu-artdatabankens-apier/apier-for-taxonomisk-information/)
- [SLU Artdatabanken developer portal](https://api-portal.artdatabanken.se/)
