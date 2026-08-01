import type { SpeciesSnapshot, Taxon, TaxonomyReference } from "./models";

export function speciesKey(species: SpeciesSnapshot): string {
  if (species.source === "taxonomy" && species.taxonId) {
    return `taxonomy:${species.taxonomyPackageId ?? ""}:${species.taxonId}`;
  }
  return `free-text:${normalizeSpeciesName(species.enteredName)}`;
}

export function taxonomySpeciesSnapshot(
  taxon: Taxon,
  taxonomy: TaxonomyReference,
  enteredName = taxon.preferredName,
): SpeciesSnapshot {
  return {
    source: "taxonomy",
    enteredName: enteredName.trim(),
    taxonId: taxon.id,
    preferredName: taxon.preferredName,
    scientificName: taxon.scientificName,
    taxonomyPackageId: taxonomy.packageId,
    taxonomyVersion: taxonomy.version,
  };
}

export function normalizeSpeciesName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv");
}
