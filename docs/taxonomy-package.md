# Bundled Dyntaxa package

The bundled source is the Dyntaxa Darwin Core Archive published 2026-06-18
(dataset `de8934f4-a136-481c-a87a-b0b202b80a31`, DOI
[`10.15468/j43wfc`](https://doi.org/10.15468/j43wfc), CC0 1.0).

The accepted vascular-plant root is `Tracheophyta`, ID
`urn:lsid:dyntaxa.se:Taxon:6000506`. Include only accepted descendants whose raw
rank is exactly `species` or `subspecies`. Retain scientific synonyms and
alternative Swedish names as search aliases, not separate selectable taxa.
Exclude higher ranks, varieties, forms, hybrids, aggregates, non-accepted
duplicates, and taxa outside the root.

Put the untracked archive at `dyntaxa-raw/dyntaxa-dwca.zip` and run:

```sh
npm run taxonomy:build
```

Commit the generated SQLite asset, compact Web dataset, and manifest together.
Never edit generated assets manually or embed protected Dyntaxa credentials in
the client. The build validates source shape, hierarchy, counts, and checksums;
the manifest records provenance, licence, format version, and output checksums.

Source: [SLU Artdatabanken — Dyntaxa](https://www.slu.se/artdatabanken/arter-och-natur/taxonomi/dyntaxa/).
