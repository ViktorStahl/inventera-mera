import type { TaxonomyReference } from "@/domain/models";
import manifest from "./generated/dyntaxaVascularPlants.manifest.json";

export type AvailableTaxonomy = TaxonomyReference & {
  description: string;
  downloaded: boolean;
  entryCount: number;
  license: string;
  rootTaxonId: string;
  sourceDoi: string;
};

export const VASCULAR_PLANTS_TAXONOMY: AvailableTaxonomy = {
  packageId: manifest.packageId,
  name: manifest.name,
  version: manifest.version,
  description: `${manifest.entryCount.toLocaleString("sv-SE")} accepterade arter och underarter under kärlväxter.`,
  downloaded: true,
  entryCount: manifest.entryCount,
  license: manifest.license,
  rootTaxonId: manifest.rootTaxonId,
  sourceDoi: manifest.sourceDoi,
};

export const AVAILABLE_TAXONOMIES: AvailableTaxonomy[] = [VASCULAR_PLANTS_TAXONOMY];

export function findTaxonomy(packageId: string): AvailableTaxonomy | undefined {
  return AVAILABLE_TAXONOMIES.find((taxonomy) => taxonomy.packageId === packageId);
}
